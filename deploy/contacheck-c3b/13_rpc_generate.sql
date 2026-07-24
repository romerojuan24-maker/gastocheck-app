-- ContaCheck C2B · Bloque 13 — RPC: resolve_rules, generate_voucher, validate_voucher (SECURITY DEFINER)

-- Resolución de reglas: devuelve regla ganadora + líneas plantilla o excepción (ambigua/ausente).
create or replace function public.accounting_resolve_rules(p_company uuid, p_module text, p_event_type text, p_payload jsonb)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare v_cnt int; v_maxp int; v_tie int; v_rule record; v_lines jsonb;
begin
  select count(*), max(priority) into v_cnt, v_maxp from public.accounting_rules
   where company_id=p_company and module=p_module and event_type=p_event_type and status='active';
  if v_cnt = 0 then return jsonb_build_object('level','CONFIGURATION_REQUIRED','reason','RULE_MISSING'); end if;
  select count(*) into v_tie from public.accounting_rules
   where company_id=p_company and module=p_module and event_type=p_event_type and status='active' and priority=v_maxp;
  if v_tie > 1 then return jsonb_build_object('level','CONFIGURATION_REQUIRED','reason','RULE_AMBIGUOUS'); end if;
  select * into v_rule from public.accounting_rules
   where company_id=p_company and module=p_module and event_type=p_event_type and status='active'
   order by priority desc limit 1;
  select jsonb_agg(jsonb_build_object(
           'line_number', o.line_number, 'side', o.side,
           'account_code', o.account_selector->>'code',
           'amount', (p_payload->>o.amount_source)::numeric,
           'tax_code', o.tax_code, 'requires_review', o.requires_review))
    into v_lines
    from public.accounting_rule_outputs o
    join public.accounting_rule_versions rv on rv.id = v_rule.active_version_id
   where o.rule_version_id = v_rule.active_version_id;
  return jsonb_build_object('level','AUTO_APPROVE','rule_version_id', v_rule.active_version_id, 'lines', coalesce(v_lines,'[]'::jsonb));
end $$;

-- Generación de póliza propuesta (idempotente, transaccional). No asigna folio (eso ocurre al postear).
-- p_lines: [{account_code, side:'debit'|'credit', amount, description, tax_code, tax_amount, cost_center_id, party_id, dimensions:[{type,ref_id,value}]}]
create or replace function public.accounting_generate_voucher(
  p_company uuid, p_source_module text, p_source_entity text, p_source_id uuid, p_source_version integer,
  p_event_type text, p_voucher_type text, p_accounting_date date, p_currency text,
  p_lines jsonb, p_party_id uuid, p_description text, p_idempotency_key text, p_payload jsonb default '{}'::jsonb,
  p_request_id text default null)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_hash text; v_existing record; v_voucher uuid; v_line jsonb; v_line_id uuid;
  v_td numeric := 0; v_tc numeric := 0; v_ln int := 0; a record; v_dim jsonb;
begin
  if not public.accounting_can(p_company, 'accounting.generate') then raise exception 'FORBIDDEN'; end if;
  v_hash := public.accounting_payload_hash(p_payload || jsonb_build_object('lines',p_lines));

  -- Idempotencia: el INSERT bloquea a la 2ª conexión hasta el commit de la 1ª (unique_violation → devuelve existente).
  begin
    insert into public.accounting_idempotency_requests(company_id, idempotency_key, payload_hash, status, request_id)
    values (p_company, p_idempotency_key, v_hash, 'pending', p_request_id);
  exception when unique_violation then
    select * into v_existing from public.accounting_idempotency_requests
      where company_id = p_company and idempotency_key = p_idempotency_key;
    if v_existing.payload_hash <> v_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing.voucher_id;
  end;

  insert into public.accounting_vouchers(
      company_id, voucher_type, source_module, source_ids, currency, entries, total_debit, total_credit,
      status, event_type, accounting_date, occurred_at, fiscal_year, exchange_rate, description, party_id,
      tax_profile_snapshot, idempotency_key, created_by, version)
  values (
      p_company, p_voucher_type, p_source_module, array[p_source_id], coalesce(p_currency,'MXN'),
      jsonb_build_object('lines', p_lines), 0, 0, 'generated', p_event_type, p_accounting_date,
      now(), extract(year from p_accounting_date)::int, 1.0, p_description, p_party_id,
      public.accounting_tax_profile_for_date(p_company, p_accounting_date), p_idempotency_key, auth.uid(), 1)
  returning id into v_voucher;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_ln := v_ln + 1;
    select id, code into a from public.accounting_accounts
      where company_id = p_company and code = (v_line->>'account_code');
    if a.id is null then raise exception 'ACCOUNT_NOT_FOUND code=%', (v_line->>'account_code'); end if;
    insert into public.accounting_voucher_lines(
        company_id, voucher_id, line_number, account_id, account_code, debit, credit,
        description, party_id, cost_center_id, tax_code, tax_amount)
    values (p_company, v_voucher, v_ln, a.id, a.code,
        case when v_line->>'side'='debit'  then (v_line->>'amount')::numeric else 0 end,
        case when v_line->>'side'='credit' then (v_line->>'amount')::numeric else 0 end,
        v_line->>'description',
        nullif(v_line->>'party_id','')::uuid, nullif(v_line->>'cost_center_id','')::uuid,
        v_line->>'tax_code', nullif(v_line->>'tax_amount','')::numeric)
    returning id into v_line_id;
    v_td := v_td + case when v_line->>'side'='debit'  then (v_line->>'amount')::numeric else 0 end;
    v_tc := v_tc + case when v_line->>'side'='credit' then (v_line->>'amount')::numeric else 0 end;
    if v_line ? 'dimensions' then
      for v_dim in select * from jsonb_array_elements(v_line->'dimensions') loop
        insert into public.accounting_line_dimensions(company_id, line_id, dimension_type, dimension_ref_id, dimension_value)
        values (p_company, v_line_id, v_dim->>'type', nullif(v_dim->>'ref_id','')::uuid, v_dim->>'value')
        on conflict (line_id, dimension_type) do nothing;
      end loop;
    end if;
  end loop;

  update public.accounting_vouchers set total_debit = v_td, total_credit = v_tc where id = v_voucher;

  insert into public.accounting_source_links(company_id, voucher_id, source_module, source_entity, source_id,
      source_version, event_type, relationship_type)
  values (p_company, v_voucher, p_source_module, p_source_entity, p_source_id, p_source_version, p_event_type, 'origin');

  update public.accounting_idempotency_requests
     set status='completed', voucher_id=v_voucher, response_summary=jsonb_build_object('voucher_id',v_voucher)
   where company_id = p_company and idempotency_key = p_idempotency_key;

  perform public.accounting_log_audit(p_company, 'contacheck_voucher', v_voucher, 'generate',
    jsonb_build_object('source_module',p_source_module,'event_type',p_event_type));
  return v_voucher;
end $$;

-- Validación: balance + periodo abierto → 'validated' | 'pending_configuration'.
create or replace function public.accounting_validate_voucher(p_company uuid, p_voucher_id uuid)
returns text language plpgsql security definer set search_path = pg_catalog, public as $$
declare v record; v_period uuid; v_new text;
begin
  if not public.accounting_can(p_company, 'accounting.generate') then raise exception 'FORBIDDEN'; end if;
  select * into v from public.accounting_vouchers where id=p_voucher_id and company_id=p_company for update;
  if v.id is null then raise exception 'VOUCHER_NOT_FOUND'; end if;
  v_period := public.accounting_period_for_date(p_company, v.accounting_date);
  if v.total_debit <> v.total_credit or v.total_debit = 0 then v_new := 'pending_configuration';
  elsif v_period is null then v_new := 'pending_configuration';
  else v_new := 'validated'; end if;
  update public.accounting_vouchers set status=v_new, fiscal_period_id=v_period where id=p_voucher_id;
  perform public.accounting_log_audit(p_company,'contacheck_voucher',p_voucher_id,'validate',jsonb_build_object('status',v_new));
  return v_new;
end $$;

revoke all on function public.accounting_resolve_rules(uuid,text,text,jsonb) from public, anon;
revoke all on function public.accounting_generate_voucher(uuid,text,text,uuid,integer,text,text,date,text,jsonb,uuid,text,text,jsonb,text) from public, anon;
revoke all on function public.accounting_validate_voucher(uuid,uuid) from public, anon;
grant execute on function public.accounting_resolve_rules(uuid,text,text,jsonb) to authenticated, service_role;
grant execute on function public.accounting_generate_voucher(uuid,text,text,uuid,integer,text,text,date,text,jsonb,uuid,text,text,jsonb,text) to authenticated, service_role;
grant execute on function public.accounting_validate_voucher(uuid,uuid) to authenticated, service_role;
