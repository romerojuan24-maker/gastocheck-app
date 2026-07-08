-- ============================================================================
-- ADD CLOSED STATUS TO VIATICOS
-- Permite que viáticos pasen: pending → closed (empleado rinde) → approved (contador aprueba)
-- ============================================================================

-- Actualizar constraint para incluir 'closed'
ALTER TABLE viaticos DROP CONSTRAINT viaticos_status_valid;

ALTER TABLE viaticos ADD CONSTRAINT viaticos_status_valid
  CHECK (status IN ('pending', 'closed', 'approved', 'rejected'));

-- Comentario de documentación
COMMENT ON COLUMN viaticos.status IS
  'pending = creado, closed = empleado rinde (listo para contador), approved = contador aprueba, rejected = denegado';
