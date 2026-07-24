-- ContaCheck C2B · Bloque 10 — Idempotencia multiempresa (registro de solicitudes + unicidad por empresa)

create table if not exists public.accounting_idempotency_requests (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete restrict,
  idempotency_key  text not null,
  payload_hash     text not null,
  status           text not null default 'pending' check (status in ('pending','completed','failed')),
  voucher_id       uuid references public.accounting_vouchers(id),
  response_summary jsonb,
  error            text,
  request_id       text,
  created_at       timestamptz not null default now(),
  unique (company_id, idempotency_key)
);
create index if not exists idx_idem_company_key on public.accounting_idempotency_requests(company_id, idempotency_key);

-- Unicidad de la llave a nivel encabezado (por empresa, no global).
create unique index if not exists uq_vouchers_idempotency
  on public.accounting_vouchers(company_id, idempotency_key) where idempotency_key is not null;

-- Hash canónico del payload (orden estable de claves; números normalizados por el llamador).
create or replace function public.accounting_payload_hash(p_payload jsonb)
returns text language sql immutable set search_path = pg_catalog, public as $$
  select encode(sha256(convert_to(coalesce(p_payload::text,''), 'UTF8')), 'hex');
$$;
grant execute on function public.accounting_payload_hash(jsonb) to authenticated, service_role;

alter table public.accounting_idempotency_requests enable row level security;
