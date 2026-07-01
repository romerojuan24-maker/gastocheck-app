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

-- 2. TABLA VIÁTICOS — ya existía (modelo simple: employee_id/destination/etc.),
--    aquí solo agregamos las columnas que el código mobile también necesita
--    (created_by, person_id, amount, category, trip_date, approval).
--    Sin CHECK NOT NULL nuevos: hay filas existentes sin estos valores.
-- ============================================================================
CREATE TABLE IF NOT EXISTS viaticos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE viaticos
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Quién solicita el viático (puede ser diferente a created_by)
  ADD COLUMN IF NOT EXISTS amount DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS category VARCHAR(50), -- 'renta_auto', 'presentacion', 'comidas', 'hospedaje', 'transporte', 'otro'
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS trip_date DATE,
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Quién aprobó (contador_general/supervisor)
  ADD COLUMN IF NOT EXISTS approval_reason TEXT; -- Motivo de rechazo si aplica

ALTER TABLE viaticos ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Índices para viaticos
CREATE INDEX IF NOT EXISTS idx_viaticos_company_id ON viaticos(company_id);
CREATE INDEX IF NOT EXISTS idx_viaticos_created_by ON viaticos(created_by);
CREATE INDEX IF NOT EXISTS idx_viaticos_person_id ON viaticos(person_id);
CREATE INDEX IF NOT EXISTS idx_viaticos_status ON viaticos(status);
CREATE INDEX IF NOT EXISTS idx_viaticos_company_status ON viaticos(company_id, status);

-- 3. VISTAS DE REPORTES — omitidas: usaban valores de expense_status que no
--    existen en el enum real (classified/included_in_batch/paid/pending_supervisor)
--    y solo las consumía contador-general.tsx, ya reemplazado por
--    contador-general/page.tsx (que consulta receipts/reembolsos/policies directo).
-- ============================================================================

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

-- 6. ACTUALIZAR RLS POLICIES PARA VIÁTICOS
-- ============================================================================
ALTER TABLE viaticos ENABLE ROW LEVEL SECURITY;

-- Policy: Persona ve solo sus viáticos
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

-- Policy: Insertar viáticos (solo persona autorizada o admin)
DROP POLICY IF EXISTS "Crear viático" ON viaticos;
CREATE POLICY "Crear viático" ON viaticos
FOR INSERT WITH CHECK (
  created_by = auth.uid()
  OR person_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM company_members
    WHERE company_members.company_id = viaticos.company_id
    AND user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Policy: Actualizar viático (contador_general puede aprobar)
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

-- 7. ACTUALIZAR RLS POLICIES PARA CONTADOR_GENERAL_ASSIGNMENTS
-- ============================================================================
ALTER TABLE contador_general_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Admin puede ver/crear asignaciones
DROP POLICY IF EXISTS "Admin gestiona contadores" ON contador_general_assignments;
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
DROP POLICY IF EXISTS "Contador ve su asignación" ON contador_general_assignments;
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
