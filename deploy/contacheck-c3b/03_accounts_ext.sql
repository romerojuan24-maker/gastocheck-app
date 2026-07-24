-- ContaCheck C2B · Bloque 3 — Ampliación aditiva de accounting_accounts (v1 autoritativo)
-- No cambia FK a v2, no elimina v2. Absorbe atributos fiscales de v2 como columnas (propias + defaults).

alter table public.accounting_accounts
  add column if not exists nature                text,
  add column if not exists account_type_norm     text,
  add column if not exists sub_type              text,
  add column if not exists is_postable           boolean not null default true,
  add column if not exists sat_grouping_code     varchar(10),
  add column if not exists currency_code         varchar(3),
  add column if not exists default_is_deductible boolean,   -- default, NO verdad absoluta (reglas pueden sobrescribir)
  add column if not exists default_requires_cfdi boolean,   -- default, NO verdad absoluta
  add column if not exists default_tax_treatment text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='accounting_accounts_nature_chk') then
    alter table public.accounting_accounts add constraint accounting_accounts_nature_chk
      check (nature is null or nature in ('deudora','acreedora')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='accounting_accounts_type_norm_chk') then
    alter table public.accounting_accounts add constraint accounting_accounts_type_norm_chk
      check (account_type_norm is null or account_type_norm in ('activo','pasivo','patrimonio','ingreso','egreso','costo')) not valid;
  end if;
end $$;

-- Backfill conservador desde v2 por (company_id, code) — solo si hay filas en v2. No sobrescribe valores existentes.
update public.accounting_accounts a set
  nature                = coalesce(a.nature, v.nature),
  account_type_norm     = coalesce(a.account_type_norm, v.account_type),
  sub_type              = coalesce(a.sub_type, v.sub_type),
  default_is_deductible = coalesce(a.default_is_deductible, v.is_deductible),
  default_requires_cfdi = coalesce(a.default_requires_cfdi, v.requires_cfdi)
from public.accounting_accounts_v2 v
where v.company_id = a.company_id and v.code = a.code;

-- Congelamiento de v2: marca deprecada + guarda que registra en auditoría cualquier INSERT nuevo (no rompe legado).
comment on table public.accounting_accounts_v2 is
  'DEPRECATED (ContaCheck C2B, 2026-07-24): catálogo congelado. No usar en nuevos desarrollos. Autoritativo: public.accounting_accounts.';

create or replace function public.accounting_v2_freeze_notice()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  begin
    perform public.accounting_log_audit(new.company_id, 'contacheck_v2_frozen_insert', new.id, 'insert_into_deprecated_v2',
      jsonb_build_object('code', new.code));
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists trg_accounting_v2_freeze on public.accounting_accounts_v2;
create trigger trg_accounting_v2_freeze after insert on public.accounting_accounts_v2
  for each row execute function public.accounting_v2_freeze_notice();
