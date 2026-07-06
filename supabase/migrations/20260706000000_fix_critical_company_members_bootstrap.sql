-- ============================================================================
-- CRÍTICO: cierra escalación de privilegios en company_members.
-- ============================================================================
-- La política "self bootstrap member" (20260606000001_init.sql) permitía a
-- CUALQUIER usuario autenticado insertarse a sí mismo en company_members con
-- CUALQUIER company_id y CUALQUIER rol (incluido 'owner'), sin validar
-- pertenencia ni que la empresa fuera realmente suya. Cualquier usuario podía
-- volverse "owner" de cualquier empresa ajena y ver/editar TODOS sus datos
-- (gastos, cuentas bancarias, CFDI, etc. — todo lo demás en RLS confía en
-- esta tabla vía auth_is_member()/auth_role()).
--
-- Verificado: NINGÚN flujo legítimo del código depende de un INSERT directo
-- a company_members desde el cliente. Los únicos caminos reales son:
--   - create_company_with_owner() (SECURITY DEFINER, bypassa RLS)
--   - apps/web/app/api/invite/route.ts (usa service_role, bypassa RLS)
--   - supabase/functions/invite-gastador (usa service_role, bypassa RLS)
-- Por lo tanto se elimina la política sin impacto funcional.
-- ============================================================================

DROP POLICY IF EXISTS "self bootstrap member" ON company_members;
