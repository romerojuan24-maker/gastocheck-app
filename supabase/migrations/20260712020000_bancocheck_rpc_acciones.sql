-- BancoCheck — acciones atómicas (clasificar/relacionar/personal/ignorar).
-- Cada RPC hace el UPDATE del movimiento + el INSERT del audit log dentro
-- de la MISMA función = misma transacción de Postgres (regla #9: "toda
-- acción crítica debe ejecutarse en transacción de base de datos"). Un
-- cliente haciendo dos llamadas REST separadas NO es atómico; una función
-- SQL sí lo es.

create or replace function bancocheck_classify(
  p_transaction_id uuid,
  p_status         text,
  p_category       text default null,
  p_notes          text default null
) returns bank_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_txn      bank_transactions;
  v_old      jsonb;
  v_company  uuid;
begin
  select company_id into v_company from bank_transactions where id = p_transaction_id;
  if v_company is null then
    raise exception 'Movimiento no encontrado';
  end if;
  if not exists (
    select 1 from company_members
    where company_id = v_company and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'Sin acceso a esta empresa';
  end if;

  select to_jsonb(bt.*) into v_old from bank_transactions bt where id = p_transaction_id;

  update bank_transactions set
    status     = p_status,
    category   = coalesce(p_category, category),
    notes      = coalesce(p_notes, notes),
    updated_at = now()
  where id = p_transaction_id
  returning * into v_txn;

  insert into bank_audit_log (company_id, user_id, bank_transaction_id, action, old_value, new_value)
  values (v_company, auth.uid(), p_transaction_id, 'classify', v_old, to_jsonb(v_txn));

  return v_txn;
end;
$$;

create or replace function bancocheck_match(
  p_transaction_id uuid,
  p_entity_type    text,   -- 'receipt' | 'invoice' | 'advance'
  p_entity_id      uuid
) returns bank_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_txn      bank_transactions;
  v_old      jsonb;
  v_company  uuid;
begin
  select company_id into v_company from bank_transactions where id = p_transaction_id;
  if v_company is null then
    raise exception 'Movimiento no encontrado';
  end if;
  if not exists (
    select 1 from company_members
    where company_id = v_company and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'Sin acceso a esta empresa';
  end if;
  if p_entity_type not in ('receipt', 'invoice', 'advance') then
    raise exception 'Tipo de entidad inválido: %', p_entity_type;
  end if;

  select to_jsonb(bt.*) into v_old from bank_transactions bt where id = p_transaction_id;

  update bank_transactions set
    status                = 'explained',
    matched_entity_type    = p_entity_type,
    related_receipt_id    = case when p_entity_type = 'receipt' then p_entity_id else related_receipt_id end,
    related_invoice_id    = case when p_entity_type = 'invoice' then p_entity_id else related_invoice_id end,
    related_advance_id    = case when p_entity_type = 'advance' then p_entity_id else related_advance_id end,
    updated_at             = now()
  where id = p_transaction_id
  returning * into v_txn;

  insert into bank_audit_log (company_id, user_id, bank_transaction_id, action, old_value, new_value)
  values (v_company, auth.uid(), p_transaction_id, 'match', v_old, to_jsonb(v_txn));

  return v_txn;
end;
$$;

create or replace function bancocheck_mark_personal(
  p_transaction_id uuid,
  p_is_personal    boolean
) returns bank_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_txn      bank_transactions;
  v_old      jsonb;
  v_company  uuid;
begin
  select company_id into v_company from bank_transactions where id = p_transaction_id;
  if v_company is null then
    raise exception 'Movimiento no encontrado';
  end if;
  if not exists (
    select 1 from company_members
    where company_id = v_company and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'Sin acceso a esta empresa';
  end if;

  select to_jsonb(bt.*) into v_old from bank_transactions bt where id = p_transaction_id;

  update bank_transactions set
    is_personal = p_is_personal,
    status      = case when p_is_personal then 'personal' else 'new' end,
    updated_at  = now()
  where id = p_transaction_id
  returning * into v_txn;

  insert into bank_audit_log (company_id, user_id, bank_transaction_id, action, old_value, new_value)
  values (v_company, auth.uid(), p_transaction_id, 'mark_personal', v_old, to_jsonb(v_txn));

  return v_txn;
end;
$$;

create or replace function bancocheck_ignore(
  p_transaction_id uuid
) returns bank_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_txn      bank_transactions;
  v_old      jsonb;
  v_company  uuid;
begin
  select company_id into v_company from bank_transactions where id = p_transaction_id;
  if v_company is null then
    raise exception 'Movimiento no encontrado';
  end if;
  if not exists (
    select 1 from company_members
    where company_id = v_company and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'Sin acceso a esta empresa';
  end if;

  select to_jsonb(bt.*) into v_old from bank_transactions bt where id = p_transaction_id;

  update bank_transactions set status = 'ignored', updated_at = now()
  where id = p_transaction_id
  returning * into v_txn;

  insert into bank_audit_log (company_id, user_id, bank_transaction_id, action, old_value, new_value)
  values (v_company, auth.uid(), p_transaction_id, 'ignore', v_old, to_jsonb(v_txn));

  return v_txn;
end;
$$;

grant execute on function bancocheck_classify(uuid, text, text, text) to authenticated;
grant execute on function bancocheck_match(uuid, text, uuid) to authenticated;
grant execute on function bancocheck_mark_personal(uuid, boolean) to authenticated;
grant execute on function bancocheck_ignore(uuid) to authenticated;
