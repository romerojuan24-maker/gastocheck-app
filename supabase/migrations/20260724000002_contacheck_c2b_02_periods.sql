-- ContaCheck C2B · Bloque 2 — Ejercicios y periodos fiscales + auditoría helper (aditivo, idempotente)

-- Helper de auditoría reutilizado por todos los bloques (audit_logs.entity_id es NOT NULL).
create or replace function public.accounting_log_audit(
  p_company uuid, p_entity_type text, p_entity_id uuid, p_action text,
  p_new jsonb default null, p_reason text default null)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  insert into public.audit_logs(company_id, user_id, entity_type, entity_id, action, new_values, reason, created_at)
  values (p_company, auth.uid(), p_entity_type, coalesce(p_entity_id, gen_random_uuid()), p_action, p_new, p_reason, now());
end $$;
revoke all on function public.accounting_log_audit(uuid,text,uuid,text,jsonb,text) from public, anon;
grant execute on function public.accounting_log_audit(uuid,text,uuid,text,jsonb,text) to authenticated, service_role;

create table if not exists public.accounting_fiscal_years (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  year       integer not null,
  start_date date not null,
  end_date   date not null,
  status     text not null default 'open' check (status in ('open','soft_closed','closed','locked')),
  closed_by  uuid, closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (company_id, year),
  check (end_date > start_date)
);

create table if not exists public.accounting_periods (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete restrict,
  fiscal_year_id uuid not null references public.accounting_fiscal_years(id) on delete restrict,
  fiscal_year    integer not null,
  month          smallint not null check (month between 1 and 12),
  start_date     date not null,
  end_date       date not null,
  status         text not null default 'open' check (status in ('open','soft_closed','closed','locked')),
  closed_by      uuid, closed_at timestamptz,
  reopened_by    uuid, reopened_at timestamptz,
  created_at     timestamptz not null default now(),
  unique (company_id, fiscal_year, month),
  check (end_date >= start_date)
);
create index if not exists idx_acc_periods_company on public.accounting_periods(company_id, fiscal_year, month);

-- Impedir periodos fuera del ejercicio o solapados (defensa a nivel BD).
create or replace function public.accounting_period_guard()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare v_fy record;
begin
  select * into v_fy from public.accounting_fiscal_years where id = new.fiscal_year_id;
  if v_fy.id is null then raise exception 'PERIOD_FY_MISSING'; end if;
  if new.company_id <> v_fy.company_id then raise exception 'PERIOD_FY_COMPANY_MISMATCH'; end if;
  if new.start_date < v_fy.start_date or new.end_date > v_fy.end_date then
    raise exception 'PERIOD_OUT_OF_FISCAL_YEAR';
  end if;
  if exists (
    select 1 from public.accounting_periods p
     where p.company_id = new.company_id and p.id <> new.id
       and daterange(p.start_date, p.end_date, '[]') && daterange(new.start_date, new.end_date, '[]')
  ) then raise exception 'PERIOD_OVERLAP'; end if;
  return new;
end $$;
drop trigger if exists trg_accounting_period_guard on public.accounting_periods;
create trigger trg_accounting_period_guard before insert or update on public.accounting_periods
  for each row execute function public.accounting_period_guard();

-- RPC: abrir ejercicio + 12 periodos mensuales
create or replace function public.accounting_open_fiscal_year(p_company uuid, p_year integer)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_fy_id uuid; m integer;
begin
  if not public.accounting_can(p_company, 'accounting.admin') then raise exception 'FORBIDDEN'; end if;
  insert into public.accounting_fiscal_years(company_id, year, start_date, end_date)
  values (p_company, p_year, make_date(p_year,1,1), make_date(p_year,12,31))
  returning id into v_fy_id;
  for m in 1..12 loop
    insert into public.accounting_periods(company_id, fiscal_year_id, fiscal_year, month, start_date, end_date)
    values (p_company, v_fy_id, p_year, m, make_date(p_year,m,1), (make_date(p_year,m,1) + interval '1 month - 1 day')::date);
  end loop;
  perform public.accounting_log_audit(p_company, 'contacheck_fiscal_year', v_fy_id, 'open_fiscal_year', jsonb_build_object('year',p_year));
  return v_fy_id;
end $$;

-- RPC: cerrar periodo (soft o hard)
create or replace function public.accounting_close_period(p_company uuid, p_period_id uuid, p_hard boolean default false)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare v record;
begin
  if not public.accounting_can(p_company, 'accounting.close_period') then raise exception 'FORBIDDEN'; end if;
  select * into v from public.accounting_periods where id = p_period_id and company_id = p_company for update;
  if v.id is null then raise exception 'PERIOD_NOT_FOUND'; end if;
  update public.accounting_periods
     set status = case when p_hard then 'closed' else 'soft_closed' end, closed_by = auth.uid(), closed_at = now()
   where id = p_period_id;
  perform public.accounting_log_audit(p_company, 'contacheck_period', p_period_id, case when p_hard then 'close' else 'soft_close' end, jsonb_build_object('from',v.status));
end $$;

-- RPC: reabrir periodo (closed requiere admin; soft_closed requiere reopen_period)
create or replace function public.accounting_reopen_period(p_company uuid, p_period_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare v record;
begin
  select * into v from public.accounting_periods where id = p_period_id and company_id = p_company for update;
  if v.id is null then raise exception 'PERIOD_NOT_FOUND'; end if;
  if v.status = 'locked' then raise exception 'PERIOD_LOCKED'; end if;
  if v.status = 'closed' and not public.accounting_can(p_company,'accounting.admin') then raise exception 'FORBIDDEN'; end if;
  if v.status = 'soft_closed' and not public.accounting_can(p_company,'accounting.reopen_period') then raise exception 'FORBIDDEN'; end if;
  update public.accounting_periods set status='open', reopened_by=auth.uid(), reopened_at=now() where id=p_period_id;
  perform public.accounting_log_audit(p_company, 'contacheck_period', p_period_id, 'reopen', jsonb_build_object('from',v.status));
end $$;

-- Utilidad: periodo abierto que contiene una fecha (para contabilizar)
create or replace function public.accounting_period_for_date(p_company uuid, p_date date)
returns uuid language sql stable security definer set search_path = pg_catalog, public as $$
  select id from public.accounting_periods
   where company_id = p_company and p_date between start_date and end_date
   order by month limit 1;
$$;

revoke all on function public.accounting_open_fiscal_year(uuid,integer) from public, anon;
revoke all on function public.accounting_close_period(uuid,uuid,boolean) from public, anon;
revoke all on function public.accounting_reopen_period(uuid,uuid) from public, anon;
revoke all on function public.accounting_period_for_date(uuid,date) from public, anon;
grant execute on function public.accounting_open_fiscal_year(uuid,integer) to authenticated, service_role;
grant execute on function public.accounting_close_period(uuid,uuid,boolean) to authenticated, service_role;
grant execute on function public.accounting_reopen_period(uuid,uuid) to authenticated, service_role;
grant execute on function public.accounting_period_for_date(uuid,date) to authenticated, service_role;

alter table public.accounting_fiscal_years enable row level security;
alter table public.accounting_periods      enable row level security;
