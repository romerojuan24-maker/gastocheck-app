-- ContaCheck C2B · Bloque 11 — Dimensiones por línea (normalizada + columnas calientes en líneas)
-- Modelo híbrido aprobado: cost_center_id/party_id calientes en accounting_voucher_lines (bloque 8);
-- resto extensible aquí. No copia expense_tags: los referencia.

create table if not exists public.accounting_line_dimensions (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete restrict,
  line_id         uuid not null references public.accounting_voucher_lines(id) on delete restrict,
  dimension_type  varchar(40) not null
    check (dimension_type in ('cost_center','branch','department','project','business_unit','employee',
                              'client','supplier','product','warehouse','asset','rancho','lote_parcela',
                              'cultivo','temporada','custom_tag')),
  dimension_ref_id uuid,      -- referencia a la tabla operativa existente (cost_centers, inventory_*, parties, expense_tags…)
  dimension_value  text,      -- para etiquetas libres
  created_at       timestamptz not null default now(),
  unique (line_id, dimension_type)
);
create index if not exists idx_line_dims_type on public.accounting_line_dimensions(company_id, dimension_type, dimension_ref_id);
create index if not exists idx_line_dims_line on public.accounting_line_dimensions(line_id);

alter table public.accounting_line_dimensions enable row level security;
