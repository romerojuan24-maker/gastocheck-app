-- ============================================================================
-- ADD CLOSED STATUS TO VIATICOS
-- Permite que viáticos pasen: pending → closed (empleado rinde) → approved (contador aprueba)
-- ============================================================================

-- Actualizar constraint para incluir 'closed' -- corregido para reflejar
-- los valores reales que usa el codigo (draft/submitted, no 'pending', que
-- no se usa en ningun lado): apps/mobile/app/viaticos.tsx y
-- supervisor/viaticos-aprobacion.tsx.
ALTER TABLE viaticos DROP CONSTRAINT IF EXISTS viaticos_status_valid;

ALTER TABLE viaticos ADD CONSTRAINT viaticos_status_valid
  CHECK (status IN ('draft', 'submitted', 'closed', 'approved', 'rejected'));

-- Comentario de documentación
COMMENT ON COLUMN viaticos.status IS
  'draft = creando, submitted = enviado a aprobacion, closed = empleado rindio (listo para contador), approved = contador aprueba, rejected = denegado';
