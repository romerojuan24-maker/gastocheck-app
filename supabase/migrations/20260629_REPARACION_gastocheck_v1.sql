-- ============================================================================
-- REPARACIÓN — GastoCheck v1.0
-- Completa lo que faltó de la migración anterior
-- ============================================================================

-- 1. ELIMINAR VISTA VIATICOS_BY_PERSON (ya es vista, solo recrear)
-- ============================================================================
DROP VIEW IF EXISTS viaticos_by_person CASCADE;

-- 2. CREAR TABLA CONTADOR_GENERAL_ASSIGNMENTS (SI NO EXISTE)
-- ============================================================================
CREATE TABLE IF NOT EXISTS contador_general_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  contador_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_contador_assignments_company ON contador_general_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_contador_assignments_contador ON contador_general_assignments(contador_id);

-- 3. RECREAR VISTAS (DROP + CREATE)
-- ============================================================================

-- Vista: Gastos por comprador
DROP VIEW IF EXISTS expenses_by_buyer CASCADE;
CREATE VIEW expenses_by_buyer AS
SELECT
  e.company_id,
  e.created_by as buyer_id,
  COALESCE(au.email, 'unknown') as buyer_email,
  COUNT(*) as total_expenses,
  SUM(e.total) as total_amount,
  COUNT(CASE WHEN e.status = 'captured' THEN 1 END) as captured_count,
  COUNT(CASE WHEN e.status = 'pending_auth' THEN 1 END) as pending_auth_count,
  COUNT(CASE WHEN e.status = 'authorized' THEN 1 END) as authorized_count,
  COUNT(CASE WHEN e.status = 'closed_in_policy' THEN 1 END) as closed_count,
  MAX(e.created_at) as last_expense_date
FROM expenses e
LEFT JOIN auth.users au ON e.created_by = au.id
WHERE e.company_id IS NOT NULL
GROUP BY e.company_id, e.created_by, au.email;

-- Vista: Viáticos por persona
DROP VIEW IF EXISTS viaticos_by_person CASCADE;
CREATE VIEW viaticos_by_person AS
SELECT
  v.company_id,
  v.person_id,
  COALESCE(au.email, 'unknown') as person_email,
  COUNT(*) as total_viaticos,
  SUM(v.amount) as total_amount,
  COUNT(CASE WHEN v.status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN v.status = 'approved' THEN 1 END) as approved_count,
  COUNT(CASE WHEN v.status = 'rejected' THEN 1 END) as rejected_count,
  MAX(v.created_at) as last_viatico_date
FROM viaticos v
LEFT JOIN auth.users au ON v.person_id = au.id
WHERE v.company_id IS NOT NULL
GROUP BY v.company_id, v.person_id, au.email;

-- Vista: Resumen ejecutivo
DROP VIEW IF EXISTS executive_summary_daily CASCADE;
CREATE VIEW executive_summary_daily AS
SELECT
  c.id as company_id,
  c.name as company_name,
  CURRENT_DATE as date,
  COUNT(DISTINCT e.id) as total_expenses,
  SUM(CASE WHEN e.created_at::DATE = CURRENT_DATE THEN e.total ELSE 0 END) as total_expenses_amount,
  COUNT(DISTINCT CASE WHEN e.created_at::DATE = CURRENT_DATE THEN e.created_by END) as unique_buyers,
  COUNT(DISTINCT CASE WHEN v.created_at::DATE = CURRENT_DATE THEN v.id END) as total_viaticos,
  SUM(CASE WHEN v.created_at::DATE = CURRENT_DATE THEN v.amount ELSE 0 END) as total_viaticos_amount,
  COUNT(DISTINCT CASE WHEN v.created_at::DATE = CURRENT_DATE THEN v.person_id END) as unique_viatico_people,
  COUNT(DISTINCT CASE WHEN e.status = 'pending_auth' AND e.created_at::DATE = CURRENT_DATE THEN e.id END) as pending_reembolsos,
  COUNT(DISTINCT CASE WHEN v.status = 'pending' AND v.created_at::DATE = CURRENT_DATE THEN v.id END) as pending_viaticos,
  SUM(CASE WHEN e.status IN ('captured', 'pending_auth', 'authorized', 'pending_invoice') AND e.created_at::DATE = CURRENT_DATE THEN e.total ELSE 0 END) as money_in_holdover
FROM companies c
LEFT JOIN expenses e ON c.id = e.company_id
LEFT JOIN viaticos v ON c.id = v.company_id
GROUP BY c.id, c.name;

-- 4. VERIFICAR QUE AHORA EXISTA CONTADOR_GENERAL_ASSIGNMENTS
-- ============================================================================
SELECT 'contador_general_assignments' as tabla,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'contador_general_assignments'
  ) THEN 'CREADA ✅' ELSE 'ERROR ❌' END as status;

-- ============================================================================
-- FIN DE REPARACIÓN
-- ============================================================================
