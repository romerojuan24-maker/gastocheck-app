-- ContaCheck C2B · Pruebas de seguridad: capacidades, RLS multiempresa/cross-company, no-DELETE.
\set ON_ERROR_STOP on

-- ===== Capacidades (accounting_can) por rol =====
do $$
declare A uuid:='aaaaaaaa-0000-0000-0000-000000000001';
        oa uuid:='10000000-0000-0000-0000-000000000001'; ac uuid:='10000000-0000-0000-0000-000000000002';
        ob uuid:='10000000-0000-0000-0000-000000000003'; adm uuid:='10000000-0000-0000-0000-000000000004';
        sp uuid:='10000000-0000-0000-0000-000000000005'; nom uuid:='99999999-9999-9999-9999-999999999999';
begin
  perform set_config('request.jwt.claim.sub', oa::text, true);
  perform public._t_assert(public.accounting_can(A,'accounting.post') and public.accounting_can(A,'accounting.admin'),'S1 owner: post+admin');
  perform set_config('request.jwt.claim.sub', adm::text, true);
  perform public._t_assert(public.accounting_can(A,'accounting.view') and public.accounting_can(A,'accounting.configure')
      and not public.accounting_can(A,'accounting.post') and not public.accounting_can(A,'accounting.reverse'),'S2 admin: view/config sí, post/reverse no');
  perform set_config('request.jwt.claim.sub', ac::text, true);
  perform public._t_assert(public.accounting_can(A,'accounting.post') and public.accounting_can(A,'accounting.approve')
      and not public.accounting_can(A,'accounting.reverse'),'S3 accountant: post/approve sí, reverse no');
  perform set_config('request.jwt.claim.sub', sp::text, true);
  perform public._t_assert(not public.accounting_can(A,'accounting.view'),'S4 spender: sin capacidades');
  perform set_config('request.jwt.claim.sub', ob::text, true);
  perform public._t_assert(not public.accounting_can(A,'accounting.view'),'S5 empresa ajena (owner B) no ve A');
  perform set_config('request.jwt.claim.sub', nom::text, true);
  perform public._t_assert(not public.accounting_can(A,'accounting.view'),'S6 no miembro sin capacidades');
end $$;

-- ===== Preparar una póliza posted en A (para visibilidad RLS) =====
do $$
declare A uuid:='aaaaaaaa-0000-0000-0000-000000000001'; oa uuid:='10000000-0000-0000-0000-000000000001';
        ac uuid:='10000000-0000-0000-0000-000000000002'; v uuid;
begin
  perform set_config('request.jwt.claim.sub', oa::text, true);
  v := public.accounting_generate_voucher(A,'gastocheck','expenses','eeeeeeee-0000-0000-0000-000000000001',1,
        'gasto_autorizado','EXPENSE','2026-08-10','MXN',
        '[{"account_code":"6000","side":"debit","amount":700},{"account_code":"2010","side":"credit","amount":700}]'::jsonb,
        null,'RLS setup','K_RLS','{"x":1}'::jsonb);
  perform public.accounting_validate_voucher(A,v);
  perform set_config('request.jwt.claim.sub', ac::text, true);
  perform public.accounting_approve_voucher(A,v,1);
  perform set_config('request.jwt.claim.sub', oa::text, true);
  perform public.accounting_post_voucher(A,v,2);
end $$;

-- ===== RLS: aislamiento por empresa (SET ROLE authenticated) =====
-- owner_a ve líneas de A
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
set role authenticated;
select public._t_assert(
  (select count(*) from public.accounting_voucher_lines where company_id='aaaaaaaa-0000-0000-0000-000000000001') > 0,
  'S7 owner_a (authenticated) ve líneas de su empresa');
reset role;

-- owner_b NO ve líneas de A (cross-company)
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
set role authenticated;
select public._t_assert(
  (select count(*) from public.accounting_voucher_lines where company_id='aaaaaaaa-0000-0000-0000-000000000001') = 0,
  'S8 owner_b (authenticated) NO ve líneas de empresa ajena');
reset role;

-- no miembro no ve nada
set request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
set role authenticated;
select public._t_assert(
  (select count(*) from public.accounting_voucher_lines) = 0, 'S9 no miembro no ve líneas');

-- no-DELETE: authenticated no puede borrar líneas (sin grant)
do $$
declare denied boolean:=false;
begin
  begin
    delete from public.accounting_voucher_lines where true;
  exception when insufficient_privilege then denied:=true; when others then denied:=true; end;
  perform public._t_assert(denied,'S10 authenticated no puede DELETE líneas');
end $$;
reset role;

-- service_role bypassa RLS (ve todo) — control
set role service_role;
select public._t_assert(
  (select count(*) from public.accounting_voucher_lines where company_id='aaaaaaaa-0000-0000-0000-000000000001') > 0,
  'S11 service_role ve datos (control)');
reset role;

select 'RLS TESTS DONE' as status;
