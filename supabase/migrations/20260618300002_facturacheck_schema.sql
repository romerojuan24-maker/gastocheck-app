-- ─────────────────────────────────────────────────────────────────────────────
-- FacturaCheck — CFDI recibidos/emitidos + emisión vía PAC externo
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists cfdi_documents (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references companies(id) on delete cascade,
  direction               text not null,   -- received | issued
  uuid_cfdi               text not null,
  rfc_emisor              text not null,
  razon_social_emisor     text,
  rfc_receptor            text not null,
  razon_social_receptor   text,
  fecha_emision           timestamptz,
  subtotal                numeric(15,2),
  iva                     numeric(15,2),
  ieps                    numeric(15,2),
  retenciones             numeric(15,2),
  total                   numeric(15,2),
  metodo_pago             text,
  forma_pago              text,
  uso_cfdi                text,
  tipo_comprobante        text,            -- I=ingreso E=egreso P=pago T=traslado
  status                  text not null default 'vigente',
  -- vigente | cancelado | not_found | duplicate | unmatched | matched | pending_complement
  xml_storage_path        text,
  pdf_storage_path        text,
  related_receipt_id      uuid references receipts(id) on delete set null,
  related_cobra_invoice_id uuid,
  related_bank_txn_id     uuid references bank_transactions(id) on delete set null,
  sat_validated_at        timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (company_id, uuid_cfdi)
);

create table if not exists cfdi_issue_requests (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references companies(id) on delete cascade,
  cfdi_type               text not null,   -- ingreso | egreso | pago | traslado
  -- datos receptor
  receptor_rfc            text not null,
  receptor_razon_social   text,
  receptor_uso_cfdi       text not null default 'G03',
  receptor_codigo_postal  text,
  receptor_regimen        text,
  -- conceptos
  items                   jsonb not null default '[]',
  subtotal                numeric(15,2),
  iva                     numeric(15,2),
  total                   numeric(15,2),
  -- estado
  status                  text not null default 'draft',
  -- draft | pending | timbrado | cancelled | error
  uuid_cfdi               text,
  provider                text not null default 'facturama',
  provider_id             text,
  xml_storage_path        text,
  pdf_storage_path        text,
  error_message           text,
  requested_by            uuid references profiles(id) on delete set null,
  timbrado_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table if not exists cfdi_provider_configs (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references companies(id) on delete cascade,
  provider              text not null default 'facturama',  -- facturama | facturapia | finkok
  rfc                   text not null,
  razon_social          text,
  regimen_fiscal        text,
  codigo_postal_fiscal  text,
  -- credenciales (cifradas en Edge Function, almacenadas como opaque strings)
  csd_cert_enc          text,
  csd_key_enc           text,
  csd_pass_enc          text,
  pac_user_enc          text,
  pac_pass_enc          text,
  mode                  text not null default 'sandbox',    -- sandbox | production
  is_active             boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (company_id, provider)
);

-- ── Índices ───────────────────────────────────────────────────────────────────

create index if not exists idx_cfdi_company on cfdi_documents(company_id);
create index if not exists idx_cfdi_uuid on cfdi_documents(uuid_cfdi);
create index if not exists idx_cfdi_status on cfdi_documents(company_id, status);
create index if not exists idx_cfdi_direction on cfdi_documents(company_id, direction);
create index if not exists idx_cfdi_issue_company on cfdi_issue_requests(company_id);
create index if not exists idx_cfdi_provider_company on cfdi_provider_configs(company_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table cfdi_documents       enable row level security;
alter table cfdi_issue_requests  enable row level security;
alter table cfdi_provider_configs enable row level security;

create policy "member_see_cfdi" on cfdi_documents
  for select using (
    exists (
      select 1 from company_members m
      where m.company_id = cfdi_documents.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
    )
  );

create policy "member_manage_cfdi" on cfdi_documents
  for all using (
    exists (
      select 1 from company_members m
      where m.company_id = cfdi_documents.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
        and m.role in ('owner','admin','supervisor','accountant','operator')
    )
  );

create policy "member_see_cfdi_requests" on cfdi_issue_requests
  for select using (
    exists (
      select 1 from company_members m
      where m.company_id = cfdi_issue_requests.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
        and m.role in ('owner','admin','supervisor','accountant')
    )
  );

create policy "member_manage_cfdi_requests" on cfdi_issue_requests
  for all using (
    exists (
      select 1 from company_members m
      where m.company_id = cfdi_issue_requests.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
        and m.role in ('owner','admin','supervisor','accountant')
    )
  );

-- cfdi_provider_configs: solo owner/admin
create policy "admin_see_provider_config" on cfdi_provider_configs
  for select using (
    exists (
      select 1 from company_members m
      where m.company_id = cfdi_provider_configs.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
        and m.role in ('owner','admin')
    )
  );

create policy "admin_manage_provider_config" on cfdi_provider_configs
  for all using (
    exists (
      select 1 from company_members m
      where m.company_id = cfdi_provider_configs.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
        and m.role in ('owner','admin')
    )
  );

-- ── Triggers ──────────────────────────────────────────────────────────────────

create trigger trg_cfdi_documents_updated_at
  before update on cfdi_documents
  for each row execute function update_updated_at();

create trigger trg_cfdi_requests_updated_at
  before update on cfdi_issue_requests
  for each row execute function update_updated_at();

create trigger trg_cfdi_provider_configs_updated_at
  before update on cfdi_provider_configs
  for each row execute function update_updated_at();
