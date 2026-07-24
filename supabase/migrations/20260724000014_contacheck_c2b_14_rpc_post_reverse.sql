-- ContaCheck C2B · Bloque 14 — RPC: approve, post, reverse, link_bank_transaction, get_voucher_by_source

-- Aprobar (segregación: aprobador ≠ generador salvo admin). Optimistic lock por version.
create or replace function public.accounting_approve_voucher(p_company uuid, p_voucher_id uuid, p_expected_version integer)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare v record;
begin
  if not public.accounting_can(p_company,'accounting.approve') then raise exception 'FORBIDDEN'; end if;
  select * into v from public.accounting_vouchers where id=p_voucher_id and company_id=p_company for update;
  if v.id is null then raise exception 'VOUCHER_NOT_FOUND'; end if;
  if v.status not in ('validated','pending_review') then raise exception 'NOT_REVIEWABLE status=%', v.status; end if;
  if v.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if v.created_by = auth.uid() and not public.accounting_can(p_company,'accounting.admin') then
    raise exception 'SEGREGATION_VIOLATION generate<>approve';
  end if;
  update public.accounting_vouchers
     set status='approved', approved_by=auth.uid(), approved_at=now(), version=version+1
   where id=p_voucher_id;
  perform public.accounting_log_audit(p_company,'contacheck_voucher',p_voucher_id,'approve',null);
end $$;

-- Contabilizar (asigna folio, valida periodo abierto, recalcula/verifica balance, inmutable).
create or replace function public.accounting_post_voucher(p_company uuid, p_voucher_id uuid, p_expected_version integer)
returns text language plpgsql security definer set search_path = pg_catalog, public as $$
declare v record; v_period record; sd numeric; sc numeric; v_num text; v_fy int;
begin
  if not public.accounting_can(p_company,'accounting.post') then raise exception 'FORBIDDEN'; end if;
  select * into v from public.accounting_vouchers where id=p_voucher_id and company_id=p_company for update;
  if v.id is null then raise exception 'VOUCHER_NOT_FOUND'; end if;
  if v.status = 'posted' then raise exception 'ALREADY_POSTED'; end if;
  if v.status <> 'approved' then raise exception 'NOT_APPROVED status=%', v.status; end if;
  if v.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if v.approved_by = auth.uid() and not public.accounting_can(p_company,'accounting.admin') then
    raise exception 'SEGREGATION_VIOLATION approve<>post';
  end if;

  select * into v_period from public.accounting_periods
   where id = public.accounting_period_for_date(p_company, v.accounting_date);
  if v_period.id is null then raise exception 'PERIOD_NOT_FOUND'; end if;
  if v_period.status <> 'open' then raise exception 'PERIOD_NOT_OPEN status=%', v_period.status; end if;

  select coalesce(sum(debit),0), coalesce(sum(credit),0) into sd, sc
    from public.accounting_voucher_lines where voucher_id=p_voucher_id;
  if sd <> sc or sd = 0 then raise exception 'UNBALANCED debit=% credit=%', sd, sc; end if;

  v_fy := coalesce(v.fiscal_year, extract(year from v.accounting_date)::int);
  v_num := public.accounting_next_voucher_number(p_company, v_fy, v.voucher_type);

  update public.accounting_vouchers
     set status='posted', voucher_number=v_num, fiscal_year=v_fy, fiscal_period_id=v_period.id,
         total_debit=sd, total_credit=sc, posted_by=auth.uid(), posted_at=now(), version=version+1
   where id=p_voucher_id;
  perform public.accounting_log_audit(p_company,'contacheck_voucher',p_voucher_id,'post',jsonb_build_object('voucher_number',v_num));
  return v_num;
end $$;

-- Reversa formal: póliza espejo, periodo abierto si el original está cerrado, original inmutable salvo referencia.
create or replace function public.accounting_reverse_voucher(
  p_company uuid, p_voucher_id uuid, p_reason text, p_accounting_date date default null, p_expected_version integer default null)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare v record; v_period record; v_date date; v_rev uuid; v_num text; ln record; v_fy int;
begin
  if not public.accounting_can(p_company,'accounting.reverse') then raise exception 'FORBIDDEN'; end if;
  select * into v from public.accounting_vouchers where id=p_voucher_id and company_id=p_company for update;
  if v.id is null then raise exception 'VOUCHER_NOT_FOUND'; end if;
  if v.status <> 'posted' then raise exception 'NOT_POSTED'; end if;
  if v.reversed_by_voucher_id is not null then raise exception 'ALREADY_REVERSED'; end if;
  if v.reversal_of_voucher_id is not null then raise exception 'CANNOT_REVERSE_A_REVERSAL'; end if;
  if p_expected_version is not null and v.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;

  v_date := coalesce(p_accounting_date, v.accounting_date);
  select * into v_period from public.accounting_periods where id = public.accounting_period_for_date(p_company, v_date);
  if v_period.id is null or v_period.status <> 'open' then
    -- si el periodo del original está cerrado, usar el periodo abierto de la fecha actual
    select * into v_period from public.accounting_periods
      where company_id=p_company and status='open' order by start_date desc limit 1;
    if v_period.id is null then raise exception 'NO_OPEN_PERIOD_FOR_REVERSAL'; end if;
    v_date := v_period.start_date;
  end if;
  v_fy := v_period.fiscal_year;
  v_num := public.accounting_next_voucher_number(p_company, v_fy, v.voucher_type);

  insert into public.accounting_vouchers(company_id, voucher_type, source_module, source_ids, currency,
      entries, total_debit, total_credit, status, event_type, accounting_date, occurred_at, fiscal_year,
      fiscal_period_id, voucher_number, description, party_id, reversal_of_voucher_id, created_by, approved_by, posted_by, posted_at)
  values (p_company, v.voucher_type, v.source_module, v.source_ids, v.currency,
      v.entries, v.total_credit, v.total_debit, 'posted', 'reversal', v_date, now(), v_fy,
      v_period.id, v_num, 'Reversa de '||coalesce(v.voucher_number,''), v.party_id, p_voucher_id,
      auth.uid(), auth.uid(), auth.uid(), now())
  returning id into v_rev;

  -- líneas invertidas (debe<->haber)
  for ln in select * from public.accounting_voucher_lines where voucher_id=p_voucher_id order by line_number loop
    insert into public.accounting_voucher_lines(company_id, voucher_id, line_number, account_id, account_code,
        debit, credit, description, party_id, cost_center_id, tax_code, tax_amount, source_detail_id)
    values (p_company, v_rev, ln.line_number, ln.account_id, ln.account_code,
        ln.credit, ln.debit, 'Reversa: '||coalesce(ln.description,''), ln.party_id, ln.cost_center_id,
        ln.tax_code, ln.tax_amount, ln.id);
  end loop;

  insert into public.accounting_source_links(company_id, voucher_id, source_module, source_entity, source_id,
      source_version, event_type, relationship_type)
  values (p_company, v_rev, v.source_module, 'accounting_vouchers', p_voucher_id, coalesce(v.version,1), 'reversal', 'reversal');

  update public.accounting_vouchers set reversed_by_voucher_id = v_rev where id = p_voucher_id;
  perform public.accounting_log_audit(p_company,'contacheck_voucher',p_voucher_id,'reverse',jsonb_build_object('reversal_voucher_id',v_rev),p_reason);
  return v_rev;
end $$;

-- Vincular movimiento bancario (conciliación, no origina).
create or replace function public.accounting_link_bank_transaction(
  p_company uuid, p_voucher_id uuid, p_bank_transaction_id uuid, p_relationship text default 'bank_match')
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_id uuid;
begin
  if not (public.accounting_can(p_company,'accounting.post') or public.accounting_can(p_company,'accounting.review')) then
    raise exception 'FORBIDDEN'; end if;
  insert into public.accounting_source_links(company_id, voucher_id, source_module, source_entity, source_id,
      source_version, event_type, relationship_type)
  values (p_company, p_voucher_id, 'bancocheck', 'bank_transactions', p_bank_transaction_id, 1, 'bank_match', p_relationship)
  returning id into v_id;
  perform public.accounting_log_audit(p_company,'contacheck_voucher',p_voucher_id,'link_bank',jsonb_build_object('bank_transaction_id',p_bank_transaction_id));
  return v_id;
end $$;

create or replace function public.accounting_get_voucher_by_source(
  p_company uuid, p_source_module text, p_source_entity text, p_source_id uuid)
returns setof public.accounting_vouchers language sql stable security definer set search_path = pg_catalog, public as $$
  select v.* from public.accounting_vouchers v
   join public.accounting_source_links l on l.voucher_id = v.id
  where l.company_id = p_company and l.source_module = p_source_module
    and l.source_entity = p_source_entity and l.source_id = p_source_id;
$$;

revoke all on function public.accounting_approve_voucher(uuid,uuid,integer) from public, anon;
revoke all on function public.accounting_post_voucher(uuid,uuid,integer) from public, anon;
revoke all on function public.accounting_reverse_voucher(uuid,uuid,text,date,integer) from public, anon;
revoke all on function public.accounting_link_bank_transaction(uuid,uuid,uuid,text) from public, anon;
revoke all on function public.accounting_get_voucher_by_source(uuid,text,text,uuid) from public, anon;
grant execute on function public.accounting_approve_voucher(uuid,uuid,integer) to authenticated, service_role;
grant execute on function public.accounting_post_voucher(uuid,uuid,integer) to authenticated, service_role;
grant execute on function public.accounting_reverse_voucher(uuid,uuid,text,date,integer) to authenticated, service_role;
grant execute on function public.accounting_link_bank_transaction(uuid,uuid,uuid,text) to authenticated, service_role;
grant execute on function public.accounting_get_voucher_by_source(uuid,text,text,uuid) to authenticated, service_role;
