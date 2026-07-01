-- ============================================================================
-- CUENTAS POR PAGAR (Accounts Payable) — control de pendientes del contador
-- Idempotente. RLS consistente con auth_is_member / auth_role.
-- ============================================================================

create table if not exists accounts_payable (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  supplier_name   text not null,
  supplier_rfc    text,
  concept         text not null,
  invoice_folio   text,
  cfdi_uuid       text,
  amount          numeric(15,2) not null check (amount > 0),
  currency        text not null default 'MXN',
  issue_date      date,
  due_date        date not null,
  status          text not null default 'pending'
                    check (status in ('pending','scheduled','partial','paid','cancelled')),
  paid_amount     numeric(15,2) not null default 0 check (paid_amount >= 0),
  payment_date    date,
  accounting_account_code text,
  notes           text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_ap_company  on accounts_payable(company_id);
create index if not exists idx_ap_status   on accounts_payable(status);
create index if not exists idx_ap_due_date on accounts_payable(due_date);

-- days_overdue derivado en consulta (no como columna generada, para flexibilidad)

-- trigger updated_at
create or replace function ap_touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_ap_touch on accounts_payable;
create trigger trg_ap_touch before update on accounts_payable
  for each row execute function ap_touch_updated_at();

-- RLS
alter table accounts_payable enable row level security;

-- lectura: cualquier miembro de la empresa
drop policy if exists ap_read on accounts_payable;
create policy ap_read on accounts_payable
  for select using (auth_is_member(company_id));

-- escritura (insert/update/delete): roles financieros (owner/admin/accountant/supervisor)
drop policy if exists ap_write on accounts_payable;
create policy ap_write on accounts_payable
  for all
  using (auth_role(company_id) in ('owner','accountant','supervisor'))
  with check (auth_role(company_id) in ('owner','accountant','supervisor'));

grant select, insert, update, delete on accounts_payable to authenticated;
