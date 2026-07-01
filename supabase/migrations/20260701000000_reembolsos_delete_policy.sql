-- Bug: eliminar un reembolso (draft) no lo quitaba de "Mis Reembolsos".
-- Causa: la tabla reembolsos nunca tuvo policy de DELETE (solo INSERT/SELECT/UPDATE),
-- así que el DELETE de la app no fallaba pero tampoco borraba ninguna fila (RLS lo bloqueaba
-- silenciosamente, 0 filas afectadas, sin error).

DROP POLICY IF EXISTS "employee delete own draft reembolso" ON reembolsos;
CREATE POLICY "employee delete own draft reembolso"
  ON reembolsos FOR DELETE
  USING (
    employee_id = auth.uid()
    AND status = 'draft'
  );

NOTIFY pgrst, 'reload schema';
