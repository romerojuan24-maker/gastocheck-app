-- ============================================================================
-- GASTOCHECK v1.0 — MIGRACIÓN CORREGIDA
-- Fecha: 2026-06-29
-- Basada en estructura REAL de Supabase
-- ============================================================================

-- 1. CREAR TABLA VIÁTICOS (NUEVA)
-- ============================================================================
CREATE TABLE IF NOT EXISTS viaticos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  person_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Datos del viático
  amount NUMERIC(12, 2) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  trip_date DATE NOT NULL,
  city VARCHAR(100),

  -- Status y auditoría
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approval_reason TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Constraints
  CONSTRAINT viaticos_status_valid CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT viaticos_category_valid CHECK (category IN ('renta_auto', 'presentacion', 'comidas', 'hospedaje', 'transporte', 'otro'))
);

-- Índices para viaticos
CREATE INDEX IF NOT EXISTS idx_viaticos_company_id ON viaticos(company_id);
CREATE INDEX IF NOT EXISTS idx_viaticos_created_by ON viaticos(created_by);
CREATE INDEX IF NOT EXISTS idx_viaticos_person_id ON viaticos(person_id);
CREATE INDEX IF NOT EXISTS idx_viaticos_status ON viaticos(status);
CREATE INDEX IF NOT EXISTS idx_viaticos_company_status ON viaticos(company_id, status);

-- 2. CREAR TABLA CONTADOR_GENERAL_ASSIGNMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS accountant_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  contador_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_contador_assignments_company ON accountant_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_contador_assignments_contador ON accountant_assignments(contador_id);

-- 3. AGREGAR COLUMNAS A EXPENSES PARA RASTREAR QUIÉN CAPTURÓ (si no existen)
-- ============================================================================
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_company_created_by ON expenses(company_id, created_by);

-- 4. CREAR VISTAS PARA REPORTES POR COMPRADOR
-- ============================================================================

-- Vista: Gastos por comprador (individual)
-- Nota: expenses tiene columnas: total, subtotal, iva (no amount)
DROP VIEW IF EXISTS expenses_by_buyer;
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

-- Vista: Viáticos por persona (individual)
DROP VIEW IF EXISTS viaticos_by_person;
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

-- Vista: Resumen ejecutivo por empresa y período
-- Nota: usa total de expenses, no amount
DROP VIEW IF EXISTS executive_summary_daily;
CREATE VIEW executive_summary_daily AS
SELECT
  c.id as company_id,
  c.name as company_name,
  CURRENT_DATE as date,

  -- Gastos
  COUNT(DISTINCT e.id) as total_expenses,
  SUM(CASE WHEN e.created_at::DATE = CURRENT_DATE THEN e.total ELSE 0 END) as total_expenses_amount,
  COUNT(DISTINCT CASE WHEN e.created_at::DATE = CURRENT_DATE THEN e.created_by END) as unique_buyers,

  -- Viáticos
  COUNT(DISTINCT CASE WHEN v.created_at::DATE = CURRENT_DATE THEN v.id END) as total_viaticos,
  SUM(CASE WHEN v.created_at::DATE = CURRENT_DATE THEN v.amount ELSE 0 END) as total_viaticos_amount,
  COUNT(DISTINCT CASE WHEN v.created_at::DATE = CURRENT_DATE THEN v.person_id END) as unique_viatico_people,

  -- Status
  COUNT(DISTINCT CASE WHEN e.status = 'pending_auth' AND e.created_at::DATE = CURRENT_DATE THEN e.id END) as pending_reembolsos,
  COUNT(DISTINCT CASE WHEN v.status = 'pending' AND v.created_at::DATE = CURRENT_DATE THEN v.id END) as pending_viaticos,

  -- Dinero en resguardo (pólizas pendientes)
  SUM(CASE WHEN e.status IN ('captured', 'pending_auth', 'authorized', 'pending_invoice') AND e.created_at::DATE = CURRENT_DATE THEN e.total ELSE 0 END) as money_in_holdover

FROM companies c
LEFT JOIN expenses e ON c.id = e.company_id
LEFT JOIN viaticos v ON c.id = v.company_id
GROUP BY c.id, c.name;

-- 5. ACTUALIZAR RLS POLICIES PARA EXPENSES
-- ============================================================================

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comprador ve solo sus gastos" ON expenses;
CREATE POLICY "Comprador ve solo sus gastos" ON expenses
FOR SELECT USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = expenses.company_id
    AND user_id = auth.uid()
    AND role IN ('accountant', 'admin')
  )
);

-- 6. RLS PARA VIÁTICOS
-- ============================================================================

ALTER TABLE viaticos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Persona ve solo sus viáticos" ON viaticos;
CREATE POLICY "Persona ve solo sus viáticos" ON viaticos
FOR SELECT USING (
  person_id = auth.uid()
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = viaticos.company_id
    AND user_id = auth.uid()
    AND role IN ('accountant', 'admin')
  )
);

DROP POLICY IF EXISTS "Crear viático" ON viaticos;
CREATE POLICY "Crear viático" ON viaticos
FOR INSERT WITH CHECK (
  created_by = auth.uid()
  OR person_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = company_id
    AND user_id = auth.uid()
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Actualizar viático" ON viaticos;
CREATE POLICY "Actualizar viático" ON viaticos
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = viaticos.company_id
    AND user_id = auth.uid()
    AND role IN ('accountant', 'admin')
  )
);

-- 7. RLS PARA CONTADOR_GENERAL_ASSIGNMENTS
-- ============================================================================

ALTER TABLE accountant_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gestiona contadores" ON accountant_assignments;
CREATE POLICY "Admin gestiona contadores" ON accountant_assignments
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = accountant_assignments.company_id
    AND user_id = auth.uid()
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Contador ve su asignación" ON accountant_assignments;
CREATE POLICY "Contador ve su asignación" ON accountant_assignments
FOR SELECT USING (contador_id = auth.uid());

-- 8. TRIGGERS PARA UPDATED_AT
-- ============================================================================

DROP TRIGGER IF EXISTS update_viaticos_updated_at ON viaticos;
DROP FUNCTION IF EXISTS update_viaticos_updated_at_column();

CREATE FUNCTION update_viaticos_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_viaticos_updated_at
BEFORE UPDATE ON viaticos
FOR EACH ROW EXECUTE FUNCTION update_viaticos_updated_at_column();

-- 9. COMENTARIOS DOCUMENTATIVOS
-- ============================================================================

COMMENT ON TABLE viaticos IS 'Viáticos de empleados: hospedaje, comidas, transporte, etc.';
COMMENT ON TABLE accountant_assignments IS 'Asignación configurable de contador general por empresa (1:1).';
COMMENT ON COLUMN expenses.created_by IS 'Rastreo: quién capturó el gasto (comprador).';
COMMENT ON COLUMN viaticos.person_id IS 'Quién solicita el viático (puede diferir de created_by).';
COMMENT ON COLUMN viaticos.approval_reason IS 'Si rechazado: motivo (monto excesivo, categoría incorrecta, etc.).';

-- ============================================================================
-- FIN DE MIGRACIÓN — LISTO PARA EJECUTAR
-- ============================================================================
