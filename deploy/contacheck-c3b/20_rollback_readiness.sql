-- ContaCheck C3B · 20_rollback_readiness — ¿Es seguro revertir? (SOLO LECTURA)
-- El rollback destructivo (CONTACHECK_C2B_ROLLBACK.sql) SOLO aplica mientras no haya contabilidad real.
do $$
declare n_posted int := 0; n_lines int := 0;
begin
  if to_regclass('public.accounting_vouchers') is not null then
    select count(*) into n_posted from public.accounting_vouchers where status = 'posted';
  end if;
  if to_regclass('public.accounting_voucher_lines') is not null then
    select count(*) into n_lines from public.accounting_voucher_lines;
  end if;
  raise notice 'Pólizas posted: %, líneas: %', n_posted, n_lines;
  if n_posted > 0 then
    raise warning 'ROLLBACK READINESS: hay % pólizas posted. El rollback destructivo NO debe ejecutarse; usar contra-asiento/forward-fix o restaurar backup.', n_posted;
  else
    raise notice 'ROLLBACK READINESS OK: sin pólizas posted → rollback lógico (CONTACHECK_C2B_ROLLBACK.sql) es seguro.';
  end if;
end $$;

-- Confirmar que el script de rollback existe en el repo (verificación de artefacto, no SQL):
--   supabase/migrations/CONTACHECK_C2B_ROLLBACK.sql  (probado apply→rollback→reapply en local, 49/49).
select 'rollback_script_reference' as artifact,
       'supabase/migrations/CONTACHECK_C2B_ROLLBACK.sql' as path;
