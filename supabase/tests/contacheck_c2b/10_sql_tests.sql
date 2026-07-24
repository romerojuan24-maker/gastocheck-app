-- ContaCheck C2B · Pruebas SQL (estructura, ciclo, balance, idempotencia, inmutabilidad, periodos, segregación,
-- reversa, reglas, parties, RLS). Requiere 00_fixtures.sql aplicado.
\set ON_ERROR_STOP on
\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''
\set OA '''10000000-0000-0000-0000-000000000001'''
\set AC '''10000000-0000-0000-0000-000000000002'''
\set OB '''10000000-0000-0000-0000-000000000003'''

-- ===== A) Ciclo de vida happy-path + numeración + snapshot fiscal =====
do $$
declare A uuid:='aaaaaaaa-0000-0000-0000-000000000001'; oa uuid:='10000000-0000-0000-0000-000000000001';
        ac uuid:='10000000-0000-0000-0000-000000000002'; v uuid; st text; num text; rec record;
begin
  perform set_config('request.jwt.claim.sub', oa::text, true);
  v := public.accounting_generate_voucher(A,'gastocheck','expenses','eeeeeeee-0000-0000-0000-000000000001',1,
        'gasto_autorizado','EXPENSE','2026-03-15','MXN',
        '[{"account_code":"6000","side":"debit","amount":1000},{"account_code":"1180","side":"debit","amount":160},{"account_code":"2010","side":"credit","amount":1160}]'::jsonb,
        null,'Gasto proveedor','K1', '{"subtotal":1000,"iva":160,"total":1160}'::jsonb);
  st := public.accounting_validate_voucher(A, v);
  perform public._t_assert(st='validated','A1 validate→validated');
  perform set_config('request.jwt.claim.sub', ac::text, true);   -- aprobador ≠ generador
  perform public.accounting_approve_voucher(A, v, 1);
  perform set_config('request.jwt.claim.sub', oa::text, true);   -- contabilizador ≠ aprobador
  num := public.accounting_post_voucher(A, v, 2);
  select * into rec from public.accounting_vouchers where id=v;
  perform public._t_assert(rec.status='posted','A2 status posted');
  perform public._t_assert(rec.voucher_number='EXPENSE-2026-000001','A3 folio compuesto');
  perform public._t_assert(rec.fiscal_period_id is not null,'A4 periodo asignado');
  perform public._t_assert(rec.total_debit=1160 and rec.total_credit=1160,'A5 balance 1160');
  perform public._t_assert((rec.tax_profile_snapshot->>'rfc')='AAA010101AAA','A6 snapshot fiscal');
  perform public._t_assert((select count(*) from public.accounting_source_links where voucher_id=v and relationship_type='origin')=1,'A7 source_link origin');
end $$;

-- ===== B) Idempotencia (misma llave/hash → mismo voucher; hash distinto → conflicto) =====
do $$
declare A uuid:='aaaaaaaa-0000-0000-0000-000000000001'; oa uuid:='10000000-0000-0000-0000-000000000001';
        v1 uuid; v2 uuid; conflicted boolean:=false;
begin
  perform set_config('request.jwt.claim.sub', oa::text, true);
  select voucher_id into v1 from public.accounting_idempotency_requests where company_id=A and idempotency_key='K1';
  v2 := public.accounting_generate_voucher(A,'gastocheck','expenses','eeeeeeee-0000-0000-0000-000000000001',1,
        'gasto_autorizado','EXPENSE','2026-03-15','MXN',
        '[{"account_code":"6000","side":"debit","amount":1000},{"account_code":"1180","side":"debit","amount":160},{"account_code":"2010","side":"credit","amount":1160}]'::jsonb,
        null,'Gasto proveedor','K1', '{"subtotal":1000,"iva":160,"total":1160}'::jsonb);
  perform public._t_assert(v1=v2,'B1 misma llave+hash → mismo voucher');
  begin
    perform public.accounting_generate_voucher(A,'gastocheck','expenses','eeeeeeee-0000-0000-0000-000000000001',1,
      'gasto_autorizado','EXPENSE','2026-03-15','MXN',
      '[{"account_code":"6000","side":"debit","amount":9999},{"account_code":"2010","side":"credit","amount":9999}]'::jsonb,
      null,'Otro','K1', '{"subtotal":9999}'::jsonb);
  exception when others then if sqlerrm like '%IDEMPOTENCY_CONFLICT%' then conflicted:=true; end if;
  end;
  perform public._t_assert(conflicted,'B2 misma llave+hash distinto → IDEMPOTENCY_CONFLICT');
end $$;

-- ===== C) Constraints de línea (XOR débito/crédito) e inmutabilidad =====
do $$
declare A uuid:='aaaaaaaa-0000-0000-0000-000000000001'; v uuid; e1 boolean:=false; e2 boolean:=false; e3 boolean:=false; ln uuid;
begin
  select voucher_id into v from public.accounting_idempotency_requests where company_id=A and idempotency_key='K1';
  begin
    insert into public.accounting_voucher_lines(company_id,voucher_id,line_number,account_id,account_code,debit,credit)
    values (A,v,99,(select id from public.accounting_accounts where company_id=A and code='6000'),'6000',5,5);
  exception when others then e1:=true; end;
  perform public._t_assert(e1,'C1 débito y crédito ambos > 0 rechazado');
  -- inmutabilidad encabezado
  begin update public.accounting_vouchers set total_debit=1 where id=v; exception when others then e2:=true; end;
  perform public._t_assert(e2,'C2 UPDATE de encabezado posted rechazado');
  -- inmutabilidad línea
  select id into ln from public.accounting_voucher_lines where voucher_id=v limit 1;
  begin update public.accounting_voucher_lines set debit=debit+1 where id=ln; exception when others then e3:=true; end;
  perform public._t_assert(e3,'C3 UPDATE de línea posted rechazado');
end $$;

-- ===== D) Periodo cerrado impide contabilizar =====
do $$
declare A uuid:='aaaaaaaa-0000-0000-0000-000000000001'; oa uuid:='10000000-0000-0000-0000-000000000001';
        ac uuid:='10000000-0000-0000-0000-000000000002'; v uuid; pid uuid; e boolean:=false;
begin
  perform set_config('request.jwt.claim.sub', oa::text, true);
  v := public.accounting_generate_voucher(A,'gastocheck','expenses','eeeeeeee-0000-0000-0000-000000000001',2,
        'gasto_autorizado','EXPENSE','2026-04-10','MXN',
        '[{"account_code":"6000","side":"debit","amount":500},{"account_code":"2010","side":"credit","amount":500}]'::jsonb,
        null,'Abril','K_APR','{"x":1}'::jsonb);
  perform public.accounting_validate_voucher(A,v);
  perform set_config('request.jwt.claim.sub', ac::text, true);
  perform public.accounting_approve_voucher(A,v,1);
  -- cerrar el periodo de abril (mes 4) como owner (close_period)
  perform set_config('request.jwt.claim.sub', oa::text, true);
  select id into pid from public.accounting_periods where company_id=A and fiscal_year=2026 and month=4;
  perform public.accounting_close_period(A,pid,true);  -- hard close
  begin perform public.accounting_post_voucher(A,v,2); exception when others then if sqlerrm like '%PERIOD_NOT_OPEN%' then e:=true; end if; end;
  perform public._t_assert(e,'D1 post en periodo cerrado → PERIOD_NOT_OPEN');
  perform public.accounting_reopen_period(A,pid);  -- reabrir para no dejar residuo
end $$;

-- ===== E) Segregación de funciones (generador ≠ aprobador) =====
do $$
declare A uuid:='aaaaaaaa-0000-0000-0000-000000000001'; ac uuid:='10000000-0000-0000-0000-000000000002'; v uuid; e boolean:=false;
begin
  perform set_config('request.jwt.claim.sub', ac::text, true);  -- accountant genera
  v := public.accounting_generate_voucher(A,'gastocheck','expenses','eeeeeeee-0000-0000-0000-000000000001',3,
        'gasto_autorizado','EXPENSE','2026-05-10','MXN',
        '[{"account_code":"6000","side":"debit","amount":300},{"account_code":"2010","side":"credit","amount":300}]'::jsonb,
        null,'Mayo','K_SEG','{"x":2}'::jsonb);
  perform public.accounting_validate_voucher(A,v);
  begin perform public.accounting_approve_voucher(A,v,1);  -- mismo accountant aprueba (no admin)
  exception when others then if sqlerrm like '%SEGREGATION%' then e:=true; end if; end;
  perform public._t_assert(e,'E1 mismo usuario genera y aprueba → SEGREGATION_VIOLATION');
end $$;

-- ===== F) Reversa =====
do $$
declare A uuid:='aaaaaaaa-0000-0000-0000-000000000001'; oa uuid:='10000000-0000-0000-0000-000000000001';
        v uuid; rev uuid; e boolean:=false; rec record; recr record;
begin
  perform set_config('request.jwt.claim.sub', oa::text, true);
  select voucher_id into v from public.accounting_idempotency_requests where company_id=A and idempotency_key='K1';
  rev := public.accounting_reverse_voucher(A, v, 'ajuste');
  select * into rec from public.accounting_vouchers where id=v;
  select * into recr from public.accounting_vouchers where id=rev;
  perform public._t_assert(rec.reversed_by_voucher_id=rev,'F1 original marcado reversed_by');
  perform public._t_assert(recr.reversal_of_voucher_id=v and recr.status='posted','F2 reversa posted ligada');
  perform public._t_assert(recr.total_debit=rec.total_credit and recr.total_credit=rec.total_debit,'F3 totales invertidos');
  begin perform public.accounting_reverse_voucher(A,v,'otra'); exception when others then if sqlerrm like '%ALREADY_REVERSED%' then e:=true; end if; end;
  perform public._t_assert(e,'F4 reversa duplicada bloqueada');
end $$;

-- ===== G) Reglas: publicación validada + resolución + ambigüedad + cuenta inactiva =====
do $$
declare A uuid:='aaaaaaaa-0000-0000-0000-000000000001'; oa uuid:='10000000-0000-0000-0000-000000000001';
        r1 uuid; rv1 uuid; r2 uuid; rv2 uuid; res jsonb; e boolean:=false; rbad uuid; rvbad uuid;
begin
  perform set_config('request.jwt.claim.sub', oa::text, true);
  insert into public.accounting_rules(company_id,name,module,event_type,priority,status) values (A,'Gasto base','gastocheck','gasto_autorizado',100,'draft') returning id into r1;
  insert into public.accounting_rule_versions(rule_id,version) values (r1,1) returning id into rv1;
  insert into public.accounting_rule_outputs(rule_version_id,line_number,side,account_selector,amount_source) values
    (rv1,1,'debit', '{"type":"code","code":"6000"}','subtotal'),
    (rv1,2,'debit', '{"type":"code","code":"1180"}','iva'),
    (rv1,3,'credit','{"type":"code","code":"2010"}','total');
  perform public.accounting_publish_rule(A, rv1);
  perform public._t_assert((select status from public.accounting_rules where id=r1)='active','G1 regla activa tras publicar');
  res := public.accounting_resolve_rules(A,'gastocheck','gasto_autorizado','{"subtotal":1000,"iva":160,"total":1160}'::jsonb);
  perform public._t_assert(res->>'level'='AUTO_APPROVE' and jsonb_array_length(res->'lines')=3,'G2 resolución devuelve 3 líneas');
  -- segunda regla activa misma prioridad → ambigua
  insert into public.accounting_rules(company_id,name,module,event_type,priority,status) values (A,'Gasto dup','gastocheck','gasto_autorizado',100,'draft') returning id into r2;
  insert into public.accounting_rule_versions(rule_id,version) values (r2,1) returning id into rv2;
  insert into public.accounting_rule_outputs(rule_version_id,line_number,side,account_selector,amount_source) values
    (rv2,1,'debit','{"type":"code","code":"6000"}','total'),(rv2,2,'credit','{"type":"code","code":"2010"}','total');
  perform public.accounting_publish_rule(A, rv2);
  res := public.accounting_resolve_rules(A,'gastocheck','gasto_autorizado','{"total":1}'::jsonb);
  perform public._t_assert(res->>'reason'='RULE_AMBIGUOUS','G3 dos reglas igual prioridad → RULE_AMBIGUOUS');
  update public.accounting_rules set status='inactive' where id=r2;  -- desambiguar
  -- publicar regla con cuenta inactiva → error
  insert into public.accounting_rules(company_id,name,module,event_type,status) values (A,'Mala','gastocheck','otro','draft') returning id into rbad;
  insert into public.accounting_rule_versions(rule_id,version) values (rbad,1) returning id into rvbad;
  insert into public.accounting_rule_outputs(rule_version_id,line_number,side,account_selector,amount_source) values
    (rvbad,1,'debit','{"type":"code","code":"9999"}','total'),(rvbad,2,'credit','{"type":"code","code":"2010"}','total');
  begin perform public.accounting_publish_rule(A,rvbad); exception when others then if sqlerrm like '%INACTIVE%' then e:=true; end if; end;
  perform public._t_assert(e,'G4 publicar regla con cuenta inactiva → rechazada');
end $$;

-- ===== H) Parties (dedup por RFC, genérico sin dedup) =====
do $$
declare A uuid:='aaaaaaaa-0000-0000-0000-000000000001'; oa uuid:='10000000-0000-0000-0000-000000000001'; p1 uuid; p2 uuid; g1 uuid; g2 uuid;
begin
  perform set_config('request.jwt.claim.sub', oa::text, true);
  p1 := public.accounting_upsert_party(A,'persona_moral','Proveedor X','PRX010101AAA');
  p2 := public.accounting_upsert_party(A,'persona_moral','Proveedor X dup',' prx010101aaa ');
  perform public._t_assert(p1=p2,'H1 dedup por RFC normalizado');
  g1 := public.accounting_upsert_party(A,'generico','Publico 1','XAXX010101000');
  g2 := public.accounting_upsert_party(A,'generico','Publico 2','XAXX010101000');
  perform public._t_assert(g1<>g2,'H2 RFC genérico no deduplica');
end $$;

-- ===== I) get_voucher_by_source =====
do $$
declare A uuid:='aaaaaaaa-0000-0000-0000-000000000001'; oa uuid:='10000000-0000-0000-0000-000000000001'; n int;
begin
  perform set_config('request.jwt.claim.sub', oa::text, true);
  select count(*) into n from public.accounting_get_voucher_by_source(A,'gastocheck','expenses','eeeeeeee-0000-0000-0000-000000000001');
  perform public._t_assert(n>=1,'I1 get_voucher_by_source encuentra la póliza');
end $$;

select 'SQL TESTS DONE' as status;
