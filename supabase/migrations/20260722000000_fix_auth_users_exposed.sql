-- ============================================================================
-- SECURITY FIX — Advisor: auth_users_exposed (CRITICAL)
-- Proyecto: gastocheck (omhycwfjxynkfwywzwvz)
-- Fecha: 2026-07-22
--
-- Problema detectado por el Security Advisor de Supabase:
--   Las vistas `expenses_by_buyer` y `viaticos_by_person` hacían JOIN contra
--   `auth.users` y exponían la columna `email`. Al ser vistas del esquema
--   public accesibles vía API y ejecutarse (por defecto) como SECURITY DEFINER,
--   filtraban el correo de CUALQUIER usuario a cualquiera que consultara la
--   vista, saltándose el RLS de auth.users.
--
-- Solución (raíz, sin perder funcionalidad):
--   1. Se agrega `email` a `profiles` (tabla del esquema public que la app ya
--      controla, con RLS y política "company members read peers" que permite
--      a los miembros de una misma empresa leerse entre sí).
--   2. Se mantiene sincronizado con auth.users mediante un trigger.
--   3. Se reescriben las vistas para leer el email desde `profiles` en lugar
--      de `auth.users` -> deja de referenciar auth.users.
--   4. Las vistas se marcan `security_invoker = on`, de modo que respetan el
--      RLS del usuario que consulta (empresa/rol). anon deja de tener acceso.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles.email + sincronización desde auth.users
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

COMMENT ON COLUMN public.profiles.email IS
  'Espejo de auth.users.email, sincronizado por trigger. Permite resolver el '
  'correo de un usuario respetando el RLS de profiles, sin exponer auth.users.';

-- Crear perfiles faltantes para usuarios existentes sin fila en profiles
INSERT INTO public.profiles (id, email)
SELECT u.id, u.email
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Backfill del email para perfiles existentes
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id
  AND p.email IS DISTINCT FROM u.email;

-- Función + trigger para mantener el email sincronizado
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_email ON auth.users;
CREATE TRIGGER trg_sync_profile_email
AFTER INSERT OR UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

-- ----------------------------------------------------------------------------
-- 2. Vista: Gastos por comprador  (sin auth.users, security_invoker)
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.expenses_by_buyer;
CREATE VIEW public.expenses_by_buyer
WITH (security_invoker = on) AS
SELECT
  e.company_id,
  e.created_by AS buyer_id,
  COALESCE(p.email, 'unknown') AS buyer_email,
  COUNT(*) AS total_expenses,
  SUM(e.total) AS total_amount,
  COUNT(CASE WHEN e.status = 'captured' THEN 1 END) AS captured_count,
  COUNT(CASE WHEN e.status = 'pending_auth' THEN 1 END) AS pending_auth_count,
  COUNT(CASE WHEN e.status = 'authorized' THEN 1 END) AS authorized_count,
  COUNT(CASE WHEN e.status = 'closed_in_policy' THEN 1 END) AS closed_count,
  MAX(e.created_at) AS last_expense_date
FROM public.expenses e
LEFT JOIN public.profiles p ON e.created_by = p.id
WHERE e.company_id IS NOT NULL
GROUP BY e.company_id, e.created_by, p.email;

-- ----------------------------------------------------------------------------
-- 3. Vista: Viáticos por persona  (sin auth.users, security_invoker)
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.viaticos_by_person;
CREATE VIEW public.viaticos_by_person
WITH (security_invoker = on) AS
SELECT
  v.company_id,
  v.person_id,
  COALESCE(p.email, 'unknown') AS person_email,
  COUNT(*) AS total_viaticos,
  SUM(v.amount) AS total_amount,
  COUNT(CASE WHEN v.status = 'pending' THEN 1 END) AS pending_count,
  COUNT(CASE WHEN v.status = 'approved' THEN 1 END) AS approved_count,
  COUNT(CASE WHEN v.status = 'rejected' THEN 1 END) AS rejected_count,
  MAX(v.created_at) AS last_viatico_date
FROM public.viaticos v
LEFT JOIN public.profiles p ON v.person_id = p.id
WHERE v.company_id IS NOT NULL
GROUP BY v.company_id, v.person_id, p.email;

-- ----------------------------------------------------------------------------
-- 4. Vista: Resumen ejecutivo diario  (endurecido con security_invoker)
--    No referencia auth.users, pero se marca security_invoker para que el
--    agregado respete el RLS de companies/expenses/viaticos del usuario.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.executive_summary_daily;
CREATE VIEW public.executive_summary_daily
WITH (security_invoker = on) AS
SELECT
  c.id AS company_id,
  c.name AS company_name,
  CURRENT_DATE AS date,

  COUNT(DISTINCT e.id) AS total_expenses,
  SUM(CASE WHEN e.created_at::DATE = CURRENT_DATE THEN e.total ELSE 0 END) AS total_expenses_amount,
  COUNT(DISTINCT CASE WHEN e.created_at::DATE = CURRENT_DATE THEN e.created_by END) AS unique_buyers,

  COUNT(DISTINCT CASE WHEN v.created_at::DATE = CURRENT_DATE THEN v.id END) AS total_viaticos,
  SUM(CASE WHEN v.created_at::DATE = CURRENT_DATE THEN v.amount ELSE 0 END) AS total_viaticos_amount,
  COUNT(DISTINCT CASE WHEN v.created_at::DATE = CURRENT_DATE THEN v.person_id END) AS unique_viatico_people,

  COUNT(DISTINCT CASE WHEN e.status = 'pending_auth' AND e.created_at::DATE = CURRENT_DATE THEN e.id END) AS pending_reembolsos,
  COUNT(DISTINCT CASE WHEN v.status = 'pending' AND v.created_at::DATE = CURRENT_DATE THEN v.id END) AS pending_viaticos,

  SUM(CASE WHEN e.status IN ('captured', 'pending_auth', 'authorized', 'pending_invoice') AND e.created_at::DATE = CURRENT_DATE THEN e.total ELSE 0 END) AS money_in_holdover

FROM public.companies c
LEFT JOIN public.expenses e ON c.id = e.company_id
LEFT JOIN public.viaticos v ON c.id = v.company_id
GROUP BY c.id, c.name;

-- ----------------------------------------------------------------------------
-- 5. Permisos: quitar acceso a anon, conceder solo a authenticated
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.expenses_by_buyer       FROM anon;
REVOKE ALL ON public.viaticos_by_person      FROM anon;
REVOKE ALL ON public.executive_summary_daily FROM anon;

GRANT SELECT ON public.expenses_by_buyer       TO authenticated;
GRANT SELECT ON public.viaticos_by_person      TO authenticated;
GRANT SELECT ON public.executive_summary_daily TO authenticated;

-- ============================================================================
-- FIN — auth_users_exposed resuelto: ninguna vista public referencia
-- auth.users, y las vistas ahora respetan RLS (security_invoker).
-- ============================================================================
