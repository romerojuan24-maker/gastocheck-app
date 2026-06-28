-- ============================================================================
-- GastoCheck v1.0 PERFILAMIENTO MÍNIMO
-- Fecha: 2026-06-27
-- Descripción: Cambios mínimos para preparar GastoCheck v1.0 a venta
-- ============================================================================

-- 1. AGREGAR RASTREO DE QUIÉN CAPTURÓ CADA GASTO (Multi-Comprador)
-- ============================================================================
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_company_created_by ON expenses(company_id, created_by);

-- 2. CREAR TABLA VIÁTICOS (Nueva, no existía)
-- ============================================================================
CREATE TABLE IF NOT EXISTS viaticos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  person_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Quién solicita el viático (puede ser diferente a created_by)

  -- Datos del viático
  amount DECIMAL(12, 2) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'renta_auto', 'presentacion', 'comidas', 'hospedaje', 'transporte', 'otro'
  description TEXT,
  trip_date DATE NOT NULL,
  city VARCHAR(100),

  -- Status y auditoría
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Quién aprobó (contador_general/supervisor)
  approval_reason TEXT, -- Motivo de rechazo si aplica
  approved_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Constraints
  CONSTRAINT viaticos_company_person CHECK (company_id IS NOT NULL AND person_id IS NOT NULL),
  CONSTRAINT viaticos_status_valid CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT viaticos_category_valid CHECK (category IN ('renta_auto', 'presentacion', 'comidas', 'hospedaje', 'transporte', 'otro'))
);

-- Índices para viaticos
CREATE INDEX IF NOT EXISTS idx_viaticos_company_id ON viaticos(company_id);
CREATE INDEX IF NOT EXISTS idx_viaticos_created_by ON viaticos(created_by);
CREATE INDEX IF NOT EXISTS idx_viaticos_person_id ON viaticos(person_id);
CREATE INDEX IF NOT EXISTS idx_viaticos_status ON viaticos(status);
CREATE INDEX IF NOT EXISTS idx_viaticos_company_status ON viaticos(company_id, status);

-- 3. CREAR VISTAS PARA REPORTES POR COMPRADOR
-- ============================================================================

-- Vista: Gastos por comprador (individual)
CREATE OR REPLACE VIEW expenses_by_buyer AS
SELECT
  e.company_id,
  e.created_by as buyer_id,
  p.email as buyer_email,
  COUNT(*) as total_expenses,
  SUM(e.amount) as total_amount,
  COUNT(CASE WHEN e.status = 'captured' THEN 1 END) as captured_count,
  COUNT(CASE WHEN e.status = 'classified' THEN 1 END) as classified_count,
  COUNT(CASE WHEN e.status = 'included_in_batch' THEN 1 END) as batch_count,
  COUNT(CASE WHEN e.status = 'paid' THEN 1 END) as paid_count,
  MAX(e.created_at) as last_expense_date
FROM expenses e
LEFT JOIN profiles p ON e.created_by = p.id
GROUP BY e.company_id, e.created_by, p.email;

-- Vista: Viáticos por persona (individual)
CREATE OR REPLACE VIEW viaticos_by_person AS
SELECT
  v.company_id,
  v.person_id,
  p.email as person_email,
  COUNT(*) as total_viaticos,
  SUM(v.amount) as total_amount,
  COUNT(CASE WHEN v.status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN v.status = 'approved' THEN 1 END) as approved_count,
  COUNT(CASE WHEN v.status = 'rejected' THEN 1 END) as rejected_count,
  MAX(v.created_at) as last_viatico_date
FROM viaticos v
LEFT JOIN profiles p ON v.person_id = p.id
GROUP BY v.company_id, v.person_id, p.email;

-- Vista: Resumen ejecutivo por empresa y período
CREATE OR REPLACE VIEW executive_summary_daily AS
SELECT
  c.id as company_id,
  c.name as company_name,
  DATE_TRUNC('day', e.created_at)::DATE as date,

  -- Gastos
  COUNT(DISTINCT e.id) as total_expenses,
  SUM(e.amount) as total_expenses_amount,
  COUNT(DISTINCT e.created_by) as unique_buyers,

  -- Viáticos
  COUNT(DISTINCT v.id) as total_viaticos,
  SUM(v.amount) as total_viaticos_amount,
  COUNT(DISTINCT v.person_id) as unique_viatico_people,

  -- Status
  COUNT(DISTINCT CASE WHEN e.status = 'pending_supervisor' THEN e.id END) as pending_reembolsos,
  COUNT(DISTINCT CASE WHEN v.status = 'pending' THEN v.id END) as pending_viaticos,

  -- Dinero en resguardo (pólizas pendientes)
  SUM(CASE WHEN e.status IN ('captured', 'classified') THEN e.amount ELSE 0 END) as money_in_holdover

FROM companies c
LEFT JOIN expenses e ON c.id = e.company_id AND DATE_TRUNC('day', e.created_at) = DATE_TRUNC('day', NOW())
LEFT JOIN viaticos v ON c.id = v.company_id AND DATE_TRUNC('day', v.created_at) = DATE_TRUNC('day', NOW())
GROUP BY c.id, c.name, DATE_TRUNC('day', e.created_at);

-- 4. CREAR TABLA PARA ASIGNACIÓN DE CONTADOR GENERAL POR EMPRESA (Configurable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS contador_general_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contador_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Solo un contador general por empresa
  UNIQUE(company_id)
);

CREATE INDEX IF NOT EXISTS idx_contador_assignments_company ON contador_general_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_contador_assignments_contador ON contador_general_assignments(contador_id);

-- 5. ACTUALIZAR RLS POLICIES PARA MULTI-COMPRADOR
-- ============================================================================

-- Para expenses: asegurar que created_by es rastreable
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Policy actualizada: Comprador ve solo sus gastos
CREATE OR REPLACE POLICY "Comprador ve solo sus gastos" ON expenses
FOR SELECT USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = expenses.company_id
    AND user_id = auth.uid()
    AND role IN ('contador_general', 'admin')
  )
);

-- 6. ACTUALIZAR RLS POLICIES PARA VIÁTICOS
-- ============================================================================
ALTER TABLE viaticos ENABLE ROW LEVEL SECURITY;

-- Policy: Persona ve solo sus viáticos
CREATE POLICY "Persona ve solo sus viáticos" ON viaticos
FOR SELECT USING (
  person_id = auth.uid()
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = viaticos.company_id
    AND user_id = auth.uid()
    AND role IN ('contador_general', 'admin')
  )
);

-- Policy: Insertar viáticos (solo persona autorizada o admin)
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

-- Policy: Actualizar viático (contador_general puede aprobar)
CREATE POLICY "Actualizar viático" ON viaticos
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = viaticos.company_id
    AND user_id = auth.uid()
    AND role IN ('contador_general', 'admin')
  )
);

-- 7. ACTUALIZAR RLS POLICIES PARA CONTADOR_GENERAL_ASSIGNMENTS
-- ============================================================================
ALTER TABLE contador_general_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Admin puede ver/crear asignaciones
CREATE POLICY "Admin gestiona contadores" ON contador_general_assignments
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = contador_general_assignments.company_id
    AND user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Policy: Contador puede ver su asignación
CREATE POLICY "Contador ve su asignación" ON contador_general_assignments
FOR SELECT USING (contador_id = auth.uid());

-- 8. TRIGGERS PARA UPDATE_AT (viaticos)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_viaticos_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_viaticos_updated_at ON viaticos;
CREATE TRIGGER update_viaticos_updated_at
BEFORE UPDATE ON viaticos
FOR EACH ROW EXECUTE FUNCTION update_viaticos_updated_at_column();

-- 9. COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================================================
COMMENT ON TABLE viaticos IS 'Viáticos de empleados: hospedaje, comidas, transporte, etc. Multi-persona por empresa.';
COMMENT ON TABLE contador_general_assignments IS 'Asignación configurable de contador general por empresa. Un contador puede tener múltiples empresas.';
COMMENT ON COLUMN expenses.created_by IS 'Rastreo: quién capturó el gasto (comprador). Nuevo en v1.0.';
COMMENT ON COLUMN viaticos.person_id IS 'Quién solicita el viático (puede diferir de created_by si supervisor lo crea).';
COMMENT ON COLUMN viaticos.approval_reason IS 'Si rechazado: motivo (monto excesivo, categoría incorrecta, etc.).';

-- 10. MIGRATION METADATA (Para tracking)
-- ============================================================================
INSERT INTO migration_log (name, executed_at) VALUES (
  '20260627_perfilamiento_gastocheck_v1.sql',
  now()
) ON CONFLICT DO NOTHING;
