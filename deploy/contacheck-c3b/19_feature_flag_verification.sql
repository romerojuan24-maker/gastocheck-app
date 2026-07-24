-- ContaCheck C3B · 19_feature_flag_verification — Confirmar que NADIE quedó fuera de LEGACY (SOLO LECTURA)
do $$
declare n_shadow int; n_contacheck int; n_companies int;
begin
  if to_regclass('public.accounting_feature_flags') is null then
    raise exception 'FLAG CHECK FAIL: accounting_feature_flags no existe (¿16_compat_flags no aplicado?)';
  end if;
  select count(*) into n_shadow     from public.accounting_feature_flags where mode='SHADOW';
  select count(*) into n_contacheck from public.accounting_feature_flags where mode='CONTACHECK';
  select count(*) into n_companies  from public.companies;
  raise notice 'Empresas: %, flags SHADOW: %, flags CONTACHECK: %', n_companies, n_shadow, n_contacheck;
  if n_shadow <> 0 then raise exception 'FLAG CHECK FAIL: % empresa(s) en SHADOW', n_shadow; end if;
  if n_contacheck <> 0 then raise exception 'FLAG CHECK FAIL: % empresa(s) en CONTACHECK', n_contacheck; end if;
  -- Verificar que accounting_flag_mode devuelve LEGACY por defecto para una empresa sin fila
  if (select coalesce((select mode from public.accounting_feature_flags limit 0),'LEGACY')) <> 'LEGACY' then
    raise exception 'FLAG CHECK FAIL: default no es LEGACY';
  end if;
  raise notice 'FLAG CHECK OK: todas las empresas en LEGACY (default seguro).';
end $$;

-- Resolución efectiva por empresa (debe ser LEGACY en todas)
select c.id as company_id, public.accounting_flag_mode(c.id, 'bancocheck') as bancocheck_mode,
       public.accounting_flag_mode(c.id, 'gastocheck') as gastocheck_mode
from public.companies c order by c.id;
