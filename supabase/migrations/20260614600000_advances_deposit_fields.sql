-- Depósitos / anticipos: campos de concepto + comprobante + fixes RLS

-- 1. Nuevos campos en advances
ALTER TABLE advances
  ADD COLUMN IF NOT EXISTS concept        TEXT,
  ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- 2. Admin puede gestionar advances (faltaba igual que en auth_can_view_all)
DROP POLICY IF EXISTS "manage advances" ON advances;
CREATE POLICY "manage advances" ON advances FOR ALL
  USING  (auth_role(company_id) IN ('owner','admin','superadmin','supervisor','office'))
  WITH CHECK (auth_role(company_id) IN ('owner','admin','superadmin','supervisor','office'));

-- 3. Admin puede gestionar policies (necesario para crear póliza al registrar depósito)
DROP POLICY IF EXISTS "manage policies" ON policies;
CREATE POLICY "manage policies" ON policies FOR ALL
  USING  (auth_role(company_id) IN ('owner','admin','superadmin','supervisor'))
  WITH CHECK (auth_role(company_id) IN ('owner','admin','superadmin','supervisor'));

-- 4. Miembros de la misma empresa pueden leer perfiles entre sí (necesario para mostrar nombres)
DROP POLICY IF EXISTS "company members read peers" ON profiles;
CREATE POLICY "company members read peers" ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM company_members cm1
      JOIN company_members cm2 ON cm1.company_id = cm2.company_id
      WHERE cm1.user_id = auth.uid() AND cm1.status = 'active'
        AND cm2.user_id = profiles.id  AND cm2.status = 'active'
    )
  );
