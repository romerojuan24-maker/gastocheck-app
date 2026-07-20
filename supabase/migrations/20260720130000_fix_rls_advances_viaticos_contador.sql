-- ============================================================================
-- FASE 2c — RLS por perfil: anticipos desde panel contador + viáticos visibles
-- (hallazgos reportados por Juan 2026-07-20, verificados contra migraciones)
--
-- 1) "new row violates row-level security policy for table advances":
--    'manage advances' (20260614600000) permite owner/admin/superadmin/
--    supervisor/office pero NO accountant ni contador_general. El panel del
--    contador (admin-panel.tsx / supervisor.tsx) ofrece "Registrar Anticipo",
--    asi que en un telefono con sesion de contador el INSERT truena y en el
--    de admin funciona. Igual pasa con 'manage policies' (el flujo crea una
--    poliza automatica si no se elige una).
--
-- 2) Viaticos: el SELECT de viaticos solo permite person_id/created_by o
--    roles ('accountant','admin') — owner, supervisor y contador_general
--    quedan fuera y no ven viaticos registrados por otros.
--
-- Idempotente: seguro re-ejecutar. Pegar completo en Supabase SQL Editor.
-- ============================================================================

-- ── 1. Anticipos y polizas: agregar contadores ──────────────────────────────

DROP POLICY IF EXISTS "manage advances" ON advances;
CREATE POLICY "manage advances" ON advances FOR ALL
  USING      (auth_role(company_id) IN ('owner','admin','superadmin','supervisor','office','accountant','contador_general'))
  WITH CHECK (auth_role(company_id) IN ('owner','admin','superadmin','supervisor','office','accountant','contador_general'));

DROP POLICY IF EXISTS "manage policies" ON policies;
CREATE POLICY "manage policies" ON policies FOR ALL
  USING      (auth_role(company_id) IN ('owner','admin','superadmin','supervisor','accountant','contador_general'))
  WITH CHECK (auth_role(company_id) IN ('owner','admin','superadmin','supervisor','accountant','contador_general'));

-- ── 2. Viaticos: roles gerenciales ven y gestionan todos los de la empresa ──

DROP POLICY IF EXISTS "Persona ve solo sus viáticos" ON viaticos;
CREATE POLICY "Persona ve solo sus viáticos" ON viaticos
FOR SELECT USING (
  person_id = auth.uid()
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = viaticos.company_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND role IN ('owner','admin','superadmin','supervisor','accountant','contador_general')
  )
);

DROP POLICY IF EXISTS "Actualizar viático" ON viaticos;
CREATE POLICY "Actualizar viático" ON viaticos
FOR UPDATE USING (
  person_id = auth.uid()
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = viaticos.company_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND role IN ('owner','admin','superadmin','supervisor','accountant','contador_general')
  )
);

NOTIFY pgrst, 'reload schema';
