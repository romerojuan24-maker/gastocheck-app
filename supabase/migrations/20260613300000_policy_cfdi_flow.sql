-- ============================================================================
-- GastoCheck — Flujo de pólizas con clasificación CFDI y autorización
-- ============================================================================

-- Columnas SAT en receipts (idempotente — pueden existir de migración anterior)
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS sat_validation_status TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS sat_validation_reason TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS sat_validation_at     TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS receipts_sat_status_idx ON receipts(sat_validation_status);

-- Tipo de comprobante en el gasto (se determina al asignar a póliza)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS cfdi_type TEXT
    CHECK (cfdi_type IN ('con_cfdi','sin_cfdi'))
    DEFAULT NULL;

-- Quién solicitó la póliza (comprador o admin)
ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS gc_folio     TEXT;

-- RLS: compradores pueden crear pólizas para sí mismos
-- (antes solo owner/supervisor)
DROP POLICY IF EXISTS "manage policies" ON policies;

CREATE POLICY "supervisor manage policies" ON policies
  FOR ALL
  USING  (auth_role(company_id) IN ('owner','supervisor'))
  WITH CHECK (auth_role(company_id) IN ('owner','supervisor'));

-- Compradores pueden insertar pólizas donde son el holder
CREATE POLICY "spender create own policy" ON policies
  FOR INSERT
  WITH CHECK (
    auth_is_member(company_id)
    AND holder_id = auth.uid()
  );

-- Compradores pueden ver sus propias pólizas (ya cubierto por policy existente)

-- Vista útil: gastos de una póliza con clasificación y status SAT
CREATE OR REPLACE VIEW policy_expenses_view AS
SELECT
  e.id                    AS expense_id,
  e.policy_id,
  e.company_id,
  e.spender_id,
  e.receipt_id,
  e.provider_name,
  e.provider_rfc,
  e.total,
  e.subtotal,
  e.iva,
  e.expense_date,
  e.status                AS authorization_status,
  e.authorized_by,
  e.authorized_at,
  e.cfdi_type,
  e.notes,
  r.fiscal_uuid,
  r.sat_validation_status,
  r.sat_validation_reason,
  r.sat_validation_at,
  r.file_storage_path,
  r.gc_folio              AS receipt_folio,
  r.ocr_confidence
FROM expenses e
LEFT JOIN receipts r ON r.id = e.receipt_id;

-- Helper: ¿puede un usuario crear pólizas? (owner, supervisor o comprador para sí mismo)
CREATE OR REPLACE FUNCTION can_create_policy(p_company UUID, p_holder UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT
    auth_role(p_company) IN ('owner','supervisor')
    OR (
      auth_is_member(p_company)
      AND p_holder = auth.uid()
    );
$$;

-- Helper: ¿puede autorizar gastos en esta empresa?
CREATE OR REPLACE FUNCTION can_authorize_expenses(p_company UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT auth_role(p_company) IN ('owner','supervisor','admin');
$$;
