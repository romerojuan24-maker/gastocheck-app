-- ─────────────────────────────────────────────────────────────────────────────
-- FacturaCheck — recibos / comprobantes de pago NO fiscales
-- Documentos internos que NO se timbran ante el SAT (recibos de pago, notas de
-- venta simples, comprobantes administrativos). Separados de cfdi_* a propósito.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists payment_receipts (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  folio          text not null,                         -- folio interno consecutivo
  receipt_type   text not null default 'recibo',        -- recibo | nota_venta | comprobante_pago
  -- receptor (cliente) — opcionalmente ligado al directorio de clientes
  client_id      uuid references cobra_clients(id) on delete set null,
  client_name    text not null,
  client_rfc     text,
  -- detalle
  concept        text not null,
  amount         numeric(15,2) not null,
  payment_method text,                                  -- efectivo | transferencia | cheque | tarjeta | otro
  receipt_date   date not null default current_date,
  notes          text,
  status         text not null default 'issued',        -- issued | cancelled
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (company_id, folio)
);

create index if not exists idx_payment_receipts_company on payment_receipts(company_id);
create index if not exists idx_payment_receipts_client  on payment_receipts(client_id);
create index if not exists idx_payment_receipts_date    on payment_receipts(company_id, receipt_date desc);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table payment_receipts enable row level security;

create policy "member_see_payment_receipts" on payment_receipts
  for select using (
    exists (
      select 1 from company_members m
      where m.company_id = payment_receipts.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
    )
  );

create policy "member_manage_payment_receipts" on payment_receipts
  for all using (
    exists (
      select 1 from company_members m
      where m.company_id = payment_receipts.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
        and m.role in ('owner','admin','supervisor','accountant')
    )
  );

grant select, insert, update, delete on payment_receipts to authenticated;

-- ── Trigger updated_at ────────────────────────────────────────────────────────

create trigger trg_payment_receipts_updated_at
  before update on payment_receipts
  for each row execute function update_updated_at();
