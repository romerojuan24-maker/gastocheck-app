-- GastoCheck — datos demo para desarrollo.
-- Requiere un usuario en auth.users; sustituye :owner por su UUID.
-- Ejecutar: psql ... -v owner="'00000000-0000-0000-0000-000000000000'" -f supabase/seed.sql

insert into companies (id, name, rfc, plan, plan_seats, created_by)
values ('11111111-1111-1111-1111-111111111111', 'Constructora Demo SA', 'XAXX010101000', 'equipo', 5, :owner);

insert into company_members (company_id, user_id, role)
values ('11111111-1111-1111-1111-111111111111', :owner, 'owner');

insert into expense_categories (company_id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Combustible'),
  ('11111111-1111-1111-1111-111111111111', 'Materiales'),
  ('11111111-1111-1111-1111-111111111111', 'Alimentos'),
  ('11111111-1111-1111-1111-111111111111', 'Peajes');

insert into cost_centers (company_id, name, type, code) values
  ('11111111-1111-1111-1111-111111111111', 'Obra Torre Norte', 'obra', 'OBR-001'),
  ('11111111-1111-1111-1111-111111111111', 'Ruta Centro', 'ruta', 'RTA-001');

insert into policies (id, company_id, holder_id, name, opening_balance, created_by)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
        :owner, 'Póliza Junio — Juan', 2000, :owner);

insert into advances (company_id, policy_id, amount, method, reference, created_by)
values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
        5000, 'transfer', 'SPEI-12345', :owner);
