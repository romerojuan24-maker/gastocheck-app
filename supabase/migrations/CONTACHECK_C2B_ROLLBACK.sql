-- ContaCheck C2B · ROLLBACK — revierte SOLO objetos creados en C2B. No toca infraestructura histórica.
-- Requiere que no queden datos contables reales (solo datos de prueba). Purga datos de prueba primero.

-- 1) Purga de datos de prueba (triggers off para poder borrar líneas/pólizas posted de prueba).
set session_replication_role = replica;
do $$ begin
  -- pólizas creadas por ContaCheck (idempotency_key sólo lo setean las RPC C2B)
  delete from public.accounting_line_dimensions where true;
  delete from public.accounting_source_links where true;
  delete from public.accounting_voucher_lines where true;
  delete from public.accounting_idempotency_requests where true;
  delete from public.accounting_vouchers where idempotency_key is not null or fiscal_year is not null or reversal_of_voucher_id is not null;
  delete from public.accounting_voucher_sequences where true;
  delete from public.accounting_rule_outputs where true;
  delete from public.accounting_rule_conditions where true;
  delete from public.accounting_rule_versions where true;
  delete from public.accounting_rules where true;
  delete from public.accounting_periods where true;
  delete from public.accounting_fiscal_years where true;
  delete from public.party_links where true;
  delete from public.parties where true;
  delete from public.company_tax_profiles where true;
  delete from public.accounting_feature_flags where true;
  delete from public.accounting_user_capabilities where true;
  delete from public.accounting_role_capabilities where true;
  delete from public.accounting_capabilities where true;
exception when undefined_table then null; end $$;
set session_replication_role = origin;

-- 2) Drop de todas las funciones accounting_* (cascade elimina sus triggers en objetos existentes).
do $$ declare r record; begin
  for r in select oid::regprocedure as sig from pg_proc
           where proname like 'accounting\_%' escape '\' and pronamespace = 'public'::regnamespace loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end $$;

-- 3) Revertir ampliación de accounting_vouchers (columnas + constraints originales).
alter table public.accounting_vouchers drop constraint if exists accounting_vouchers_rule_version_fk;
alter table public.accounting_vouchers
  drop column if exists schema_version, drop column if exists event_type, drop column if exists accounting_date,
  drop column if exists occurred_at, drop column if exists fiscal_year, drop column if exists fiscal_period_id,
  drop column if exists exchange_rate, drop column if exists description, drop column if exists reference,
  drop column if exists party_id, drop column if exists tax_profile_snapshot, drop column if exists rule_version_id,
  drop column if exists idempotency_key, drop column if exists reversal_of_voucher_id, drop column if exists reversed_by_voucher_id,
  drop column if exists approved_by, drop column if exists approved_at, drop column if exists posted_by, drop column if exists posted_at,
  drop column if exists rejected_by, drop column if exists rejected_at, drop column if exists rejection_reason,
  drop column if exists created_by, drop column if exists updated_at, drop column if exists version, drop column if exists metadata;

drop index if exists public.uq_vouchers_number_legacy;
drop index if exists public.uq_vouchers_number_scoped;
drop index if exists public.uq_vouchers_idempotency;
drop index if exists public.idx_vouchers_period;
drop index if exists public.idx_vouchers_party;
drop index if exists public.idx_vouchers_source;

-- restaurar unicidad global y NOT NULL originales de voucher_number
alter table public.accounting_vouchers alter column voucher_number set not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='accounting_vouchers_voucher_number_key') then
    alter table public.accounting_vouchers add constraint accounting_vouchers_voucher_number_key unique (voucher_number);
  end if;
end $$;

-- restaurar CHECKs originales (status y voucher_type)
alter table public.accounting_vouchers drop constraint if exists accounting_vouchers_status_check;
alter table public.accounting_vouchers add constraint accounting_vouchers_status_check
  check (status in ('draft','exported','reconciled'));
alter table public.accounting_vouchers drop constraint if exists accounting_vouchers_voucher_type_check;
alter table public.accounting_vouchers add constraint accounting_vouchers_voucher_type_check
  check (voucher_type in ('INCOME','EXPENSE','TRANSFER'));

-- 4) Revertir ampliación de accounting_accounts.
alter table public.accounting_accounts drop constraint if exists accounting_accounts_nature_chk;
alter table public.accounting_accounts drop constraint if exists accounting_accounts_type_norm_chk;
alter table public.accounting_accounts
  drop column if exists nature, drop column if exists account_type_norm, drop column if exists sub_type,
  drop column if exists is_postable, drop column if exists sat_grouping_code, drop column if exists currency_code,
  drop column if exists default_is_deductible, drop column if exists default_requires_cfdi, drop column if exists default_tax_treatment;
comment on table public.accounting_accounts_v2 is null;

-- 5) Drop de tablas C2B (orden de dependencias).
drop table if exists public.accounting_line_dimensions cascade;
drop table if exists public.accounting_source_links cascade;
drop table if exists public.accounting_voucher_lines cascade;
drop table if exists public.accounting_idempotency_requests cascade;
drop table if exists public.accounting_voucher_sequences cascade;
drop table if exists public.accounting_rule_outputs cascade;
drop table if exists public.accounting_rule_conditions cascade;
drop table if exists public.accounting_rule_versions cascade;
drop table if exists public.accounting_rules cascade;
drop table if exists public.accounting_periods cascade;
drop table if exists public.accounting_fiscal_years cascade;
drop table if exists public.party_links cascade;
drop table if exists public.parties cascade;
drop table if exists public.company_tax_profiles cascade;
drop table if exists public.accounting_feature_flags cascade;
drop table if exists public.accounting_user_capabilities cascade;
drop table if exists public.accounting_role_capabilities cascade;
drop table if exists public.accounting_capabilities cascade;
