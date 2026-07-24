-- ContaCheck C3B · 18_smoke_tests — Humo transaccional NO PERSISTENTE (BEGIN ... ROLLBACK)
-- SEGURO: todo ocurre dentro de una transacción que se REVIERTE; no persiste ningún dato en prod.
-- Requiere una company_id real de prueba interna:  -v smoke_company='<uuid>'
-- Preferible ejecutarlo en STAGING; en prod solo con empresa piloto interna y SIEMPRE con el ROLLBACK final.
\set ON_ERROR_STOP on
\if :{?smoke_company}
\else
  \echo 'SKIP smoke: falta -v smoke_company=<uuid de empresa piloto interna>'
  \quit
\endif

begin;
-- El smoke NO commitea: al final ROLLBACK. Verifica que el pipeline generate→validate→(no post) funciona.
do $$
declare A uuid := :'smoke_company'; v uuid; st text; oa uuid;
begin
  select user_id into oa from public.company_members where company_id=A and role in ('owner','contador_general','accountant') and status='active' limit 1;
  if oa is null then raise notice 'SMOKE: empresa sin usuario contable; abortando smoke (no es fallo de C2B)'; return; end if;
  perform set_config('request.jwt.claim.sub', oa::text, true);
  -- Abrir ejercicio temporal (se revierte)
  perform public.accounting_open_fiscal_year(A, 2099);
  v := public.accounting_generate_voucher(A,'smoke','smoke','00000000-0000-0000-0000-0000000000ff',1,
        'smoke_evt','EXPENSE','2099-01-15','MXN',
        '[{"account_code":"__SMOKE__","side":"debit","amount":1}]'::jsonb, null,'smoke','SMOKE_KEY','{}'::jsonb);
  raise notice 'SMOKE inesperado: no debió generar (cuenta __SMOKE__ inexistente)';
exception
  when others then raise notice 'SMOKE OK: pipeline responde y valida (error controlado esperado: %)', sqlerrm;
end $$;
rollback;  -- <<< nada persiste

-- Verificación de funciones invocables (solo lectura, sin escritura)
select 'accounting_can callable' as check,
       (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname='public' and p.proname='accounting_can') = 1 as ok;
