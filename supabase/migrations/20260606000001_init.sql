-- ============================================================================
-- GastoCheck — Esquema inicial (multi-tenant con RLS)
-- Postgres 15 / Supabase
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
-- Enum completo desde el inicio para que el folder sea replayable en limpio
-- (migraciones posteriores hacen ALTER TYPE ADD VALUE IF NOT EXISTS → no-op).
-- Producción no re-ejecuta init, así que este cambio no la afecta.
create type member_role   as enum ('owner','supervisor','spender','office','accountant','operator','admin','superadmin','cobrador','buyer','viewer','collector','contador_general');
create type member_status as enum ('active','invited','disabled');
create type company_plan  as enum ('basico','equipo','empresa','corporativo');
create type cost_center_type as enum ('obra','ruta','proyecto','lote','cliente','unidad','sucursal','otro');
create type advance_method as enum ('transfer','cash','card','other');
create type policy_status  as enum ('open','closed');
create type attachment_kind as enum ('ticket','pdf','xml','payment','receipt');
create type expense_status as enum (
  'captured','pending_auth','authorized','pending_invoice',
  'invoice_applied','observed','rejected','deleted','duplicate','closed_in_policy'
);

-- ----------------------------------------------------------------------------
-- PROFILES (extiende auth.users)
-- ----------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- COMPANIES (tenant)
-- ----------------------------------------------------------------------------
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rfc text,
  plan company_plan not null default 'basico',
  plan_seats int not null default 2,
  created_by uuid not null references auth.users(id),
  allow_supervisor_close boolean not null default false,
  created_at timestamptz not null default now()
);

create table company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null,
  status member_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index on company_members(user_id);
create index on company_members(company_id);

-- ----------------------------------------------------------------------------
-- HELPERS de autorización (security definer para evitar recursión RLS)
-- ----------------------------------------------------------------------------
create or replace function auth_is_member(p_company uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from company_members m
    where m.company_id = p_company
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function auth_role(p_company uuid)
returns member_role language sql security definer stable as $$
  select role from company_members m
  where m.company_id = p_company and m.user_id = auth.uid() and m.status = 'active'
  limit 1;
$$;

-- ¿puede ver TODOS los gastos de la empresa? (no spender)
create or replace function auth_can_view_all(p_company uuid)
returns boolean language sql security definer stable as $$
  select auth_role(p_company) in ('owner','supervisor','office','accountant');
$$;

-- ¿puede autorizar?
create or replace function auth_can_authorize(p_company uuid)
returns boolean language sql security definer stable as $$
  select auth_role(p_company) in ('owner','supervisor');
$$;

-- ----------------------------------------------------------------------------
-- CATÁLOGOS
-- ----------------------------------------------------------------------------
create table accounting_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  account_type text,
  active boolean not null default true,
  unique (company_id, code)
);

create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  parent_id uuid references expense_categories(id) on delete set null,
  default_account_id uuid references accounting_accounts(id) on delete set null,
  active boolean not null default true
);

create table cost_centers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  type cost_center_type not null default 'proyecto',
  code text,
  active boolean not null default true
);

-- ----------------------------------------------------------------------------
-- POLIZAS
-- ----------------------------------------------------------------------------
create table policies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  holder_id uuid not null references auth.users(id),   -- persona que gasta
  name text not null,
  period_start date,
  period_end date,
  opening_balance numeric(14,2) not null default 0,
  closing_balance numeric(14,2),
  status policy_status not null default 'open',
  previous_policy_id uuid references policies(id),
  closed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index on policies(company_id, holder_id, status);

-- ----------------------------------------------------------------------------
-- ANTICIPOS
-- ----------------------------------------------------------------------------
create table advances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  policy_id uuid not null references policies(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  method advance_method not null default 'transfer',
  reference text,
  date date not null default current_date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index on advances(policy_id);

-- ----------------------------------------------------------------------------
-- GASTOS
-- ----------------------------------------------------------------------------
create table expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  policy_id uuid not null references policies(id),
  spender_id uuid not null references auth.users(id),
  category_id uuid references expense_categories(id),
  cost_center_id uuid references cost_centers(id),
  provider_name text,
  provider_rfc text,
  subtotal numeric(14,2),
  iva numeric(14,2),
  total numeric(14,2) not null default 0,
  expense_date date,
  status expense_status not null default 'captured',
  notes text,
  authorized_by uuid references auth.users(id),
  authorized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on expenses(company_id, status);
create index on expenses(policy_id);
create index on expenses(spender_id);

-- Datos fiscales del CFDI (1:1)
create table cfdi_data (
  expense_id uuid primary key references expenses(id) on delete cascade,
  uuid text,
  rfc_emisor text,
  rfc_receptor text,
  subtotal numeric(14,2),
  iva numeric(14,2),
  total numeric(14,2),
  fecha timestamptz,
  metodo_pago text,
  forma_pago text,
  conceptos jsonb,
  created_at timestamptz not null default now()
);
create index on cfdi_data(uuid);

create table expense_attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  expense_id uuid not null references expenses(id) on delete cascade,
  kind attachment_kind not null,
  storage_path text not null,
  mime text,
  ocr_raw jsonb,
  created_at timestamptz not null default now()
);
create index on expense_attachments(expense_id);

-- Historial inmutable
create table expense_audit (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  expense_id uuid not null references expenses(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  from_status expense_status,
  to_status expense_status,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index on expense_audit(expense_id);

-- Invitaciones
create table invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  role member_role not null,
  email text,
  phone text,
  token text not null unique default encode(gen_random_bytes(16),'hex'),
  accepted boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days'
);

-- Registro de exports
create table report_exports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  kind text not null,            -- 'excel' | 'zip'
  storage_path text,
  signed_url text,
  params jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- ----------------------------------------------------------------------------
-- TRIGGERS: saldo de póliza
-- ----------------------------------------------------------------------------
create or replace function recompute_policy_closing()
returns trigger language plpgsql as $$
declare v_policy uuid;
begin
  v_policy := coalesce(new.policy_id, old.policy_id);
  update policies p
  set closing_balance =
        p.opening_balance
        + coalesce((select sum(a.amount) from advances a where a.policy_id = p.id), 0)
        - coalesce((select sum(e.total) from expenses e
                    where e.policy_id = p.id
                      and e.status in ('authorized','invoice_applied','closed_in_policy')), 0)
  where p.id = v_policy;
  return null;
end;
$$;

create trigger trg_advances_balance
  after insert or update or delete on advances
  for each row execute function recompute_policy_closing();

create trigger trg_expenses_balance
  after insert or update or delete on expenses
  for each row execute function recompute_policy_closing();

-- updated_at
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger trg_expenses_touch before update on expenses
  for each row execute function touch_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table profiles            enable row level security;
alter table companies           enable row level security;
alter table company_members     enable row level security;
alter table accounting_accounts enable row level security;
alter table expense_categories  enable row level security;
alter table cost_centers        enable row level security;
alter table policies            enable row level security;
alter table advances            enable row level security;
alter table expenses            enable row level security;
alter table cfdi_data           enable row level security;
alter table expense_attachments enable row level security;
alter table expense_audit       enable row level security;
alter table invitations         enable row level security;
alter table report_exports      enable row level security;

-- profiles: cada quien su perfil
create policy "own profile" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- companies: miembros leen; owner edita; cualquiera crea (se vuelve owner vía trigger app)
create policy "members read company" on companies
  for select using (auth_is_member(id));
create policy "owner update company" on companies
  for update using (auth_role(id) = 'owner');
create policy "create company" on companies
  for insert with check (created_by = auth.uid());

-- company_members: miembros leen los de su empresa; owner gestiona
create policy "members read members" on company_members
  for select using (auth_is_member(company_id));
create policy "owner manage members" on company_members
  for all using (auth_role(company_id) = 'owner')
  with check (auth_role(company_id) = 'owner');
-- bootstrap: el creador puede insertarse como owner
create policy "self bootstrap member" on company_members
  for insert with check (user_id = auth.uid());

-- catálogos: miembros leen; owner/supervisor escriben (cuentas: + accountant)
create policy "read accounts" on accounting_accounts for select using (auth_is_member(company_id));
create policy "manage accounts" on accounting_accounts for all
  using (auth_role(company_id) in ('owner','accountant'))
  with check (auth_role(company_id) in ('owner','accountant'));

create policy "read categories" on expense_categories for select using (auth_is_member(company_id));
create policy "manage categories" on expense_categories for all
  using (auth_role(company_id) in ('owner','supervisor'))
  with check (auth_role(company_id) in ('owner','supervisor'));

create policy "read cost centers" on cost_centers for select using (auth_is_member(company_id));
create policy "manage cost centers" on cost_centers for all
  using (auth_role(company_id) in ('owner','supervisor'))
  with check (auth_role(company_id) in ('owner','supervisor'));

-- policies: ver todos (no-spender) o el holder ve la suya; owner/supervisor gestionan
create policy "read policies" on policies for select
  using (auth_is_member(company_id) and (auth_can_view_all(company_id) or holder_id = auth.uid()));
create policy "manage policies" on policies for all
  using (auth_role(company_id) in ('owner','supervisor'))
  with check (auth_role(company_id) in ('owner','supervisor'));

-- advances
create policy "read advances" on advances for select
  using (auth_is_member(company_id) and (auth_can_view_all(company_id)
         or exists (select 1 from policies p where p.id = policy_id and p.holder_id = auth.uid())));
create policy "manage advances" on advances for all
  using (auth_role(company_id) in ('owner','supervisor','office'))
  with check (auth_role(company_id) in ('owner','supervisor','office'));

-- expenses: spender ve/crea los suyos; el resto según rol
create policy "read expenses" on expenses for select
  using (auth_is_member(company_id) and (auth_can_view_all(company_id) or spender_id = auth.uid()));
create policy "spender insert own expense" on expenses for insert
  with check (auth_is_member(company_id) and spender_id = auth.uid());
create policy "office insert expense" on expenses for insert
  with check (auth_role(company_id) in ('owner','supervisor','office'));
create policy "update own draft expense" on expenses for update
  using (spender_id = auth.uid() and status in ('captured','pending_auth','observed'))
  with check (spender_id = auth.uid());
create policy "authorizer update expense" on expenses for update
  using (auth_can_authorize(company_id))
  with check (auth_can_authorize(company_id));
create policy "office update expense" on expenses for update
  using (auth_role(company_id) in ('owner','supervisor','office'))
  with check (auth_role(company_id) in ('owner','supervisor','office'));

-- cfdi_data / attachments / audit: siguen visibilidad del gasto padre
create policy "read cfdi" on cfdi_data for select
  using (exists (select 1 from expenses e where e.id = expense_id
                 and auth_is_member(e.company_id)
                 and (auth_can_view_all(e.company_id) or e.spender_id = auth.uid())));
create policy "write cfdi" on cfdi_data for all
  using (exists (select 1 from expenses e where e.id = expense_id and auth_is_member(e.company_id)))
  with check (exists (select 1 from expenses e where e.id = expense_id and auth_is_member(e.company_id)));

create policy "read attachments" on expense_attachments for select
  using (auth_is_member(company_id) and (auth_can_view_all(company_id)
         or exists (select 1 from expenses e where e.id = expense_id and e.spender_id = auth.uid())));
create policy "write attachments" on expense_attachments for all
  using (auth_is_member(company_id)) with check (auth_is_member(company_id));

create policy "read audit" on expense_audit for select using (auth_is_member(company_id));
create policy "insert audit" on expense_audit for insert with check (auth_is_member(company_id));

-- invitaciones / exports
create policy "manage invitations" on invitations for all
  using (auth_role(company_id) = 'owner') with check (auth_role(company_id) = 'owner');
create policy "read exports" on report_exports for select using (auth_is_member(company_id));
create policy "create exports" on report_exports for insert with check (auth_is_member(company_id));
