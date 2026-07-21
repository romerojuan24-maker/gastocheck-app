-- ============================================================================
-- BancoCheck — Clasificación contable real + cliente/tercero en movimientos
-- (retro Juan 2026-07-21, puntos 1 y 3 de BancoCheck)
--
-- Problema (auditoría): bank_transactions guarda 'category' como TEXTO LIBRE
-- ('expense', 'client_payment', ...) — nunca se liga a una cuenta del catálogo
-- accounting_accounts ni a un cliente/tercero. El intento de columnas
-- linked_client_id/linked_supplier_id (migración 20260708000000) NUNCA aplicó
-- porque estaba dentro de un CREATE TABLE IF NOT EXISTS sobre tabla ya creada.
--
-- Este ALTER sí aplica (columnas aditivas, seguro re-ejecutar).
-- ============================================================================

ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS accounting_account_id   uuid REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accounting_account_code text,
  ADD COLUMN IF NOT EXISTS linked_client_id        uuid REFERENCES cobra_clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_client_name      text,
  ADD COLUMN IF NOT EXISTS linked_supplier_id      uuid REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bank_txn_acct   ON bank_transactions(accounting_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_txn_client ON bank_transactions(linked_client_id);

-- ── RPC extendido: acepta cuenta contable + cliente/tercero ────────────────
-- Se elimina la versión de 4 args para evitar ambigüedad de sobrecarga; la
-- web llama por nombre y los parámetros nuevos son opcionales (default null),
-- así que su llamada actual sigue funcionando igual.

DROP FUNCTION IF EXISTS bancocheck_classify(uuid, text, text, text);

CREATE OR REPLACE FUNCTION bancocheck_classify(
  p_transaction_id         uuid,
  p_status                 text,
  p_category               text default null,
  p_notes                  text default null,
  p_accounting_account_id  uuid default null,
  p_accounting_account_code text default null,
  p_client_id              uuid default null,
  p_client_name            text default null,
  p_supplier_id            uuid default null
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
    status                  = p_status,
    category                = coalesce(p_category, category),
    notes                   = coalesce(p_notes, notes),
    accounting_account_id   = coalesce(p_accounting_account_id, accounting_account_id),
    accounting_account_code = coalesce(p_accounting_account_code, accounting_account_code),
    linked_client_id        = coalesce(p_client_id, linked_client_id),
    linked_client_name      = coalesce(p_client_name, linked_client_name),
    linked_supplier_id      = coalesce(p_supplier_id, linked_supplier_id),
    updated_at              = now()
  where id = p_transaction_id
  returning * into v_txn;

  insert into bank_audit_log (company_id, user_id, bank_transaction_id, action, old_value, new_value)
  values (v_company, auth.uid(), p_transaction_id, 'classify', v_old, to_jsonb(v_txn));

  return v_txn;
end;
$$;

grant execute on function bancocheck_classify(uuid, text, text, text, uuid, text, uuid, text, uuid) to authenticated;

NOTIFY pgrst, 'reload schema';
