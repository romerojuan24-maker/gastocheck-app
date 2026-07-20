-- ============================================================================
-- FASE 2 — Reparación del circuito CobraCheck de campo (auditoría 2026-07-20)
-- Corrige: columnas faltantes, migración 20260618210000 con SQL inválido,
-- triggers con columna inexistente (invoice_number → folio) y RLS de roles.
-- Idempotente: seguro re-ejecutar. Pegar completo en Supabase SQL Editor.
-- ============================================================================

-- ── 1. Columnas que el código móvil usa y no existían ────────────────────────
-- pagos.tsx / transferencia.tsx / cobra-movements-queue.ts insertan 'method'
ALTER TABLE cobra_movements ADD COLUMN IF NOT EXISTS method text;
-- el trigger create_payment_from_movement inserta 'created_by' en cobra_payments
ALTER TABLE cobra_payments  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- ── 2. Tablas de la migración 20260618210000 (contenía SQL inválido:
--       policies multi-comando y INSERT...USING; probablemente nunca aplicó) ──
CREATE TABLE IF NOT EXISTS cobra_promises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES cobra_clients(id) ON DELETE CASCADE,
  amount NUMERIC(15,2) NOT NULL,
  promise_date DATE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'broken')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cobra_promises_company_id ON cobra_promises(company_id);
CREATE INDEX IF NOT EXISTS idx_cobra_promises_client_id  ON cobra_promises(client_id);
CREATE INDEX IF NOT EXISTS idx_cobra_promises_status     ON cobra_promises(status);
CREATE INDEX IF NOT EXISTS idx_cobra_promises_date       ON cobra_promises(promise_date);

CREATE TABLE IF NOT EXISTS cobra_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES cobra_clients(id) ON DELETE CASCADE,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  call_date TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'no_answer', 'voicemail')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cobra_calls_company_id ON cobra_calls(company_id);
CREATE INDEX IF NOT EXISTS idx_cobra_calls_client_id  ON cobra_calls(client_id);

-- RLS válidas: UNA policy por comando (el original agrupaba INSERT, UPDATE → error)
ALTER TABLE cobra_promises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cobra_promises_select" ON cobra_promises;
CREATE POLICY "cobra_promises_select" ON cobra_promises FOR SELECT
  USING (auth_role(company_id) IS NOT NULL);
DROP POLICY IF EXISTS "cobra_promises_insert" ON cobra_promises;
CREATE POLICY "cobra_promises_insert" ON cobra_promises FOR INSERT
  WITH CHECK (auth_role(company_id) IN ('owner','admin','supervisor','cobrador','collector'));
DROP POLICY IF EXISTS "cobra_promises_update" ON cobra_promises;
CREATE POLICY "cobra_promises_update" ON cobra_promises FOR UPDATE
  USING (auth_role(company_id) IN ('owner','admin','supervisor','cobrador','collector'));

ALTER TABLE cobra_calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cobra_calls_select" ON cobra_calls;
CREATE POLICY "cobra_calls_select" ON cobra_calls FOR SELECT
  USING (auth_role(company_id) IS NOT NULL);
DROP POLICY IF EXISTS "cobra_calls_insert" ON cobra_calls;
CREATE POLICY "cobra_calls_insert" ON cobra_calls FOR INSERT
  WITH CHECK (auth_role(company_id) IN ('owner','admin','supervisor','cobrador','collector'));

-- ── 3. Triggers de cierre automático de CxC (venían en la migración inválida) ─
CREATE OR REPLACE FUNCTION recalc_client_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cobra_clients
  SET current_balance = (
    SELECT COALESCE(SUM(
      CASE
        WHEN ci.status = 'paid' THEN 0
        WHEN ci.status = 'partial' THEN ci.amount - COALESCE(
          (SELECT SUM(cp.amount) FROM cobra_payments cp WHERE cp.invoice_id = ci.id), 0)
        ELSE ci.amount
      END
    ), 0)
    FROM cobra_invoices ci
    WHERE ci.client_id = NEW.client_id
  ),
  last_payment_date = NEW.payment_date
  WHERE id = NEW.client_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cobra_payments_recalc_balance ON cobra_payments;
CREATE TRIGGER cobra_payments_recalc_balance
  AFTER INSERT OR UPDATE ON cobra_payments
  FOR EACH ROW EXECUTE FUNCTION recalc_client_balance();

CREATE OR REPLACE FUNCTION update_invoice_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cobra_invoices
  SET status = CASE
    WHEN (SELECT COALESCE(SUM(amount), 0) FROM cobra_payments WHERE invoice_id = NEW.invoice_id) >= amount
      THEN 'paid'
    WHEN (SELECT COALESCE(SUM(amount), 0) FROM cobra_payments WHERE invoice_id = NEW.invoice_id) > 0
      THEN 'partial'
    ELSE status
  END
  WHERE id = NEW.invoice_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cobra_payments_update_invoice ON cobra_payments;
CREATE TRIGGER cobra_payments_update_invoice
  AFTER INSERT OR UPDATE ON cobra_payments
  FOR EACH ROW EXECUTE FUNCTION update_invoice_status();

-- ── 4. Signal triggers: usaban new.invoice_number (columna inexistente; es folio)
--       Si estos triggers aplicaron, TODO insert/update de facturas fallaba. ──
CREATE OR REPLACE FUNCTION trg_cobracheck_invoice_created()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT company_id INTO v_company_id FROM cobra_invoices WHERE id = new.id;
  IF (tg_op = 'INSERT') THEN
    INSERT INTO business_signals (
      company_id, source_module, signal_type, severity, entity_type, entity_id,
      title, value_decimal, currency, deduplication_key, status
    ) VALUES (
      v_company_id, 'cobracheck', 'INVOICE_CREATED', 'INFO', 'cobra_invoice', new.id,
      'Factura por cobrar: ' || COALESCE(new.folio, '(sin número)'),
      new.amount, 'MXN', 'invoice:' || new.id::text, 'ACTIVE'
    )
    ON CONFLICT (company_id, deduplication_key) WHERE deduplication_key IS NOT NULL AND status = 'ACTIVE'
    DO UPDATE SET updated_at = now();

    INSERT INTO advisor_signal_queue (company_id, event_type, status)
    VALUES (v_company_id, 'INVOICE_CREATED', 'PENDING');
  END IF;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION trg_cobracheck_invoice_status_changed()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_company_id uuid;
BEGIN
  IF (tg_op = 'UPDATE' AND new.status != old.status) THEN
    SELECT company_id INTO v_company_id FROM cobra_invoices WHERE id = new.id;

    IF new.status = 'overdue' THEN
      INSERT INTO business_signals (
        company_id, source_module, signal_type, severity, entity_type, entity_id,
        title, value_decimal, currency, deduplication_key, status
      ) VALUES (
        v_company_id, 'cobracheck', 'INVOICE_OVERDUE', 'HIGH', 'cobra_invoice', new.id,
        'Factura vencida: ' || COALESCE(new.folio, '(sin número)'),
        new.amount, 'MXN', 'invoice_overdue:' || new.id::text, 'ACTIVE'
      )
      ON CONFLICT (company_id, deduplication_key) WHERE deduplication_key IS NOT NULL AND status = 'ACTIVE'
      DO UPDATE SET updated_at = now();

      INSERT INTO advisor_signal_queue (company_id, event_type, status)
      VALUES (v_company_id, 'INVOICE_STATUS_CHANGED', 'PENDING');
    END IF;

    IF new.status = 'paid' THEN
      INSERT INTO business_signals (
        company_id, source_module, signal_type, severity, entity_type, entity_id,
        title, value_decimal, currency, deduplication_key, status
      ) VALUES (
        v_company_id, 'cobracheck', 'INVOICE_PAID', 'INFO', 'cobra_invoice', new.id,
        'Factura pagada: ' || COALESCE(new.folio, '(sin número)'),
        new.amount, 'MXN', 'invoice_paid:' || new.id::text, 'ACTIVE'
      )
      ON CONFLICT (company_id, deduplication_key) WHERE deduplication_key IS NOT NULL AND status = 'ACTIVE'
      DO UPDATE SET updated_at = now();

      INSERT INTO advisor_signal_queue (company_id, event_type, status)
      VALUES (v_company_id, 'INVOICE_STATUS_CHANGED', 'PENDING');
    END IF;
  END IF;
  RETURN new;
END;
$$;

-- ── 5. RLS: unificar roles collector/cobrador y no excluir al owner ──────────
-- La app asigna 'collector' (equipo.tsx) pero las policies decían 'cobrador'.
DROP POLICY IF EXISTS "cobra_invoices_insert" ON cobra_invoices;
CREATE POLICY "cobra_invoices_insert" ON cobra_invoices FOR INSERT
  WITH CHECK (auth_role(company_id) IN ('owner','admin','supervisor','cobrador','collector'));
DROP POLICY IF EXISTS "cobra_invoices_update" ON cobra_invoices;
CREATE POLICY "cobra_invoices_update" ON cobra_invoices FOR UPDATE
  USING (auth_role(company_id) IN ('owner','admin','supervisor','cobrador','collector'));

DROP POLICY IF EXISTS "cobra_movements_insert" ON cobra_movements;
CREATE POLICY "cobra_movements_insert"
  ON cobra_movements FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND auth.uid() IN (
      SELECT user_id FROM company_members
      WHERE company_id = cobra_movements.company_id
        AND role IN ('owner', 'collector', 'cobrador', 'admin', 'supervisor')
        AND status = 'active'
    )
  );

-- Recargar cache de PostgREST
NOTIFY pgrst, 'reload schema';
