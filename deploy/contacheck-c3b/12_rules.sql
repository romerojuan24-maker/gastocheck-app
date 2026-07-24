-- ContaCheck C2B · Bloque 12 — Motor de reglas (draft→active→inactive), versiones inmutables, publicación validada

create table if not exists public.accounting_rules (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete restrict,
  name              text not null,
  module            varchar(50) not null,
  event_type        varchar(48) not null,
  concept           text,
  priority          integer not null default 100,
  is_default        boolean not null default false,
  status            text not null default 'draft' check (status in ('draft','active','inactive')),
  valid_from        date,
  valid_to          date,
  active_version_id uuid,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_acc_rules_lookup on public.accounting_rules(company_id, module, event_type, status);

create table if not exists public.accounting_rule_versions (
  id           uuid primary key default gen_random_uuid(),
  rule_id      uuid not null references public.accounting_rules(id) on delete restrict,
  version      integer not null,
  status       text not null default 'draft' check (status in ('draft','published','archived')),
  published_by uuid, published_at timestamptz, notes text,
  created_at   timestamptz not null default now(),
  unique (rule_id, version)
);

create table if not exists public.accounting_rule_conditions (
  id              uuid primary key default gen_random_uuid(),
  rule_version_id uuid not null references public.accounting_rule_versions(id) on delete cascade,
  dimension       varchar(40) not null,
  operator        varchar(12) not null check (operator in ('eq','in','neq','gt','lt','exists','null')),
  value_text      text, value_num numeric, value_set text[]
);

create table if not exists public.accounting_rule_outputs (
  id                   uuid primary key default gen_random_uuid(),
  rule_version_id      uuid not null references public.accounting_rule_versions(id) on delete cascade,
  line_number          integer not null,
  side                 text not null check (side in ('debit','credit')),
  account_selector     jsonb not null,   -- {"type":"code","code":"6000"} | {"type":"category"} | {"type":"dimension",...}
  amount_source        text not null check (amount_source in ('subtotal','iva','iva_acreditable','iva_trasladado','retencion_iva','retencion_isr','ieps','total','custom')),
  tax_code             varchar(20),
  dimension_requirements text[],
  requires_review      boolean not null default false,
  metadata             jsonb not null default '{}'::jsonb,
  unique (rule_version_id, line_number)
);

-- FK diferida de vouchers.rule_version_id (la columna se creó en bloque 6).
do $$ begin
  if not exists (select 1 from pg_constraint where conname='accounting_vouchers_rule_version_fk') then
    alter table public.accounting_vouchers
      add constraint accounting_vouchers_rule_version_fk
      foreign key (rule_version_id) references public.accounting_rule_versions(id);
  end if;
end $$;

-- Publicación validada: cuentas existen/activas/afectables; outputs balancean por construcción de códigos fijos.
create or replace function public.accounting_publish_rule(p_company uuid, p_rule_version_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_rule record; v_out record; a record; n_debit int := 0; n_credit int := 0;
begin
  if not public.accounting_can(p_company, 'accounting.configure') then raise exception 'FORBIDDEN'; end if;
  select rv.*, r.company_id as rule_company into v_rule
    from public.accounting_rule_versions rv join public.accounting_rules r on r.id = rv.rule_id
   where rv.id = p_rule_version_id;
  if v_rule.id is null then raise exception 'RULE_VERSION_NOT_FOUND'; end if;
  if v_rule.rule_company <> p_company then raise exception 'CROSS_COMPANY'; end if;
  if v_rule.status = 'published' then return; end if;

  for v_out in select * from public.accounting_rule_outputs where rule_version_id = p_rule_version_id loop
    if v_out.side = 'debit' then n_debit := n_debit + 1; else n_credit := n_credit + 1; end if;
    if v_out.account_selector->>'type' = 'code' then
      select * into a from public.accounting_accounts
        where company_id = p_company and code = v_out.account_selector->>'code';
      if a.id is null then raise exception 'RULE_ACCOUNT_MISSING code=%', v_out.account_selector->>'code'; end if;
      if a.active is false then raise exception 'RULE_ACCOUNT_INACTIVE code=%', a.code; end if;
      if a.is_postable is false then raise exception 'RULE_ACCOUNT_NOT_POSTABLE code=%', a.code; end if;
    end if;
  end loop;
  if n_debit = 0 or n_credit = 0 then raise exception 'RULE_NOT_BALANCED (needs debit and credit sides)'; end if;

  update public.accounting_rule_versions set status='published', published_by=auth.uid(), published_at=now()
   where id = p_rule_version_id;
  update public.accounting_rules set status='active', active_version_id=p_rule_version_id, updated_at=now()
   where id = v_rule.rule_id;
  perform public.accounting_log_audit(p_company, 'contacheck_rule', v_rule.rule_id, 'publish_rule', jsonb_build_object('version_id',p_rule_version_id));
end $$;

-- Impedir editar outputs/conditions de una versión publicada (cambios => nueva versión).
create or replace function public.accounting_rule_version_locked_guard()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare st text; rvid uuid;
begin
  rvid := coalesce(new.rule_version_id, old.rule_version_id);
  select status into st from public.accounting_rule_versions where id = rvid;
  if st = 'published' then raise exception 'RULE_VERSION_PUBLISHED_IMMUTABLE'; end if;
  return coalesce(new, old);
end $$;
drop trigger if exists trg_rule_outputs_lock on public.accounting_rule_outputs;
create trigger trg_rule_outputs_lock before insert or update or delete on public.accounting_rule_outputs
  for each row execute function public.accounting_rule_version_locked_guard();
drop trigger if exists trg_rule_conditions_lock on public.accounting_rule_conditions;
create trigger trg_rule_conditions_lock before insert or update or delete on public.accounting_rule_conditions
  for each row execute function public.accounting_rule_version_locked_guard();

revoke all on function public.accounting_publish_rule(uuid,uuid) from public, anon;
grant execute on function public.accounting_publish_rule(uuid,uuid) to authenticated, service_role;

alter table public.accounting_rules            enable row level security;
alter table public.accounting_rule_versions    enable row level security;
alter table public.accounting_rule_conditions  enable row level security;
alter table public.accounting_rule_outputs     enable row level security;
