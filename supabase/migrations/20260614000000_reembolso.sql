-- OTA 11: Soporte para pólizas de reembolso + campo descuento

-- Tipo de póliza: anticipo (flujo normal) vs reembolso (el comprador pagó de su bolsillo)
ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS policy_type TEXT DEFAULT 'anticipo'
    CHECK (policy_type IN ('anticipo', 'reembolso'));

-- Campo descuento en comprobantes (aplica en CFDI y tickets con promociones)
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2);

-- Índice para consulta rápida de comprobantes pendientes por usuario
CREATE INDEX IF NOT EXISTS idx_receipts_uploaded_status
  ON receipts(uploaded_by, status)
  WHERE status NOT IN ('cancelled');

-- Vista para admin: comprobantes sin asignar por empresa (auditoría fin de mes)
CREATE OR REPLACE VIEW unassigned_receipts_summary AS
SELECT
  r.company_id,
  r.uploaded_by,
  p.full_name AS employee_name,
  COUNT(*)                        AS receipt_count,
  SUM(r.total_amount)             AS total_amount,
  MIN(r.receipt_date)             AS oldest_date,
  MAX(r.created_at)               AS latest_scan
FROM receipts r
LEFT JOIN profiles p ON p.id = r.uploaded_by
WHERE r.status = 'captured'
  AND r.uploaded_by IS NOT NULL
GROUP BY r.company_id, r.uploaded_by, p.full_name;

COMMENT ON VIEW unassigned_receipts_summary IS
  'Comprobantes capturados sin asignar a póliza o reembolso — para auditoría de fin de mes';
