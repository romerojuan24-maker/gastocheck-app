-- ContaCheck C3A · 05 — Catálogo contable v1 vs v2 (SOLO LECTURA)
select 'accounting_accounts' as catalog, count(*) as rows, count(distinct company_id) as companies from public.accounting_accounts
union all
select 'accounting_accounts_v2', count(*), count(distinct company_id) from public.accounting_accounts_v2;

-- Códigos duplicados por empresa en v1 (esperado 0; unique(company_id,code))
select company_id, code, count(*) from public.accounting_accounts group by company_id, code having count(*)>1;

-- Activas vs inactivas (v1)
select active, count(*) from public.accounting_accounts group by active;

-- Jerarquía: cuentas cuyo parent_code no existe en el mismo tenant (huérfanas)
select a.company_id, a.code, a.parent_code
from public.accounting_accounts a
where a.parent_code is not null
  and not exists (select 1 from public.accounting_accounts p where p.company_id=a.company_id and p.code=a.parent_code)
limit 100;

-- FK real de expenses.accounting_account_id (¿v1 o v2?)
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid='public.expenses'::regclass and contype='f'
  and pg_get_constraintdef(oid) ilike '%accounting_account%';
