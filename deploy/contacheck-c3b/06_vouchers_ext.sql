-- ContaCheck C2B · Bloque 6 — Ampliación aditiva de accounting_vouchers + inmutabilidad de posted
-- Todas las columnas nuevas NULL-ables/default → compatibles con los 2 writers actuales.
-- currency existente (varchar) se conserva como moneda; no se duplica currency_code.

alter table public.accounting_vouchers
  add column if not exists schema_version         integer not null default 1,
  add column if not exists event_type             varchar(48),
  add column if not exists accounting_date         date,
  add column if not exists occurred_at             timestamptz,
  add column if not exists fiscal_year             integer,
  add column if not exists fiscal_period_id        uuid references public.accounting_periods(id),
  add column if not exists exchange_rate           numeric(18,6) not null default 1.0,
  add column if not exists description             text,
  add column if not exists reference               text,
  add column if not exists party_id                uuid references public.parties(id),
  add column if not exists tax_profile_snapshot    jsonb,
  add column if not exists rule_version_id         uuid,  -- FK añadida en bloque 12
  add column if not exists idempotency_key         text,  -- índice único en bloque 10
  add column if not exists reversal_of_voucher_id  uuid references public.accounting_vouchers(id),
  add column if not exists reversed_by_voucher_id  uuid references public.accounting_vouchers(id),
  add column if not exists approved_by             uuid,
  add column if not exists approved_at             timestamptz,
  add column if not exists posted_by               uuid,
  add column if not exists posted_at               timestamptz,
  add column if not exists rejected_by             uuid,
  add column if not exists rejected_at             timestamptz,
  add column if not exists rejection_reason        text,
  add column if not exists created_by              uuid,
  add column if not exists updated_at              timestamptz not null default now(),
  add column if not exists version                 integer not null default 1,
  add column if not exists metadata                jsonb not null default '{}'::jsonb;

-- Ampliar dominios (widen, no destructivo: valores previos siguen válidos).
alter table public.accounting_vouchers drop constraint if exists accounting_vouchers_status_check;
alter table public.accounting_vouchers add constraint accounting_vouchers_status_check
  check (status in ('draft','exported','reconciled','generated','validated','pending_configuration',
                    'pending_review','approved','posted','rejected','reversed'));

alter table public.accounting_vouchers drop constraint if exists accounting_vouchers_voucher_type_check;
alter table public.accounting_vouchers add constraint accounting_vouchers_voucher_type_check
  check (voucher_type in ('INCOME','EXPENSE','TRANSFER','ADJUSTMENT','OPENING','CLOSING'));

create index if not exists idx_vouchers_period on public.accounting_vouchers(fiscal_period_id);
create index if not exists idx_vouchers_party on public.accounting_vouchers(party_id);
create index if not exists idx_vouchers_source on public.accounting_vouchers(company_id, source_module);

-- Inmutabilidad: una póliza 'posted' solo permite cambiar campos de referencia/exportación.
create or replace function public.accounting_voucher_immutable_guard()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if old.status = 'posted' then
    if new.total_debit is distinct from old.total_debit
       or new.total_credit is distinct from old.total_credit
       or new.voucher_type is distinct from old.voucher_type
       or new.accounting_date is distinct from old.accounting_date
       or new.fiscal_period_id is distinct from old.fiscal_period_id
       or new.party_id is distinct from old.party_id
       or new.entries is distinct from old.entries
       or new.voucher_number is distinct from old.voucher_number
       or (new.status is distinct from old.status and new.status <> 'reversed')
    then
      raise exception 'POSTED_IMMUTABLE';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_voucher_immutable on public.accounting_vouchers;
create trigger trg_voucher_immutable before update on public.accounting_vouchers
  for each row execute function public.accounting_voucher_immutable_guard();
