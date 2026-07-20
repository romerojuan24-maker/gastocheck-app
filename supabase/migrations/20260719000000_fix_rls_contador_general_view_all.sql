-- Agrega 'contador_general' a auth_can_view_all (RLS)
-- NOTA: Ya ejecutada manualmente en Supabase SQL Editor el 2026-07-20.
-- Este archivo existe para que el historial de migraciones refleje la BD viva.
-- Sin este rol, contador_general no podia ver receipts de otros empleados.

CREATE OR REPLACE FUNCTION auth_can_view_all(p_company uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT auth_role(p_company) IN ('owner','admin','superadmin','supervisor','office','accountant','contador_general');
$$;

NOTIFY pgrst, 'reload schema';
