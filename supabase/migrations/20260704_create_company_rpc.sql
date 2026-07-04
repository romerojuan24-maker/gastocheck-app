-- RPC para crear empresa + owner en una sola transacción (bypassa RLS)
create or replace function public.create_company_with_owner(p_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_company_id uuid;
  v_user_id    uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Usuario no autenticado. Cierra la app y vuelve a entrar.';
  end if;

  insert into companies (name, moneda, plan, plan_seats, created_by)
  values (p_name, 'MXN', 'basico', 2, v_user_id)
  returning id into v_company_id;

  insert into company_members (company_id, user_id, role, status)
  values (v_company_id, v_user_id, 'owner', 'active');

  return v_company_id;
end;
$$;
