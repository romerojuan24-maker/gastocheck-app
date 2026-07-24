-- ContaCheck C2B · Fixtures de prueba (idempotente). Empresas A/B, usuarios, catálogo, ejercicio, perfil fiscal.
\set ON_ERROR_STOP on

-- Helper de aserción
create or replace function public._t_assert(p_cond boolean, p_name text) returns void language plpgsql as $$
begin
  if p_cond then raise notice 'PASS: %', p_name;
  else raise exception 'FAIL: %', p_name; end if;
end $$;

-- IDs fijos
-- A=aaaaaaaa.., B=bbbbbbbb.., owner_a=100..1, acct_a=100..2, owner_b=100..3
-- Teardown de datos de prueba: se desactivan triggers (incl. guard de inmutabilidad) SOLO para limpiar fixtures.
set session_replication_role = replica;
do $$
declare A uuid:='aaaaaaaa-0000-0000-0000-000000000001'; B uuid:='bbbbbbbb-0000-0000-0000-000000000002';
        oa uuid:='10000000-0000-0000-0000-000000000001'; ac uuid:='10000000-0000-0000-0000-000000000002';
        ob uuid:='10000000-0000-0000-0000-000000000003'; pol uuid:='dddddddd-0000-0000-0000-000000000001';
begin
  -- limpieza previa (orden de dependencias)
  delete from public.accounting_line_dimensions where company_id in (A,B);
  delete from public.accounting_source_links where company_id in (A,B);
  delete from public.accounting_voucher_lines where company_id in (A,B);
  delete from public.accounting_idempotency_requests where company_id in (A,B);
  delete from public.accounting_vouchers where company_id in (A,B);
  delete from public.accounting_voucher_sequences where company_id in (A,B);
  delete from public.accounting_rule_outputs where rule_version_id in (select rv.id from public.accounting_rule_versions rv join public.accounting_rules r on r.id=rv.rule_id where r.company_id in (A,B));
  delete from public.accounting_rule_conditions where rule_version_id in (select rv.id from public.accounting_rule_versions rv join public.accounting_rules r on r.id=rv.rule_id where r.company_id in (A,B));
  delete from public.accounting_rule_versions where rule_id in (select id from public.accounting_rules where company_id in (A,B));
  delete from public.accounting_rules where company_id in (A,B);
  delete from public.accounting_periods where company_id in (A,B);
  delete from public.accounting_fiscal_years where company_id in (A,B);
  delete from public.company_tax_profiles where company_id in (A,B);
  delete from public.party_links where company_id in (A,B);
  delete from public.parties where company_id in (A,B);
  delete from public.accounting_feature_flags where company_id in (A,B);
  delete from public.accounting_accounts where company_id in (A,B);
  delete from public.accounting_user_capabilities where company_id in (A,B);
  delete from public.expenses where company_id in (A,B);
  delete from public.policies where company_id in (A,B);
  delete from public.company_members where company_id in (A,B);
  delete from public.companies where id in (A,B);

  -- auth.users (incl. admin y spender de A para pruebas de capacidades/RLS)
  insert into auth.users(id, is_sso_user, is_anonymous) values
    (oa,false,false),(ac,false,false),(ob,false,false),
    ('10000000-0000-0000-0000-000000000004',false,false),
    ('10000000-0000-0000-0000-000000000005',false,false)
    on conflict (id) do nothing;

  -- companies
  insert into public.companies(id,name,plan,plan_seats,created_by,allow_supervisor_close,moneda,idioma,tiene_flotilla,allow_negative_inventory)
  values (A,'Empresa A (test)','empresa',10,oa,false,'MXN','es',false,false),
         (B,'Empresa B (test)','empresa',10,ob,false,'MXN','es',false,false);

  insert into public.company_members(company_id,user_id,role,status) values
    (A,oa,'owner','active'),(A,ac,'accountant','active'),(B,ob,'owner','active'),
    (A,'10000000-0000-0000-0000-000000000004','admin','active'),
    (A,'10000000-0000-0000-0000-000000000005','spender','active');

  -- catálogo A (afectables + una inactiva + una no afectable)
  insert into public.accounting_accounts(company_id,code,name,account_type,active,is_postable,account_type_norm,nature) values
    (A,'1010','Bancos','activo',true,true,'activo','deudora'),
    (A,'1180','IVA acreditable','activo',true,true,'activo','deudora'),
    (A,'2010','Proveedores','pasivo',true,true,'pasivo','acreedora'),
    (A,'2108','IVA trasladado','pasivo',true,true,'pasivo','acreedora'),
    (A,'1200','Clientes','activo',true,true,'activo','deudora'),
    (A,'4000','Ingresos','ingreso',true,true,'ingreso','acreedora'),
    (A,'6000','Gastos operativos','egreso',true,true,'egreso','deudora'),
    (A,'6200','Comisiones bancarias','egreso',true,true,'egreso','deudora'),
    (A,'1600','Anticipos a empleados','activo',true,true,'activo','deudora'),
    (A,'9999','Cuenta inactiva','egreso',false,true,'egreso','deudora'),
    (A,'6000P','Grupo gastos (no afectable)','egreso',true,false,'egreso','deudora');
  insert into public.accounting_accounts(company_id,code,name,account_type,active,is_postable) values
    (B,'1010','Bancos B','activo',true,true),(B,'6000','Gastos B','egreso',true,true);

  -- perfil fiscal A vigente
  insert into public.company_tax_profiles(company_id,rfc,legal_name,regimen_fiscal,codigo_postal_fiscal,valid_from)
    values (A,'AAA010101AAA','Empresa A SA de CV','601','64000','2026-01-01');

  -- policy + expense (para piloto GastoCheck)
  insert into public.policies(id,company_id,holder_id,name,opening_balance,status,created_by,created_at)
    values (pol,A,oa,'Poliza test',0,'open',oa,now());
  insert into public.expenses(id,company_id,policy_id,spender_id,total,subtotal,iva,status,accounting_account_id,provider_rfc,created_at,updated_at)
    values ('eeeeeeee-0000-0000-0000-000000000001',A,pol,oa,1160,1000,160,'captured',
            (select id from public.accounting_accounts where company_id=A and code='6000'),'PRO010101AAA',now(),now());
end $$;

set session_replication_role = origin;  -- triggers reactivados para el resto

-- ejercicio + periodos A (RPC como owner_a con capacidad admin)
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select public.accounting_open_fiscal_year('aaaaaaaa-0000-0000-0000-000000000001', 2026);

select public._t_assert(
  (select count(*) from public.accounting_periods where company_id='aaaaaaaa-0000-0000-0000-000000000001')=12,
  '12 periodos creados para 2026');
select 'FIXTURES OK' as status;
