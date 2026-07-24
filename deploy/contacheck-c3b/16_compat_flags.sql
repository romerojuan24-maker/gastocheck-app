-- ContaCheck C2B · Bloque 16 — Feature flags de compatibilidad (default LEGACY; sin activación global)

create table if not exists public.accounting_feature_flags (
  company_id uuid not null references public.companies(id) on delete cascade,
  module     varchar(50) not null,
  mode       text not null default 'LEGACY' check (mode in ('LEGACY','SHADOW','CONTACHECK')),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (company_id, module)
);

-- Modo efectivo (default LEGACY si no hay fila).
create or replace function public.accounting_flag_mode(p_company uuid, p_module text)
returns text language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce((select mode from public.accounting_feature_flags where company_id=p_company and module=p_module), 'LEGACY');
$$;

-- Set del modo (requiere accounting.admin). No permite activación global (siempre por empresa/módulo).
create or replace function public.accounting_set_flag(p_company uuid, p_module text, p_mode text)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not public.accounting_can(p_company,'accounting.admin') then raise exception 'FORBIDDEN'; end if;
  if p_mode not in ('LEGACY','SHADOW','CONTACHECK') then raise exception 'BAD_MODE'; end if;
  insert into public.accounting_feature_flags(company_id, module, mode, updated_by)
  values (p_company, p_module, p_mode, auth.uid())
  on conflict (company_id, module) do update set mode=excluded.mode, updated_by=auth.uid(), updated_at=now();
  perform public.accounting_log_audit(p_company,'contacheck_flag', p_company, 'set_flag', jsonb_build_object('module',p_module,'mode',p_mode));
end $$;

revoke all on function public.accounting_flag_mode(uuid,text) from public, anon;
revoke all on function public.accounting_set_flag(uuid,text,text) from public, anon;
grant execute on function public.accounting_flag_mode(uuid,text) to authenticated, service_role;
grant execute on function public.accounting_set_flag(uuid,text,text) to authenticated, service_role;

revoke all on public.accounting_feature_flags from anon;
revoke insert, update, delete on public.accounting_feature_flags from authenticated;
grant select on public.accounting_feature_flags to authenticated;
grant all on public.accounting_feature_flags to service_role;
alter table public.accounting_feature_flags enable row level security;
drop policy if exists accounting_feature_flags_sel on public.accounting_feature_flags;
create policy accounting_feature_flags_sel on public.accounting_feature_flags for select using (
  company_id in (select company_id from public.company_members where user_id = auth.uid() and status='active'));
