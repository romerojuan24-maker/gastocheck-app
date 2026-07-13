-- ============================================================================
-- FIX RECEIPT_REEMBOLSOS RLS POLICIES
-- Permitir que empleados agreguen receipts a sus reembolsos draft
-- ============================================================================

-- Eliminar políticas existentes que están rompiendo inserts
DROP POLICY IF EXISTS "employee add receipt to reembolso" ON receipt_reembolsos;
DROP POLICY IF EXISTS "employee remove receipt from reembolso" ON receipt_reembolsos;

-- Nueva política: INSERT - empleado puede agregar receipts a su reembolso draft
-- IMPORTANTE: Requiere que la app verifique:
--   1. El receipt es del mismo company_id
--   2. El reembolso es del mismo company_id
--   3. El reembolso está en status='draft'
CREATE POLICY "employee insert receipt to reembolso"
  ON receipt_reembolsos FOR INSERT
  WITH CHECK (
    -- Verificar que el usuario es miembro de la empresa del reembolso
    EXISTS (
      SELECT 1 FROM reembolsos r
      WHERE r.id = reembolso_id
        AND auth_is_member(r.company_id)
    )
    -- Y verificar que el receipt pertenece a la misma empresa
    AND EXISTS (
      SELECT 1 FROM receipts rc
      WHERE rc.id = receipt_id
        AND rc.company_id = (
          SELECT company_id FROM reembolsos WHERE id = reembolso_id
        )
    )
  );

-- Nueva política: DELETE
CREATE POLICY "employee delete receipt from reembolso"
  ON receipt_reembolsos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM reembolsos r
      WHERE r.id = reembolso_id
        AND auth_is_member(r.company_id)
    )
  );
