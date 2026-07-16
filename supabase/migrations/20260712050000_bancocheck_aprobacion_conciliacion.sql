-- BancoCheck — RPCs de aprobación de conciliación cruzada. Estas son las
-- ÚNICAS funciones que pueden mover una sugerencia (bank_match_suggestions)
-- de 'pending' a 'accepted'. El motor de matching (Edge Function
-- bancocheck-auto-match) solo propone — nunca aplica nada por sí mismo.
-- Requiere rol de contador/admin en la empresa (VoBo obligatorio).

create or replace function bancocheck_approve_suggestion(p_suggestion_id uuid)
returns bank_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_sugg      bank_match_suggestions;
  v_txn       bank_transactions;
  v_other_txn bank_transactions;
  v_old       jsonb;
  v_category  text;
begin
  select * into v_sugg from bank_match_suggestions where id = p_suggestion_id;
  if v_sugg is null then
    raise exception 'Sugerencia no encontrada';
  end if;
  if v_sugg.status <> 'pending' then
    raise exception 'Esta sugerencia ya fue % — no se puede volver a aprobar', v_sugg.status;
  end if;
  if not exists (
    select 1 from company_members
    where company_id = v_sugg.company_id and user_id = auth.uid() and status = 'active'
      and role in ('owner', 'admin', 'supervisor', 'accountant', 'contador_general')
  ) then
    raise exception 'Solo el contador o admin puede aprobar conciliaciones';
  end if;

  select to_jsonb(bt.*) into v_old from bank_transactions bt where id = v_sugg.transaction_id;

  if v_sugg.match_type = 'invoice' then
    v_category := 'client_payment';
    update bank_transactions set
      related_invoice_id = v_sugg.match_id, status = 'explained', category = v_category,
      matched_entity_type = 'invoice', updated_at = now()
    where id = v_sugg.transaction_id returning * into v_txn;

  elsif v_sugg.match_type = 'advance' then
    v_category := 'advance';
    update bank_transactions set
      related_advance_id = v_sugg.match_id, status = 'explained', category = v_category,
      matched_entity_type = 'advance', updated_at = now()
    where id = v_sugg.transaction_id returning * into v_txn;

  elsif v_sugg.match_type = 'receipt' then
    v_category := 'expense';
    update bank_transactions set
      related_receipt_id = v_sugg.match_id, status = 'explained', category = v_category,
      matched_entity_type = 'receipt', updated_at = now()
    where id = v_sugg.transaction_id returning * into v_txn;

  elsif v_sugg.match_type = 'transfer' then
    -- match_id aquí es el OTRO bank_transaction (el espejo en la otra cuenta).
    if not exists (select 1 from bank_transactions where id = v_sugg.match_id and company_id = v_sugg.company_id) then
      raise exception 'Movimiento espejo de la transferencia no encontrado';
    end if;
    update bank_transactions set
      linked_transaction_id = v_sugg.match_id, status = 'explained', category = 'internal_transfer',
      updated_at = now()
    where id = v_sugg.transaction_id returning * into v_txn;

    update bank_transactions set
      linked_transaction_id = v_sugg.transaction_id, status = 'explained', category = 'internal_transfer',
      updated_at = now()
    where id = v_sugg.match_id returning * into v_other_txn;

  else
    raise exception 'Tipo de emparejamiento desconocido: %', v_sugg.match_type;
  end if;

  update bank_match_suggestions set status = 'accepted' where id = p_suggestion_id;

  insert into bank_audit_log (company_id, user_id, bank_transaction_id, action, old_value, new_value)
  values (v_sugg.company_id, auth.uid(), v_sugg.transaction_id, 'match', v_old, to_jsonb(v_txn));

  return v_txn;
end;
$$;

create or replace function bancocheck_reject_suggestion(p_suggestion_id uuid)
returns bank_match_suggestions
language plpgsql security definer set search_path = public as $$
declare
  v_sugg bank_match_suggestions;
begin
  select * into v_sugg from bank_match_suggestions where id = p_suggestion_id;
  if v_sugg is null then
    raise exception 'Sugerencia no encontrada';
  end if;
  if not exists (
    select 1 from company_members
    where company_id = v_sugg.company_id and user_id = auth.uid() and status = 'active'
      and role in ('owner', 'admin', 'supervisor', 'accountant', 'contador_general')
  ) then
    raise exception 'Solo el contador o admin puede rechazar conciliaciones';
  end if;

  update bank_match_suggestions set status = 'rejected' where id = p_suggestion_id returning * into v_sugg;
  return v_sugg;
end;
$$;

grant execute on function bancocheck_approve_suggestion(uuid) to authenticated;
grant execute on function bancocheck_reject_suggestion(uuid) to authenticated;
