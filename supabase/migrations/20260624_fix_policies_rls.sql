-- ============================================================================
-- FIX: RLS policies - bloquear edición de pólizas CERRADAS
-- ============================================================================
-- PROBLEMA: Owner/supervisor podían editar pólizas ya cerradas
-- SOLUCIÓN: Actualizar RLS para validar status = 'open' en UPDATE/DELETE

-- Eliminar política antigua (si existe)
DROP POLICY IF EXISTS "manage policies" ON policies;

-- Crear nueva política: READ para todos los miembros
CREATE POLICY "read policies" ON policies
  FOR SELECT
  USING (auth_is_member(company_id));

-- UPDATE/DELETE solo si la póliza está ABIERTA
CREATE POLICY "manage open policies" ON policies
  FOR UPDATE, DELETE
  USING (
    auth_role(company_id) in ('owner','supervisor')
    AND status = 'open'  -- ← CLAVE: solo pólizas abiertas
  )
  WITH CHECK (
    auth_role(company_id) in ('owner','supervisor')
    AND status = 'open'
  );

-- INSERT: cualquier rol puede crear póliza en su empresa
CREATE POLICY "create policies" ON policies
  FOR INSERT
  WITH CHECK (auth_is_member(company_id));

-- Índice de soporte para performance
CREATE INDEX IF NOT EXISTS idx_policies_status_company
  ON policies(company_id, status) WHERE status = 'open';

COMMENT ON POLICY "manage open policies" ON policies IS
  'Bloquea edición/eliminación de pólizas cerradas. Solo owner/supervisor pueden editar pólizas ABIERTAS.';
