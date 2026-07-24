-- ContaCheck C2B · Bloque 15 — RLS y grants. Escrituras solo por RPC SECURITY DEFINER (definer bypassa RLS).
-- Clientes: solo SELECT en tablas de lectura; sin INSERT/UPDATE/DELETE directos. Sin DELETE en ninguna.

-- Tablas con company_id directo.
do $$
declare t text;
  read_tables text[] := array[
    'accounting_fiscal_years','accounting_periods','parties','party_links','company_tax_profiles',
    'accounting_voucher_lines','accounting_source_links','accounting_line_dimensions',
    'accounting_rules','accounting_voucher_sequences','accounting_idempotency_requests'];
begin
  foreach t in array read_tables loop
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format($p$drop policy if exists %1$s_sel on public.%1$I$p$, t);
    execute format($p$create policy %1$s_sel on public.%1$I for select using (
        company_id in (select company_id from public.company_members where user_id = auth.uid() and status = 'active'))$p$, t);
  end loop;
end $$;

-- Tablas hijas de reglas (empresa vía join).
revoke all on public.accounting_rule_versions from anon;
revoke insert, update, delete on public.accounting_rule_versions from authenticated;
grant select on public.accounting_rule_versions to authenticated;
grant all on public.accounting_rule_versions to service_role;
drop policy if exists accounting_rule_versions_sel on public.accounting_rule_versions;
create policy accounting_rule_versions_sel on public.accounting_rule_versions for select using (
  rule_id in (select id from public.accounting_rules
              where company_id in (select company_id from public.company_members where user_id=auth.uid() and status='active')));

do $$ declare t text; begin
  foreach t in array array['accounting_rule_conditions','accounting_rule_outputs'] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format($p$drop policy if exists %1$s_sel on public.%1$I$p$, t);
    execute format($p$create policy %1$s_sel on public.%1$I for select using (
       rule_version_id in (
         select rv.id from public.accounting_rule_versions rv
         join public.accounting_rules r on r.id = rv.rule_id
         where r.company_id in (select company_id from public.company_members where user_id=auth.uid() and status='active')))$p$, t);
  end loop;
end $$;

-- Capacidades: catálogo de referencia legible; mapeos legibles por miembros.
revoke all on public.accounting_capabilities from anon;
grant select on public.accounting_capabilities to authenticated;
drop policy if exists accounting_capabilities_sel on public.accounting_capabilities;
create policy accounting_capabilities_sel on public.accounting_capabilities for select using (true);

do $$ declare t text; begin
  foreach t in array array['accounting_role_capabilities','accounting_user_capabilities'] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format($p$drop policy if exists %1$s_sel on public.%1$I$p$, t);
    execute format($p$create policy %1$s_sel on public.%1$I for select using (
       company_id is null or company_id in (select company_id from public.company_members where user_id = auth.uid() and status='active'))$p$, t);
  end loop;
end $$;

-- accounting_vouchers: se CONSERVAN las políticas/grants legacy (compat LEGACY writers). No se abre DELETE.
