-- ============================================================================
-- GastoCheck - FIX: Trazabilidad completa de comprobantes
-- Problema: Comprobantes "huérfanos" sin saber en qué póliza/reembolso están
-- Solución: Reconciliación de datos + vistas de trazabilidad
-- ============================================================================

-- 1. IDENTIFICAR COMPROBANTES HUÉRFANOS
WITH expense_state AS (
  SELECT
    e.id,
    e.policy_id,
    e.status,
    COUNT(CASE WHEN p.id IS NULL THEN 1 END) as has_orphan_policy
  FROM expenses e
  LEFT JOIN policies p ON e.policy_id = p.id
  GROUP BY e.id, e.policy_id, e.status
)
SELECT 'Comprobantes sin póliza válida' as diagnostic, COUNT(*) as cantidad
FROM expense_state
WHERE policy_id IS NULL OR has_orphan_policy > 0
GROUP BY policy_id IS NULL;

-- 2. CREAR VISTA: COMPROBANTES CON TRAZABILIDAD COMPLETA
CREATE OR REPLACE VIEW v_expenses_with_traceability AS
SELECT
  e.id as comprobante_id,
  e.company_id,
  e.spender_id,
  u.full_name as spender_name,
  e.policy_id,
  p.name as poliza_name,
  p.status as poliza_status,
  p.period_start,
  p.period_end,
  e.provider_name,
  e.total as monto,
  e.status as comprobante_status,
  e.expense_date as fecha_gasto,
  CASE
    WHEN e.policy_id IS NULL THEN 'SIN ASIGNAR'
    WHEN p.status = 'closed' THEN 'PÓLIZA CERRADA'
    WHEN e.status = 'captured' THEN 'CAPTURADO'
    WHEN e.status = 'pending_auth' THEN 'PENDIENTE AUTORIZACIÓN'
    WHEN e.status = 'authorized' THEN 'AUTORIZADO'
    WHEN e.status = 'invoice_applied' THEN 'FACTURA APLICADA'
    ELSE e.status
  END as estado_trazable,
  (SELECT STRING_AGG(storage_path, ', ') FROM expense_attachments
   WHERE expense_id = e.id) as archivos_adjuntos,
  cfdi.uuid as cfdi_uuid,
  cfdi.rfc_emisor,
  cfdi.rfc_receptor,
  e.created_at,
  e.updated_at
FROM expenses e
LEFT JOIN policies p ON e.policy_id = p.id
LEFT JOIN auth.users u ON e.spender_id = u.id
LEFT JOIN cfdi_data cfdi ON e.id = cfdi.expense_id
ORDER BY e.created_at DESC;

-- 3. CREAR VISTA: PÓLIZAS CON CONTENIDO (comprobantes + montos)
CREATE OR REPLACE VIEW v_policies_with_content AS
SELECT
  p.id as poliza_id,
  p.name as nombre,
  p.status,
  p.period_start,
  p.period_end,
  p.opening_balance,
  p.closing_balance,
  u.full_name as titular,
  COUNT(DISTINCT e.id) as total_comprobantes,
  SUM(e.total) FILTER (WHERE e.status IN ('authorized','invoice_applied')) as total_autorizado,
  SUM(e.total) FILTER (WHERE e.status = 'pending_auth') as total_pendiente_autorización,
  SUM(e.total) FILTER (WHERE e.status = 'captured') as total_capturado,
  SUM(e.total) FILTER (WHERE e.status = 'observed') as total_observado,
  ARRAY_AGG(DISTINCT e.id) FILTER (WHERE e.id IS NOT NULL) as comprobante_ids,
  p.created_at,
  p.closed_at
FROM policies p
LEFT JOIN auth.users u ON p.holder_id = u.id
LEFT JOIN expenses e ON p.id = e.policy_id
GROUP BY p.id, p.name, p.status, p.period_start, p.period_end, p.opening_balance, p.closing_balance, u.full_name, p.created_at, p.closed_at
ORDER BY p.created_at DESC;

-- 4. FUNCIÓN: Obtener estado de navegabilidad de comprobante
CREATE OR REPLACE FUNCTION get_expense_navigation(p_expense_id UUID)
RETURNS TABLE (
  comprobante_id UUID,
  puede_abrir BOOLEAN,
  razon TEXT,
  poliza_id UUID,
  poliza_nombre TEXT,
  link_url TEXT
) LANGUAGE sql STABLE AS $$
SELECT
  e.id,
  CASE
    WHEN e.policy_id IS NULL THEN FALSE
    WHEN p.status = 'closed' THEN TRUE  -- Puede abrirse aunque esté cerrada
    ELSE TRUE
  END as puede_abrir,
  CASE
    WHEN e.policy_id IS NULL THEN 'Sin póliza asignada'
    WHEN e.status = 'captured' THEN 'Capturado - Pendiente autorización'
    WHEN e.status = 'pending_auth' THEN 'Pendiente autorización'
    WHEN e.status = 'authorized' THEN 'Autorizado'
    WHEN e.status = 'invoice_applied' THEN 'Factura aplicada'
    ELSE e.status
  END as razon,
  e.policy_id,
  p.name,
  '/policies/' || e.policy_id || '/expenses/' || e.id as link_url
FROM expenses e
LEFT JOIN policies p ON e.policy_id = p.id
WHERE e.id = p_expense_id;
$$;

-- 5. FUNCIÓN: Listar comprobantes en revisión (sin asignar a póliza)
CREATE OR REPLACE FUNCTION get_expenses_under_review(p_company_id UUID)
RETURNS TABLE (
  comprobante_id UUID,
  proveedor TEXT,
  monto NUMERIC,
  estado TEXT,
  fecha_gasto DATE,
  en_poliza BOOLEAN
) LANGUAGE sql STABLE AS $$
SELECT
  e.id,
  e.provider_name,
  e.total,
  e.status,
  e.expense_date,
  e.policy_id IS NOT NULL
FROM expenses e
WHERE e.company_id = p_company_id
  AND e.status IN ('captured', 'pending_auth', 'observed')
ORDER BY e.created_at DESC;
$$;

-- 6. FUNCIÓN: Listar comprobantes históricos (facturados/cerrados)
CREATE OR REPLACE FUNCTION get_expenses_historical(p_company_id UUID)
RETURNS TABLE (
  comprobante_id UUID,
  proveedor TEXT,
  monto NUMERIC,
  poliza_nombre TEXT,
  fecha_cierre TIMESTAMPTZ,
  en_poliza BOOLEAN
) LANGUAGE sql STABLE AS $$
SELECT
  e.id,
  e.provider_name,
  e.total,
  p.name,
  p.closed_at,
  e.policy_id IS NOT NULL
FROM expenses e
LEFT JOIN policies p ON e.policy_id = p.id
WHERE e.company_id = p_company_id
  AND e.status IN ('invoice_applied', 'closed_in_policy')
ORDER BY COALESCE(p.closed_at, e.updated_at) DESC;
$$;

-- 7. TRIGGERS: Asegurar que expenses siempre tengan policy_id válido
CREATE OR REPLACE FUNCTION validate_expense_policy()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_policy_exists BOOLEAN;
BEGIN
  -- Si no tiene policy_id, auto-crear póliza temporal
  IF NEW.policy_id IS NULL THEN
    INSERT INTO policies (company_id, holder_id, name, opening_balance, created_by)
    VALUES (
      NEW.company_id,
      NEW.spender_id,
      'Póliza Auto-' || TO_CHAR(NOW(), 'YYYYMM'),
      0,
      NEW.spender_id
    )
    RETURNING id INTO NEW.policy_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_expense_policy ON expenses;
CREATE TRIGGER trg_validate_expense_policy
BEFORE INSERT ON expenses
FOR EACH ROW
EXECUTE FUNCTION validate_expense_policy();

-- 8. INDEX: Optimizar queries de trazabilidad
CREATE INDEX IF NOT EXISTS idx_expenses_policy_status
  ON expenses(policy_id, status);
CREATE INDEX IF NOT EXISTS idx_expenses_company_status
  ON expenses(company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_policies_holder_status
  ON policies(holder_id, status);

-- 9. LOG de reconciliación
INSERT INTO expense_audit (company_id, expense_id, action, payload, created_at)
SELECT
  e.company_id,
  e.id,
  'RECONCILIATION_CHECK',
  jsonb_build_object(
    'has_policy', e.policy_id IS NOT NULL,
    'has_cfdi', cfdi.expense_id IS NOT NULL,
    'has_attachments', (SELECT COUNT(*) FROM expense_attachments WHERE expense_id = e.id) > 0,
    'current_status', e.status
  ),
  NOW()
FROM expenses e
LEFT JOIN cfdi_data cfdi ON e.id = cfdi.expense_id
WHERE e.created_at > NOW() - INTERVAL '30 days'
ON CONFLICT DO NOTHING;

-- 10. RLS: Actualizar políticas para vistas
ALTER VIEW v_expenses_with_traceability SET (security_barrier = on);
ALTER VIEW v_policies_with_content SET (security_barrier = on);

-- Grants
GRANT SELECT ON v_expenses_with_traceability TO authenticated;
GRANT SELECT ON v_policies_with_content TO authenticated;
GRANT EXECUTE ON FUNCTION get_expense_navigation TO authenticated;
GRANT EXECUTE ON FUNCTION get_expenses_under_review TO authenticated;
GRANT EXECUTE ON FUNCTION get_expenses_historical TO authenticated;

COMMENT ON VIEW v_expenses_with_traceability IS 'Vista completa de comprobantes con su póliza y estado';
COMMENT ON VIEW v_policies_with_content IS 'Vista de pólizas mostrando comprobantes contenidos y montos';
COMMENT ON FUNCTION get_expense_navigation IS 'Determina si un comprobante es navegable y a dónde enlaza';
COMMENT ON FUNCTION get_expenses_under_review IS 'Comprobantes en revisión que no están en póliza cerrada';
COMMENT ON FUNCTION get_expenses_historical IS 'Comprobantes históricos con su póliza de cierre';
