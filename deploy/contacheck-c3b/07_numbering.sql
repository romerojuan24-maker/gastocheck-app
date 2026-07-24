-- ContaCheck C2B · Bloque 7 — Numeración por (empresa, ejercicio, tipo) concurrente
-- Transición de la unicidad global de voucher_number (§9): legacy conserva su unicidad; nuevas usan compuesta.

create table if not exists public.accounting_voucher_sequences (
  company_id  uuid not null references public.companies(id) on delete restrict,
  fiscal_year integer not null,
  voucher_type varchar(50) not null,
  last_number integer not null default 0,
  primary key (company_id, fiscal_year, voucher_type)
);

-- Transición de unicidad (§9): la restricción global se reemplaza por:
--   (a) unicidad parcial para filas legacy (fiscal_year IS NULL) → conserva la garantía existente;
--   (b) unicidad compuesta por empresa/ejercicio/tipo para filas nuevas (fiscal_year IS NOT NULL).
-- Las propuestas (generated/validated/approved) no tienen folio hasta 'posted' → voucher_number nullable.
alter table public.accounting_vouchers alter column voucher_number drop not null;
alter table public.accounting_vouchers drop constraint if exists accounting_vouchers_voucher_number_key;
create unique index if not exists uq_vouchers_number_legacy
  on public.accounting_vouchers(voucher_number) where fiscal_year is null and voucher_number is not null;
create unique index if not exists uq_vouchers_number_scoped
  on public.accounting_vouchers(company_id, fiscal_year, voucher_type, voucher_number)
  where fiscal_year is not null and voucher_number is not null;

-- Asignación atómica del siguiente folio (row-lock por UPDATE ... RETURNING).
create or replace function public.accounting_next_voucher_number(p_company uuid, p_fiscal_year integer, p_type text)
returns text language plpgsql security definer set search_path = pg_catalog, public as $$
declare n integer;
begin
  insert into public.accounting_voucher_sequences(company_id, fiscal_year, voucher_type, last_number)
  values (p_company, p_fiscal_year, p_type, 0)
  on conflict (company_id, fiscal_year, voucher_type) do nothing;

  update public.accounting_voucher_sequences
     set last_number = last_number + 1
   where company_id = p_company and fiscal_year = p_fiscal_year and voucher_type = p_type
  returning last_number into n;

  return p_type || '-' || p_fiscal_year::text || '-' || lpad(n::text, 6, '0');
end $$;

revoke all on function public.accounting_next_voucher_number(uuid,integer,text) from public, anon;
grant execute on function public.accounting_next_voucher_number(uuid,integer,text) to authenticated, service_role;

alter table public.accounting_voucher_sequences enable row level security;
