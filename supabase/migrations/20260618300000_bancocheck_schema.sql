-- ─────────────────────────────────────────────────────────────────────────────
-- BancoCheck — cuentas y movimientos bancarios
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists bank_accounts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  name          text not null,                        -- "BBVA Empresarial"
  bank_name     text,                                 -- "BBVA" | "HSBC" | etc.
  last4         text,                                 -- últimos 4 dígitos
  currency      text not null default 'MXN',
  current_balance numeric(15,2) default 0,
  is_active     boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists bank_transactions (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  transaction_date date not null,
  description     text not null,
  reference       text,
  amount          numeric(15,2) not null,  -- positivo = depósito, negativo = cargo
  balance_after   numeric(15,2),
  -- clasificación
  status          text not null default 'new',
  -- new | matched | explained | personal | ignored | pending_document | pending_invoice | unidentified
  category        text,
  -- expense | collection | advance | supplier | client | personal | transfer | ignore
  notes           text,
  -- relaciones opcionales
  related_receipt_id  uuid references receipts(id) on delete set null,
  related_invoice_id  uuid,                           -- CobraCheck invoice
  related_advance_id  uuid references advances(id) on delete set null,
  -- origen
  imported_from   text not null default 'csv',        -- csv | manual
  import_batch_id uuid,                               -- agrupa una importación
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists bank_match_suggestions (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  transaction_id  uuid not null references bank_transactions(id) on delete cascade,
  match_type      text not null,     -- receipt | invoice | advance | client | supplier
  match_id        uuid not null,
  confidence      numeric(4,3) not null default 0,    -- 0.000 – 1.000
  status          text not null default 'pending',    -- pending | accepted | rejected
  created_at      timestamptz not null default now()
);

-- ── Índices ───────────────────────────────────────────────────────────────────

create index if not exists idx_bank_accounts_company on bank_accounts(company_id);
create index if not exists idx_bank_transactions_company on bank_transactions(company_id);
create index if not exists idx_bank_transactions_account on bank_transactions(bank_account_id);
create index if not exists idx_bank_transactions_date on bank_transactions(transaction_date desc);
create index if not exists idx_bank_transactions_status on bank_transactions(company_id, status);
create index if not exists idx_bank_match_company on bank_match_suggestions(company_id);
create index if not exists idx_bank_match_txn on bank_match_suggestions(transaction_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table bank_accounts          enable row level security;
alter table bank_transactions      enable row level security;
alter table bank_match_suggestions enable row level security;

-- bank_accounts
create policy "member_see_bank_accounts" on bank_accounts
  for select using (
    exists (
      select 1 from company_members m
      where m.company_id = bank_accounts.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
    )
  );

create policy "member_manage_bank_accounts" on bank_accounts
  for all using (
    exists (
      select 1 from company_members m
      where m.company_id = bank_accounts.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
        and m.role in ('owner','admin','supervisor','operator')
    )
  );

-- bank_transactions
create policy "member_see_bank_transactions" on bank_transactions
  for select using (
    exists (
      select 1 from company_members m
      where m.company_id = bank_transactions.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
    )
  );

create policy "member_manage_bank_transactions" on bank_transactions
  for all using (
    exists (
      select 1 from company_members m
      where m.company_id = bank_transactions.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
        and m.role in ('owner','admin','supervisor','operator','accountant')
    )
  );

-- bank_match_suggestions
create policy "member_see_match_suggestions" on bank_match_suggestions
  for select using (
    exists (
      select 1 from company_members m
      where m.company_id = bank_match_suggestions.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
    )
  );

create policy "member_manage_match_suggestions" on bank_match_suggestions
  for all using (
    exists (
      select 1 from company_members m
      where m.company_id = bank_match_suggestions.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
        and m.role in ('owner','admin','supervisor','operator','accountant')
    )
  );

-- ── Trigger updated_at ────────────────────────────────────────────────────────

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_bank_accounts_updated_at
  before update on bank_accounts
  for each row execute function update_updated_at();

create trigger trg_bank_transactions_updated_at
  before update on bank_transactions
  for each row execute function update_updated_at();
