-- Agrega 'admin' y 'superadmin' a auth_can_view_all y auth_can_authorize
-- El rol 'admin' fue agregado después en enum_roles pero nunca se incluyó en las funciones RLS

CREATE OR REPLACE FUNCTION auth_can_view_all(p_company uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT auth_role(p_company) IN ('owner','admin','superadmin','supervisor','office','accountant');
$$;

CREATE OR REPLACE FUNCTION auth_can_authorize(p_company uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT auth_role(p_company) IN ('owner','admin','superadmin','supervisor');
$$;
