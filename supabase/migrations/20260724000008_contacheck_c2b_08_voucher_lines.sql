-- ContaCheck C2B · Bloque 8 — accounting_voucher_lines (líneas formales) + balance diferible + inmutabilidad

create table if not exists public.accounting_voucher_lines (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete restrict,
  voucher_id      uuid not null references public.accounting_vouchers(id) on delete restrict,
  line_number     integer not null,
  account_id      uuid not null references public.accounting_accounts(id),
  account_code    varchar(40) not null,
  debit           numeric(15,2) not null default 0,
  credit          numeric(15,2) not null default 0,
  currency_amount numeric(15,2),
  exchange_rate   numeric(18,6),
  description     text,
  party_id        uuid references public.parties(id),
  cost_center_id  uuid,   -- dimensión caliente (referencia cost_centers)
  tax_code        varchar(20),
  tax_amount      numeric(15,2),
  source_detail_id uuid,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  unique (voucher_id, line_number),
  constraint acc_line_debit_xor_credit check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0)),
  constraint acc_line_nonneg check (debit >= 0 and credit >= 0)
);
create index if not exists idx_voucher_lines_voucher on public.accounting_voucher_lines(voucher_id);
create index if not exists idx_voucher_lines_account on public.accounting_voucher_lines(company_id, account_id);

-- Cuenta debe ser de la misma empresa y afectable (is_postable).
create or replace function public.accounting_line_account_guard()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare a record; v record;
begin
  select company_id, is_postable, active, code into a from public.accounting_accounts where id = new.account_id;
  if a.company_id is null then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if a.company_id <> new.company_id then raise exception 'ACCOUNT_COMPANY_MISMATCH'; end if;
  if a.is_postable is false then raise exception 'ACCOUNT_NOT_POSTABLE'; end if;
  if a.active is false then raise exception 'ACCOUNT_INACTIVE'; end if;
  -- inmutabilidad: no modificar/borrar líneas de una póliza posted
  select status into v from public.accounting_vouchers where id = new.voucher_id;
  if tg_op in ('UPDATE') and v.status in ('posted','reversed') then raise exception 'POSTED_IMMUTABLE'; end if;
  return new;
end $$;
drop trigger if exists trg_line_account_guard on public.accounting_voucher_lines;
create trigger trg_line_account_guard before insert or update on public.accounting_voucher_lines
  for each row execute function public.accounting_line_account_guard();

create or replace function public.accounting_line_delete_guard()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare v record;
begin
  select status into v from public.accounting_vouchers where id = old.voucher_id;
  if v.status in ('posted','reversed') then raise exception 'POSTED_IMMUTABLE'; end if;
  return old;
end $$;
drop trigger if exists trg_line_delete_guard on public.accounting_voucher_lines;
create trigger trg_line_delete_guard before delete on public.accounting_voucher_lines
  for each row execute function public.accounting_line_delete_guard();

-- Balance diferible (defensa adicional): al COMMIT, una póliza posted debe cuadrar Σdebe=Σhaber.
create or replace function public.accounting_lines_balance_check()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare v_voucher uuid; sd numeric; sc numeric; st text;
begin
  v_voucher := coalesce(new.voucher_id, old.voucher_id);
  select status into st from public.accounting_vouchers where id = v_voucher;
  if st = 'posted' then
    select coalesce(sum(debit),0), coalesce(sum(credit),0) into sd, sc
      from public.accounting_voucher_lines where voucher_id = v_voucher;
    if sd <> sc then raise exception 'UNBALANCED voucher=% debit=% credit=%', v_voucher, sd, sc; end if;
    if sd = 0 then raise exception 'EMPTY_POSTED_VOUCHER %', v_voucher; end if;
  end if;
  return null;
end $$;
drop trigger if exists trg_lines_balance on public.accounting_voucher_lines;
create constraint trigger trg_lines_balance
  after insert or update or delete on public.accounting_voucher_lines
  deferrable initially deferred
  for each row execute function public.accounting_lines_balance_check();

alter table public.accounting_voucher_lines enable row level security;
