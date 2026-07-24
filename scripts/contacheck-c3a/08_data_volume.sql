-- ContaCheck C3A · 08 — Volumen y tamaños (SOLO LECTURA, métricas agregadas; sin datos personales)
select c.relname as table_name,
       c.reltuples::bigint            as est_rows,
       pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
       pg_size_pretty(pg_indexes_size(c.oid))        as index_size
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relname in ('accounting_accounts','accounting_accounts_v2','accounting_vouchers','accounting_entries',
                    'expenses','receipts','bank_transactions','cobra_invoices','cobra_payments','accounts_payable',
                    'nomi_employees','nomi_payroll','companies','company_members','audit_logs')
order by pg_total_relation_size(c.oid) desc;

-- Conteo exacto de las tablas contables clave
select 'accounting_accounts' t, count(*) n from public.accounting_accounts
union all select 'accounting_accounts_v2', count(*) from public.accounting_accounts_v2
union all select 'accounting_vouchers', count(*) from public.accounting_vouchers
union all select 'accounting_entries', count(*) from public.accounting_entries;

-- Estados usados en accounting_vouchers (compatibilidad con CHECK ampliado)
select status, count(*) from public.accounting_vouchers group by status;

-- Estados usados en expenses (compat con adaptador GastoCheck)
select status, count(*) from public.expenses group by status order by count(*) desc;
