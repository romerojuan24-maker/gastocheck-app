-- BancoCheck — conciliación cruzada con GastoCheck/CobraCheck/FacturaCheck.
-- Todo pasa por bank_match_suggestions + aprobación explícita del contador
-- (regla del usuario: "a menos que tengan todos los datos validados...
-- el contador debe SIEMPRE tener el VoBo" — nunca se auto-aprueba nada).

-- ── Transferencias entre cuentas propias ───────────────────────────────────
-- Un cargo en cuenta A + un depósito en cuenta B (misma empresa) son la
-- MISMA transferencia — se enlazan entre sí para no contarlos 2 veces como
-- ingreso/egreso real del negocio.
alter table bank_transactions
  add column if not exists linked_transaction_id uuid references bank_transactions(id) on delete set null;

comment on column bank_transactions.linked_transaction_id is
  'Para match_type=transfer: apunta al movimiento espejo en la otra cuenta propia.';

-- ── Fix RLS: los roles reales de contador en producción son
-- 'supervisor' y 'contador_general' (ver company_members) — la policy
-- original solo dejaba pasar 'accountant'/'superadmin', que nadie tiene
-- asignado. Corrige bank_reconciliations y accounting_vouchers.
drop policy if exists "reconciliation_write" on bank_reconciliations;
create policy "reconciliation_write" on bank_reconciliations for insert with check (
  company_id in (
    select company_id from company_members
    where user_id = auth.uid() and status = 'active'
      and role in ('owner', 'admin', 'supervisor', 'accountant', 'contador_general')
  )
);
drop policy if exists "reconciliation_update" on bank_reconciliations;
create policy "reconciliation_update" on bank_reconciliations for update using (
  company_id in (
    select company_id from company_members
    where user_id = auth.uid() and status = 'active'
      and role in ('owner', 'admin', 'supervisor', 'accountant', 'contador_general')
  )
);

drop policy if exists "vouchers_export" on accounting_vouchers;
create policy "vouchers_export" on accounting_vouchers for insert with check (
  company_id in (
    select company_id from company_members
    where user_id = auth.uid() and status = 'active'
      and role in ('owner', 'admin', 'supervisor', 'accountant', 'contador_general')
  )
);
