-- ============================================================================
-- Consistencia de roles RLS: 'admin' debe tener los mismos derechos de gestión
-- que 'owner' (el creador de empresa vía register-company/create-company es admin).
-- Idempotente.
-- ============================================================================

-- company_members: gestión por owner O admin
drop policy if exists "owner manage members" on company_members;
create policy "owner manage members" on company_members
  for all using (auth_role(company_id) in ('owner','admin'))
  with check (auth_role(company_id) in ('owner','admin'));

-- companies: actualización por owner O admin (la PK de companies es id)
drop policy if exists "owner update company" on companies;
create policy "owner update company" on companies
  for update using (auth_role(id) in ('owner','admin'));

-- accounts_payable: alinear escritura con MANAGER_ROLES de la app (incluye admin)
drop policy if exists ap_write on accounts_payable;
create policy ap_write on accounts_payable
  for all
  using (auth_role(company_id) in ('owner','admin','accountant','supervisor'))
  with check (auth_role(company_id) in ('owner','admin','accountant','supervisor'));
