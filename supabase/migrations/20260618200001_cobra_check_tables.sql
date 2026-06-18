-- ============================================================================
-- CobraCheck — Paso 2: tablas, índices, RLS y vista
-- Requiere que 20260618200000_cobra_check_schema.sql ya haya corrido
-- (necesita el valor 'cobrador' en member_role disponible en la DB)
-- ============================================================================

-- ============================================================================
-- cobra_clients — clientes/deudores
-- ============================================================================
CREATE TABLE IF NOT EXISTS cobra_clients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            text NOT NULL,
  rfc             text,
  email           text,
  phone           text,
  contact_name    text,
  credit_limit    numeric(12,2),
  current_balance numeric(12,2) DEFAULT 0,
  risk_score      integer DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  status          text DEFAULT 'active' CHECK (status IN ('active','inactive','blacklist')),
  last_payment_date timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cobra_clients_company ON cobra_clients(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cobra_clients_rfc ON cobra_clients(company_id, rfc)
  WHERE rfc IS NOT NULL;

-- ============================================================================
-- cobra_invoices — facturas emitidas a clientes
-- ============================================================================
CREATE TABLE IF NOT EXISTS cobra_invoices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id    uuid NOT NULL REFERENCES cobra_clients(id) ON DELETE CASCADE,
  folio        text NOT NULL,
  uuid_sat     text,
  amount       numeric(12,2) NOT NULL,
  tax          numeric(12,2),
  subtotal     numeric(12,2),
  issue_date   date NOT NULL,
  due_date     date NOT NULL,
  payment_date date,
  status       text DEFAULT 'pending'
                 CHECK (status IN ('pending','partial','paid','overdue','cancelled')),
  days_overdue integer DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cobra_invoices_company  ON cobra_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_cobra_invoices_client   ON cobra_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_cobra_invoices_status   ON cobra_invoices(status);
CREATE INDEX IF NOT EXISTS idx_cobra_invoices_due_date ON cobra_invoices(due_date);

-- ============================================================================
-- cobra_payments — pagos recibidos (parciales o totales)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cobra_payments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id   uuid NOT NULL REFERENCES cobra_invoices(id) ON DELETE CASCADE,
  client_id    uuid NOT NULL REFERENCES cobra_clients(id),
  amount       numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_date timestamptz DEFAULT now(),
  method       text CHECK (method IN ('cash','transfer','check','credit_card','other')),
  reference    text,
  notes        text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cobra_payments_company ON cobra_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_cobra_payments_invoice ON cobra_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_cobra_payments_client  ON cobra_payments(client_id);

-- ============================================================================
-- cobra_reminders — recordatorios enviados
-- ============================================================================
CREATE TABLE IF NOT EXISTS cobra_reminders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id         uuid NOT NULL REFERENCES cobra_invoices(id) ON DELETE CASCADE,
  client_id          uuid NOT NULL REFERENCES cobra_clients(id),
  reminder_type      text NOT NULL CHECK (reminder_type IN ('whatsapp','email','push','call')),
  status             text DEFAULT 'sent' CHECK (status IN ('pending','sent','failed','opened')),
  sent_at            timestamptz DEFAULT now(),
  next_reminder_date date,
  notes              text,
  created_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cobra_reminders_company ON cobra_reminders(company_id);
CREATE INDEX IF NOT EXISTS idx_cobra_reminders_invoice ON cobra_reminders(invoice_id);

-- ============================================================================
-- Vista antigüedad de cartera
-- ============================================================================
CREATE OR REPLACE VIEW cobra_aging_view AS
SELECT
  ci.company_id,
  ci.client_id,
  cc.name                                                         AS client_name,
  cc.phone,
  cc.email,
  COUNT(ci.id)                                                    AS invoice_count,
  SUM(ci.amount - COALESCE(
    (SELECT SUM(cp.amount) FROM cobra_payments cp WHERE cp.invoice_id = ci.id), 0
  ))                                                              AS outstanding_balance,
  MAX(CASE WHEN ci.status = 'overdue' THEN ci.days_overdue ELSE 0 END) AS max_days_overdue,
  COUNT(CASE WHEN ci.status = 'overdue'  THEN 1 END)             AS overdue_count,
  COUNT(CASE WHEN ci.status = 'pending'  THEN 1 END)             AS pending_count,
  COUNT(CASE WHEN ci.status = 'partial'  THEN 1 END)             AS partial_count,
  MIN(ci.due_date)                                                AS oldest_due_date
FROM cobra_invoices ci
JOIN cobra_clients cc ON ci.client_id = cc.id
WHERE ci.status IN ('pending','partial','overdue')
GROUP BY ci.company_id, ci.client_id, cc.name, cc.phone, cc.email;

-- ============================================================================
-- RLS — usa auth_role() definida en init.sql
-- ============================================================================

-- cobra_clients
ALTER TABLE cobra_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cobra_clients_select" ON cobra_clients FOR SELECT
  USING (auth_role(company_id) IS NOT NULL);
CREATE POLICY "cobra_clients_insert" ON cobra_clients FOR INSERT
  WITH CHECK (auth_role(company_id) IN ('owner','admin','supervisor','cobrador'));
CREATE POLICY "cobra_clients_update" ON cobra_clients FOR UPDATE
  USING (auth_role(company_id) IN ('owner','admin','supervisor','cobrador'));
CREATE POLICY "cobra_clients_delete" ON cobra_clients FOR DELETE
  USING (auth_role(company_id) IN ('owner','admin'));

-- cobra_invoices
ALTER TABLE cobra_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cobra_invoices_select" ON cobra_invoices FOR SELECT
  USING (auth_role(company_id) IS NOT NULL);
CREATE POLICY "cobra_invoices_insert" ON cobra_invoices FOR INSERT
  WITH CHECK (auth_role(company_id) IN ('owner','admin','supervisor','cobrador'));
CREATE POLICY "cobra_invoices_update" ON cobra_invoices FOR UPDATE
  USING (auth_role(company_id) IN ('owner','admin','supervisor','cobrador'));
CREATE POLICY "cobra_invoices_delete" ON cobra_invoices FOR DELETE
  USING (auth_role(company_id) IN ('owner','admin'));

-- cobra_payments
ALTER TABLE cobra_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cobra_payments_select" ON cobra_payments FOR SELECT
  USING (auth_role(company_id) IS NOT NULL);
CREATE POLICY "cobra_payments_insert" ON cobra_payments FOR INSERT
  WITH CHECK (auth_role(company_id) IS NOT NULL);
CREATE POLICY "cobra_payments_delete" ON cobra_payments FOR DELETE
  USING (auth_role(company_id) IN ('owner','admin'));

-- cobra_reminders
ALTER TABLE cobra_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cobra_reminders_select" ON cobra_reminders FOR SELECT
  USING (auth_role(company_id) IS NOT NULL);
CREATE POLICY "cobra_reminders_insert" ON cobra_reminders FOR INSERT
  WITH CHECK (auth_role(company_id) IS NOT NULL);

-- ============================================================================
-- Grants
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON cobra_clients   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cobra_invoices  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cobra_payments  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cobra_reminders TO authenticated;
GRANT SELECT ON cobra_aging_view                        TO authenticated;
