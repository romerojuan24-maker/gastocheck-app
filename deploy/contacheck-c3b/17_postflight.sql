-- ContaCheck C3B · 17_postflight — Verificación posterior a la aplicación (SOLO LECTURA)
-- Ejecutar tras aplicar 01..16. No modifica nada. Reporta PASS/FAIL por control.
do $$
declare n int; missing text;
begin
  -- 18 tablas nuevas presentes
  select string_agg(t,', ') into missing from unnest(array[
    'accounting_voucher_lines','accounting_source_links','accounting_periods','accounting_fiscal_years',
    'accounting_rules','accounting_rule_versions','accounting_rule_conditions','accounting_rule_outputs',
    'accounting_line_dimensions','accounting_idempotency_requests','accounting_voucher_sequences',
    'parties','party_links','company_tax_profiles','accounting_feature_flags',
    'accounting_capabilities','accounting_role_capabilities','accounting_user_capabilities']) t
  where to_regclass('public.'||t) is null;
  if missing is not null then raise exception 'POSTFLIGHT FAIL: faltan tablas C2B: %', missing; end if;
  raise notice 'PASS: 18 tablas C2B presentes';

  -- accounting_vouchers = 41 columnas
  select count(*) into n from information_schema.columns where table_schema='public' and table_name='accounting_vouchers';
  if n <> 41 then raise exception 'POSTFLIGHT FAIL: accounting_vouchers tiene % columnas (esperado 41)', n; end if;
  raise notice 'PASS: accounting_vouchers 41 columnas';

  -- voucher_number nullable
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='accounting_vouchers' and column_name='voucher_number') <> 'YES'
  then raise exception 'POSTFLIGHT FAIL: voucher_number no quedó nullable'; end if;
  raise notice 'PASS: voucher_number nullable';

  -- funciones esperadas (muestra representativa)
  select count(*) into n from pg_proc p join pg_namespace nn on nn.oid=p.pronamespace
    where nn.nspname='public' and p.proname in ('accounting_can','accounting_generate_voucher','accounting_post_voucher',
      'accounting_reverse_voucher','accounting_next_voucher_number','accounting_resolve_rules');
  if n < 6 then raise exception 'POSTFLIGHT FAIL: faltan funciones C2B (% de 6)', n; end if;
  raise notice 'PASS: funciones núcleo presentes';

  -- todas las funciones accounting_* SECURITY DEFINER tienen search_path fijo
  if exists (select 1 from pg_proc p join pg_namespace nn on nn.oid=p.pronamespace
     where nn.nspname='public' and p.proname like 'accounting_%' and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) s where s like 'search_path=%'))
  then raise exception 'POSTFLIGHT FAIL: función SECURITY DEFINER sin search_path'; end if;
  raise notice 'PASS: search_path fijo en SECURITY DEFINER';

  -- RLS habilitado en tablas nuevas clave
  if exists (select 1 from pg_class c join pg_namespace nn on nn.oid=c.relnamespace
     where nn.nspname='public' and c.relname in ('accounting_voucher_lines','parties','accounting_periods')
       and c.relrowsecurity = false)
  then raise exception 'POSTFLIGHT FAIL: RLS deshabilitado en alguna tabla C2B'; end if;
  raise notice 'PASS: RLS habilitado en tablas C2B';

  -- feature flags: ninguna empresa en SHADOW/CONTACHECK
  if exists (select 1 from public.accounting_feature_flags where mode <> 'LEGACY')
  then raise exception 'POSTFLIGHT FAIL: hay empresas fuera de LEGACY'; end if;
  raise notice 'PASS: todas en LEGACY (o sin fila = LEGACY)';

  -- integridad: sin pólizas duplicadas por idempotency_key
  if exists (select 1 from public.accounting_vouchers where idempotency_key is not null
             group by company_id, idempotency_key having count(*)>1)
  then raise exception 'POSTFLIGHT FAIL: pólizas duplicadas por idempotency_key'; end if;
  raise notice 'PASS: sin duplicados por idempotency_key';

  raise notice 'POSTFLIGHT OK';
end $$;

-- Constraints/índices/triggers esperados (listado informativo)
select 'constraint' k, conname obj from pg_constraint where conrelid='public.accounting_voucher_lines'::regclass
union all select 'index', indexname from pg_indexes where schemaname='public' and tablename='accounting_vouchers' and indexname like 'uq_vouchers_%'
union all select 'trigger', tgname from pg_trigger where tgrelid='public.accounting_vouchers'::regclass and not tgisinternal
order by 1,2;
