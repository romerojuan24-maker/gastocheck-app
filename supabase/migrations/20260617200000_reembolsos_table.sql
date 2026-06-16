-- ── Tabla reembolsos ──────────────────────────────────────────────────────────
-- Flujo: comprador crea draft → agrega comprobantes → envía (pending_auth)
-- Supervisor verifica SAT → cierra (closed) → genera póliza exportable

CREATE TABLE IF NOT EXISTS reembolsos (
  id              uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id      uuid          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id     uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_email  text,
  status          text          NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_auth', 'closed', 'rejected')),
  total           numeric(12,2) NOT NULL DEFAULT 0,
  notes           text          NOT NULL DEFAULT '',
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reembolsos_company    ON reembolsos(company_id);
CREATE INDEX IF NOT EXISTS idx_reembolsos_employee   ON reembolsos(employee_id);
CREATE INDEX IF NOT EXISTS idx_reembolsos_status     ON reembolsos(company_id, status);

-- ── Tabla receipt_reembolsos ───────────────────────────────────────────────────
-- Relación N:N entre comprobantes y reembolsos

CREATE TABLE IF NOT EXISTS receipt_reembolsos (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  reembolso_id  uuid        NOT NULL REFERENCES reembolsos(id) ON DELETE CASCADE,
  receipt_id    uuid        NOT NULL REFERENCES receipts(id)   ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(reembolso_id, receipt_id)
);

CREATE INDEX IF NOT EXISTS idx_rr_reembolso ON receipt_reembolsos(reembolso_id);
CREATE INDEX IF NOT EXISTS idx_rr_receipt   ON receipt_reembolsos(receipt_id);

-- ── Trigger updated_at ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_reembolsos_touch ON reembolsos;
CREATE TRIGGER trg_reembolsos_touch
  BEFORE UPDATE ON reembolsos
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE reembolsos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_reembolsos ENABLE ROW LEVEL SECURITY;

-- reembolsos: miembro de la empresa puede ver todo
CREATE POLICY "members view reembolsos"
  ON reembolsos FOR SELECT
  USING (auth_is_member(company_id));

-- reembolsos: empleado puede insertar solo para sí mismo
CREATE POLICY "employee create reembolso"
  ON reembolsos FOR INSERT
  WITH CHECK (employee_id = auth.uid() AND auth_is_member(company_id));

-- reembolsos: empleado actualiza su propio draft; supervisor actualiza pending_auth/closed
CREATE POLICY "employee or supervisor update reembolso"
  ON reembolsos FOR UPDATE
  USING (
    employee_id = auth.uid()
    OR auth_is_admin(company_id)
  );

-- receipt_reembolsos: miembro de la empresa puede ver (via join en la app)
CREATE POLICY "members view receipt_reembolsos"
  ON receipt_reembolsos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM reembolsos r
      WHERE r.id = reembolso_id
        AND auth_is_member(r.company_id)
    )
  );

-- receipt_reembolsos: empleado puede insertar para su propio reembolso draft
CREATE POLICY "employee add receipt to reembolso"
  ON receipt_reembolsos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reembolsos r
      WHERE r.id = reembolso_id
        AND r.employee_id = auth.uid()
        AND r.status = 'draft'
    )
  );

-- receipt_reembolsos: empleado puede quitar de su propio draft
CREATE POLICY "employee remove receipt from reembolso"
  ON receipt_reembolsos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM reembolsos r
      WHERE r.id = reembolso_id
        AND r.employee_id = auth.uid()
        AND r.status = 'draft'
    )
  );

-- Forzar cache reload de PostgREST
NOTIFY pgrst, 'reload schema';
