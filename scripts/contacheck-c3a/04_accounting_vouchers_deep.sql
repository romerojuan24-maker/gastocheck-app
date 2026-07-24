-- ContaCheck C3A · 04 — accounting_vouchers en profundidad (SOLO LECTURA)
-- Columnas + nulabilidad
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name='accounting_vouchers' order by ordinal_position;

-- Constraints (PK/UNIQUE/CHECK/FK)
select conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid='public.accounting_vouchers'::regclass order by contype, conname;

-- Índices
select indexname, indexdef from pg_indexes where schemaname='public' and tablename='accounting_vouchers';

-- Triggers
select tgname, tgenabled, pg_get_triggerdef(oid) as definition
from pg_trigger where tgrelid='public.accounting_vouchers'::regclass and not tgisinternal;

-- RLS habilitado + políticas
select relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
from pg_class where oid='public.accounting_vouchers'::regclass;
select policyname, cmd, permissive, roles, qual as using_expr, with_check
from pg_policies where schemaname='public' and tablename='accounting_vouchers';

-- Grants
select grantee, privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name='accounting_vouchers' order by grantee, privilege_type;

-- Volumen + nulos/duplicados de voucher_number
select count(*) as rows,
       count(*) filter (where voucher_number is null) as null_voucher_number,
       count(*) - count(distinct voucher_number) as duplicate_voucher_numbers
from public.accounting_vouchers;
