-- ContaCheck C3A · 07 — RLS y seguridad de tablas afectadas (SOLO LECTURA)
-- RLS habilitado/forzado por tabla
select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
       pg_get_userbyid(c.relowner) as owner
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relname in ('accounting_accounts','accounting_accounts_v2','accounting_vouchers','accounting_entries',
                    'expenses','bank_transactions','company_members','audit_logs')
order by c.relname;

-- Políticas (USING / WITH CHECK / roles / permisiva)
select schemaname, tablename, policyname, cmd, permissive, roles, qual as using_expr, with_check
from pg_policies
where schemaname='public'
  and tablename in ('accounting_accounts','accounting_accounts_v2','accounting_vouchers','accounting_entries',
                    'expenses','bank_transactions','company_members','audit_logs')
order by tablename, policyname;

-- Grants directos (buscar DELETE/ALL a authenticated/anon = riesgo)
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public'
  and table_name in ('accounting_vouchers','accounting_accounts','expenses','bank_transactions')
  and grantee in ('anon','authenticated','service_role')
order by table_name, grantee, privilege_type;

-- Vistas SECURITY DEFINER en public (posible bypass)
select c.relname as view_name
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='v'
  and exists (select 1 from pg_rewrite r where r.ev_class=c.oid); -- lista vistas; revisar security_invoker por separado
