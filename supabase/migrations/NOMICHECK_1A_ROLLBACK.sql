-- ============================================================================
-- NÓMINACHECK — FASE 1A · ROLLBACK CONTROLADO  ·  NO es migración
-- ----------------------------------------------------------------------------
-- Revierte 20260722210000_nomicheck_secure_schema.sql en orden seguro.
-- ⚠️ SOLO usar ANTES de que existan datos reales (retira todo el esquema).
--    Con datos reales NO usar DROP: deshabilitar vía política restrictiva,
--    respaldar y preservar auditoría.
-- No usa comodines; no toca objetos compartidos (audit_logs, companies,
-- company_members, member_role, touch_updated_at, pgp_*). Idempotente (IF EXISTS).
-- ============================================================================

-- 1. Capa estable de FlujoCheck (vistas)
DROP VIEW IF EXISTS public.nomi_cashflow_commitments;
DROP VIEW IF EXISTS public.nomi_employees_directory;   -- por si quedó de una versión previa

-- 2. Tablas nomi_* (CASCADE retira sus policies, triggers, grants e índices;
--    orden hijo→padre por las FK internas).
DROP TABLE IF EXISTS public.nomi_employee_bank_accounts CASCADE;
DROP TABLE IF EXISTS public.nomi_tax_withholdings       CASCADE;
DROP TABLE IF EXISTS public.nomi_attendance             CASCADE;
DROP TABLE IF EXISTS public.nomi_payroll                CASCADE;
DROP TABLE IF EXISTS public.nomi_employees              CASCADE;
DROP TABLE IF EXISTS public.nomi_user_scopes            CASCADE;
DROP TABLE IF EXISTS public.nomi_user_capabilities      CASCADE;
DROP TABLE IF EXISTS public.nomi_role_capabilities      CASCADE;
DROP TABLE IF EXISTS public.nomi_capabilities           CASCADE;

-- 3. Funciones y RPC (ya sin policies que las referencien).
DROP FUNCTION IF EXISTS public.nomi_approve_payroll(uuid, integer, text);
DROP FUNCTION IF EXISTS public.nomi_get_employee_directory(uuid);
DROP FUNCTION IF EXISTS public.nomi_payroll_summary(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.nomi_can(uuid, text);
DROP FUNCTION IF EXISTS public.nomi_in_scope(uuid, uuid);
DROP FUNCTION IF EXISTS public.nomi_is_self_payroll(uuid);
DROP FUNCTION IF EXISTS public.nomi_payroll_approval_guard();
DROP FUNCTION IF EXISTS public.nomi_audit_employee();
DROP FUNCTION IF EXISTS public.nomi_audit_payroll_status();
DROP FUNCTION IF EXISTS public.nomi_audit_capability();
DROP FUNCTION IF EXISTS public.nomi_safe_employee_snapshot(public.nomi_employees);
DROP FUNCTION IF EXISTS public.nomi_blind_hash(text, text);

-- 4. Grant compartido añadido por la migración (audit_logs). Se REVOCA solo si
--    quieres dejar audit_logs exactamente como estaba; es inocuo dejarlo.
--    REVOKE INSERT ON public.audit_logs FROM service_role;   -- (opcional)

-- 5. Registro de migración (si se registró la versión):
--    DELETE FROM supabase_migrations.schema_migrations WHERE version='20260722210000';

NOTIFY pgrst, 'reload schema';
