-- ContaCheck C2B · Bloque 5 — company_tax_profiles (perfil fiscal versionado, vigencias no solapadas)
-- No copia secretos CSD; referencia segura a cfdi_provider_configs.

create table if not exists public.company_tax_profiles (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references public.companies(id) on delete restrict,
  rfc                    text not null,
  legal_name             text not null,
  regimen_fiscal         varchar(10) not null,
  codigo_postal_fiscal   varchar(10) not null,
  country_code           varchar(3) not null default 'MEX',
  functional_currency    varchar(3) not null default 'MXN',
  cfdi_provider_config_id uuid,   -- FK lógica a cfdi_provider_configs (vínculo a CSD; sin copiar secretos)
  valid_from             date not null,
  valid_to               date,
  status                 text not null default 'active' check (status in ('active','superseded')),
  version                integer not null default 1,
  created_by             uuid,
  created_at             timestamptz not null default now()
);
create index if not exists idx_tax_profiles_company on public.company_tax_profiles(company_id, valid_from);

-- A lo sumo un perfil activo (valid_to null) por empresa.
create unique index if not exists uq_tax_profile_active
  on public.company_tax_profiles(company_id) where valid_to is null and status='active';

-- Impedir vigencias solapadas.
create or replace function public.company_tax_profile_guard()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if exists (
    select 1 from public.company_tax_profiles p
     where p.company_id = new.company_id and p.id <> new.id
       and daterange(p.valid_from, coalesce(p.valid_to,'infinity'::date), '[]')
        && daterange(new.valid_from, coalesce(new.valid_to,'infinity'::date), '[]')
  ) then raise exception 'TAX_PROFILE_OVERLAP'; end if;
  return new;
end $$;
drop trigger if exists trg_tax_profile_guard on public.company_tax_profiles;
create trigger trg_tax_profile_guard before insert or update on public.company_tax_profiles
  for each row execute function public.company_tax_profile_guard();

-- Perfil vigente a una fecha (para snapshot de póliza).
create or replace function public.accounting_tax_profile_for_date(p_company uuid, p_date date)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select jsonb_build_object(
    'tax_profile_id', id, 'rfc', rfc, 'legal_name', legal_name, 'regimen_fiscal', regimen_fiscal,
    'codigo_postal_fiscal', codigo_postal_fiscal, 'functional_currency', functional_currency)
  from public.company_tax_profiles
   where company_id = p_company and p_date >= valid_from and (valid_to is null or p_date <= valid_to)
   order by valid_from desc limit 1;
$$;

revoke all on function public.accounting_tax_profile_for_date(uuid,date) from public, anon;
grant execute on function public.accounting_tax_profile_for_date(uuid,date) to authenticated, service_role;

alter table public.company_tax_profiles enable row level security;
