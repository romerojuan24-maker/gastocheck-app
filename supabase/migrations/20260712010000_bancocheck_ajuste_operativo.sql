-- BancoCheck — ajuste a "control operativo" (NO banco digital, NO wallet,
-- NUNCA mueve dinero ni credenciales bancarias). Extiende el esquema real
-- ya en producción (bank_accounts/bank_transactions/bank_import_logs/
-- bank_match_suggestions) en vez de reemplazarlo — hay datos reales.
--
-- Objetivo: responder "¿qué movimientos del banco están explicados y
-- cuáles no?" con idempotencia, deduplicación, auditoría y ACID.

-- ── bank_accounts: falta "type" del spec (mapea a account_type) ───────────
alter table bank_accounts
  add column if not exists account_type text not null default 'checking';
comment on column bank_accounts.account_type is 'checking | savings | credit_card | other — NUNCA se usa para mover dinero, solo clasificación.';

-- ── bank_transactions: dedup, moneda, confianza, auditoría de fuente ──────
alter table bank_transactions
  add column if not exists currency          text not null default 'MXN',
  add column if not exists unique_hash        text,
  add column if not exists confidence         numeric(4,3),
  add column if not exists is_personal        boolean not null default false,
  add column if not exists raw_data           jsonb,
  add column if not exists matched_entity_type text;
  -- matched_entity_type es solo etiqueta para UI; el vínculo real sigue
  -- siendo related_receipt_id/related_invoice_id/related_advance_id
  -- (FKs reales, mejor integridad referencial que un id genérico).

-- Regla de negocio #2/#3: uniqueHash = tenant + cuenta + fecha + descripción
-- normalizada + cargo + abono + referencia. Único por empresa+cuenta =
-- deduplicación real a nivel de base de datos, no solo aplicación.
create unique index if not exists idx_bank_transactions_unique_hash
  on bank_transactions(company_id, bank_account_id, unique_hash)
  where unique_hash is not null;

comment on column bank_transactions.is_personal is 'Excluido de reportes de negocio, pero sigue visible para owner (regla #7).';

-- ── bank_import_logs: idempotencia por archivo (regla #3) ────────────────
alter table bank_import_logs
  add column if not exists file_hash text,
  add column if not exists status    text not null default 'completed';
  -- pending | completed | failed

create unique index if not exists idx_bank_import_logs_file_hash
  on bank_import_logs(company_id, bank_account_id, file_hash)
  where file_hash is not null;
comment on column bank_import_logs.file_hash is 'SHA-256 del archivo — si se reimporta el mismo archivo, el índice único bloquea el duplicado.';

-- ── bank_match_suggestions: razón legible (regla de UX) ───────────────────
alter table bank_match_suggestions
  add column if not exists reason text;

-- ── bank_audit_log (nueva): regla #4 — toda clasificación/relación queda
-- registrada. Quién, qué cambió, cuándo.
create table if not exists bank_audit_log (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  bank_transaction_id uuid not null references bank_transactions(id) on delete cascade,
  action              text not null,  -- classify | match | mark_personal | ignore | import
  old_value           jsonb,
  new_value           jsonb,
  created_at          timestamptz not null default now()
);
create index if not exists idx_bank_audit_log_company on bank_audit_log(company_id);
create index if not exists idx_bank_audit_log_txn on bank_audit_log(bank_transaction_id);

alter table bank_audit_log enable row level security;
drop policy if exists "bank_audit_log_read" on bank_audit_log;
create policy "bank_audit_log_read" on bank_audit_log for select using (
  company_id in (select company_id from company_members where user_id = auth.uid() and status = 'active')
);
drop policy if exists "bank_audit_log_insert" on bank_audit_log;
create policy "bank_audit_log_insert" on bank_audit_log for insert with check (
  company_id in (select company_id from company_members where user_id = auth.uid() and status = 'active')
  and user_id = auth.uid()
);

-- ── RLS: regla #10 — nunca ver movimientos de otra empresa. Ya existe
-- RLS en bank_transactions desde 20260629005000; esto solo lo confirma
-- por si el helper cambió de nombre en algún punto.
alter table bank_transactions enable row level security;
alter table bank_accounts enable row level security;
alter table bank_import_logs enable row level security;
alter table bank_match_suggestions enable row level security;
