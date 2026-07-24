-- ContaCheck C2B · Bloque 9 — accounting_source_links (orígenes normalizados). No retira source_ids.

create table if not exists public.accounting_source_links (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies(id) on delete restrict,
  voucher_id            uuid not null references public.accounting_vouchers(id) on delete restrict,
  source_module         varchar(50) not null,
  source_entity         varchar(64) not null,
  source_id             uuid not null,
  source_version        integer not null default 1,
  event_type            varchar(48) not null,
  relationship_type     varchar(24) not null
    check (relationship_type in ('origin','payment','collection','settlement','adjustment','reversal','bank_match','supporting_document')),
  source_status_snapshot varchar(40),
  created_at            timestamptz not null default now()
);
create index if not exists idx_source_links_origin
  on public.accounting_source_links(company_id, source_module, source_entity, source_id, source_version);
create index if not exists idx_source_links_voucher on public.accounting_source_links(company_id, voucher_id);
-- Un origen no puede tener DOS pólizas de tipo 'origin' para la misma versión (evita doble contabilización originante).
create unique index if not exists uq_source_links_origin
  on public.accounting_source_links(company_id, source_module, source_entity, source_id, source_version)
  where relationship_type = 'origin';

alter table public.accounting_source_links enable row level security;
