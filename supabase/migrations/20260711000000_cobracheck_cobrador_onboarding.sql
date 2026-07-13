-- CobraCheck — rediseño completo (Admin/Contador/Cobrador):
-- 1) Datos de onboarding del Cobrador, por relación empresa-usuario (el
--    mismo cobrador puede trabajar para varias empresas con datos
--    distintos en cada una) + comisión definida por Admin.
-- 2) Dirección/GPS del cliente, para poder generar rutas.
-- 3) Necesidades/incidencias reportadas en ruta.
-- 4) Depósitos (bancarios o efectivo) con relación a lo cobrado.

alter table company_members
  add column if not exists address              text,
  add column if not exists ine_photo_url         text,
  add column if not exists address_proof_url     text,
  add column if not exists license_photo_url     text,
  add column if not exists vehicle_id            uuid references vehicles(id) on delete set null,
  add column if not exists vehicle_assignment_url text,
  add column if not exists commission_rate       numeric(5,2);

comment on column company_members.commission_rate is 'Porcentaje de comisión sobre lo cobrado (ej. 3.00 = 3%). Lo define Admin al invitar/editar al cobrador.';
comment on column company_members.vehicle_id is 'Vehículo de Flotilla asignado para cobranza, si aplica.';

alter table cobra_clients
  add column if not exists address text,
  add column if not exists lat     numeric(10,6),
  add column if not exists lng     numeric(10,6);

create table if not exists cobra_needs (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  client_id   uuid references cobra_clients(id) on delete set null,
  category    text not null,
  -- domicilio_no_encontrado | requiere_autorizacion | cliente_no_disponible | otro
  notes       text,
  status      text not null default 'open',  -- open | resolved
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists idx_cobra_needs_company on cobra_needs(company_id);
create index if not exists idx_cobra_needs_user on cobra_needs(user_id);

alter table cobra_needs enable row level security;
create policy "members_view_needs" on cobra_needs for select
  using (exists (select 1 from company_members m where m.company_id = cobra_needs.company_id and m.user_id = auth.uid() and m.status = 'active'));
create policy "members_insert_needs" on cobra_needs for insert
  with check (exists (select 1 from company_members m where m.company_id = cobra_needs.company_id and m.user_id = auth.uid() and m.status = 'active'));
create policy "managers_update_needs" on cobra_needs for update
  using (exists (select 1 from company_members m where m.company_id = cobra_needs.company_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin','supervisor','accountant','contador_general')));

create table if not exists cobra_deposits (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  deposit_type   text not null,  -- bank | cash | document
  amount         numeric(12,2) not null,
  deposit_date   date not null default current_date,
  bank_reference text,
  photo_uri      text,
  related_collected numeric(12,2),
  -- suma de cobra_movements.collected_amount del periodo, para mostrar la
  -- relación cobrado-vs-depositado (no se concilia automático, es informativo)
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_cobra_deposits_company on cobra_deposits(company_id);
create index if not exists idx_cobra_deposits_user on cobra_deposits(user_id);

alter table cobra_deposits enable row level security;
create policy "members_view_deposits" on cobra_deposits for select
  using (exists (select 1 from company_members m where m.company_id = cobra_deposits.company_id and m.user_id = auth.uid() and m.status = 'active'));
create policy "members_insert_deposits" on cobra_deposits for insert
  with check (exists (select 1 from company_members m where m.company_id = cobra_deposits.company_id and m.user_id = auth.uid() and m.status = 'active'));
