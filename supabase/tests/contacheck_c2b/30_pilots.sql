-- ContaCheck C2B · Pruebas de pilotos: BancoCheck (técnico) y GastoCheck (funcional).
-- Los source_id son sintéticos (accounting_source_links.source_id es uuid libre); no requieren filas reales.
\set ON_ERROR_STOP on

-- Helper local: generar → validar → aprobar → contabilizar en un solo paso (owner genera/postea, accountant aprueba).
create or replace function public._t_full_post(p_company uuid, p_module text, p_entity text, p_source uuid, p_ver int,
  p_event text, p_type text, p_date date, p_lines jsonb, p_key text)
returns uuid language plpgsql as $$
declare oa uuid:='10000000-0000-0000-0000-000000000001'; ac uuid:='10000000-0000-0000-0000-000000000002'; v uuid;
begin
  perform set_config('request.jwt.claim.sub', oa::text, true);
  v := public.accounting_generate_voucher(p_company,p_module,p_entity,p_source,p_ver,p_event,p_type,p_date,'MXN',p_lines,null,p_event,p_key,'{}'::jsonb);
  perform public.accounting_validate_voucher(p_company,v);
  perform set_config('request.jwt.claim.sub', ac::text, true);
  perform public.accounting_approve_voucher(p_company,v,1);
  perform set_config('request.jwt.claim.sub', oa::text, true);
  perform public.accounting_post_voucher(p_company,v,2);
  return v;
end $$;

-- ===== BANCOCHECK (piloto técnico) =====
do $$
declare A uuid:='aaaaaaaa-0000-0000-0000-000000000001'; oa uuid:='10000000-0000-0000-0000-000000000001';
        bt uuid:='cccccccc-0000-0000-0000-0000cc000001'; v uuid; rev uuid; e boolean:=false; rec record;
begin
  -- BC1 comisión bancaria con IVA acreditable 16% separado (neto 86.21 + IVA 13.79 = 100)
  v := public._t_full_post(A,'bancocheck','bank_transactions',bt,1,'comision','EXPENSE','2026-02-05',
        '[{"account_code":"6200","side":"debit","amount":86.21},{"account_code":"1180","side":"debit","amount":13.79},{"account_code":"1010","side":"credit","amount":100}]'::jsonb,'BC_FEE');
  select * into rec from public.accounting_vouchers where id=v;
  perform public._t_assert(rec.status='posted' and rec.total_debit=100 and rec.total_credit=100,'BC1 comisión bancaria contabilizada y balanceada');
  perform public._t_assert((select count(*) from public.accounting_voucher_lines where voucher_id=v and account_code='1180')=1,'BC1b IVA de comisión en línea separada');

  -- BC2 conciliación de un pago originado en OTRO módulo → link, NO nueva póliza de origen
  perform set_config('request.jwt.claim.sub', oa::text, true);
  perform public.accounting_link_bank_transaction(A, v, 'cccccccc-0000-0000-0000-0000cc000099', 'payment');
  perform public._t_assert((select count(*) from public.accounting_source_links where voucher_id=v and relationship_type='payment')=1,'BC2 conciliación por vínculo (payment)');

  -- BC3 movimiento duplicado: 2ª póliza 'origin' para mismo bank_transaction+versión → bloqueada
  begin
    perform public._t_full_post(A,'bancocheck','bank_transactions',bt,1,'comision','EXPENSE','2026-02-05',
      '[{"account_code":"6200","side":"debit","amount":50},{"account_code":"1010","side":"credit","amount":50}]'::jsonb,'BC_DUP');
  exception when others then e:=true; end;
  perform public._t_assert(e,'BC3 doble contabilización de origen bloqueada (unicidad de origen)');

  -- BC4 reversa de póliza bancaria
  perform set_config('request.jwt.claim.sub', oa::text, true);
  rev := public.accounting_reverse_voucher(A, v, 'ajuste banco');
  perform public._t_assert((select reversed_by_voucher_id from public.accounting_vouchers where id=v)=rev,'BC4 reversa bancaria');
end $$;

-- ===== GASTOCHECK (piloto funcional) — dispara en 'authorized', sin tocar expenses.status =====
do $$
declare A uuid:='aaaaaaaa-0000-0000-0000-000000000001'; oa uuid:='10000000-0000-0000-0000-000000000001';
        exp uuid:='eeeeeeee-0000-0000-0000-000000000001'; v uuid; e_status text;
begin
  -- GC1 gasto con CFDI + IVA acreditable + retenciones (subtotal 1000, IVA 160, retIVA 106.67, retISR 100 → neto CxP 953.33)
  v := public._t_full_post(A,'gastocheck','expenses',exp,10,'gasto_autorizado','EXPENSE','2026-03-20',
        '[{"account_code":"6000","side":"debit","amount":1000,"tax_code":"002"},
          {"account_code":"1180","side":"debit","amount":160,"tax_code":"002"},
          {"account_code":"2108","side":"credit","amount":106.67,"tax_code":"ret_iva"},
          {"account_code":"2108","side":"credit","amount":100,"tax_code":"ret_isr"},
          {"account_code":"2010","side":"credit","amount":953.33}]'::jsonb,'GC_CFDI');
  perform public._t_assert((select status from public.accounting_vouchers where id=v)='posted','GC1 gasto con CFDI+retenciones contabilizado');

  -- GC2 gasto SIN CFDI permitido → reconocimiento también se genera
  v := public._t_full_post(A,'gastocheck','expenses','eeeeeeee-0000-0000-0000-000000000002',1,'gasto_autorizado','EXPENSE','2026-03-21',
        '[{"account_code":"6000","side":"debit","amount":500},{"account_code":"2010","side":"credit","amount":500}]'::jsonb,'GC_SINCFDI');
  perform public._t_assert((select status from public.accounting_vouchers where id=v)='posted','GC2 gasto sin CFDI contabilizado');

  -- GC3 anticipo (DR 1600 / CR 1010)
  v := public._t_full_post(A,'gastocheck','advances','eeeeeeee-0000-0000-0000-0000000000a1',1,'anticipo_entregado','EXPENSE','2026-03-22',
        '[{"account_code":"1600","side":"debit","amount":2000},{"account_code":"1010","side":"credit","amount":2000}]'::jsonb,'GC_ANT');
  perform public._t_assert((select status from public.accounting_vouchers where id=v)='posted','GC3 anticipo contabilizado');

  -- GC4 pago (DR 2010 / CR 1010) + conciliación con banco
  v := public._t_full_post(A,'gastocheck','accounts_payable','eeeeeeee-0000-0000-0000-0000000000b1',1,'cxp_pagada','EXPENSE','2026-03-25',
        '[{"account_code":"2010","side":"debit","amount":953.33},{"account_code":"1010","side":"credit","amount":953.33}]'::jsonb,'GC_PAGO');
  perform set_config('request.jwt.claim.sub', oa::text, true);
  perform public.accounting_link_bank_transaction(A, v, 'cccccccc-0000-0000-0000-0000cc0000b1', 'payment');
  perform public._t_assert((select status from public.accounting_vouchers where id=v)='posted'
      and (select count(*) from public.accounting_source_links where voucher_id=v and relationship_type='payment')=1,'GC4 pago contabilizado + conciliado');

  -- GC5 verificar que NO se añadió estado contable a expenses.status
  select status into e_status from public.expenses where id=exp;
  perform public._t_assert(e_status = 'captured','GC5 expenses.status intacto (sin estados contables)');
end $$;

drop function public._t_full_post(uuid,text,text,uuid,int,text,text,date,jsonb,text);
select 'PILOT TESTS DONE' as status;
