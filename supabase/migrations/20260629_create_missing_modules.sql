-- ═══════════════════════════════════════════════════════════════════════════
-- MÓDULOS FALTANTES — BancoCheck + FlujoCheck + InventarioCheck + FacturaCheck
-- Migración consolidada e idempotente (usa IF NOT EXISTS + DO/EXCEPTION).
-- Aplicar en Supabase SQL Editor después de payment_receipts.
-- ═══════════════════════════════════════════════════════════════════════════

-- Función update_updated_at (idempotente)
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. BancoCheck
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists bank_accounts (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  name            text not null,
  bank_name       text,
  last4           text,
  currency        text not null default 'MXN',
  current_balance numeric(15,2) default 0,
  is_active       boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists bank_transactions (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  bank_account_id     uuid not null references bank_accounts(id) on delete cascade,
  transaction_date    date not null,
  description         text not null,
  reference           text,
  amount              numeric(15,2) not null,
  balance_after       numeric(15,2),
  status              text not null default 'new',
  category            text,
  notes               text,
  related_receipt_id  uuid references receipts(id) on delete set null,
  related_invoice_id  uuid,
  related_advance_id  uuid references advances(id) on delete set null,
  imported_from       text not null default 'csv',
  import_batch_id     uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists bank_match_suggestions (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  transaction_id uuid not null references bank_transactions(id) on delete cascade,
  match_type     text not null,
  match_id       uuid not null,
  confidence     numeric(4,3) not null default 0,
  status         text not null default 'pending',
  created_at     timestamptz not null default now()
);

create index if not exists idx_bank_accounts_company       on bank_accounts(company_id);
create index if not exists idx_bank_transactions_company   on bank_transactions(company_id);
create index if not exists idx_bank_transactions_account   on bank_transactions(bank_account_id);
create index if not exists idx_bank_transactions_date      on bank_transactions(transaction_date desc);
create index if not exists idx_bank_transactions_status    on bank_transactions(company_id, status);
create index if not exists idx_bank_match_company          on bank_match_suggestions(company_id);
create index if not exists idx_bank_match_txn              on bank_match_suggestions(transaction_id);

alter table bank_accounts          enable row level security;
alter table bank_transactions      enable row level security;
alter table bank_match_suggestions enable row level security;

do $$ begin
  create policy "member_see_bank_accounts" on bank_accounts for select using (
    exists (select 1 from company_members m where m.company_id = bank_accounts.company_id and m.user_id = auth.uid() and m.status = 'active')
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "member_manage_bank_accounts" on bank_accounts for all using (
    exists (select 1 from company_members m where m.company_id = bank_accounts.company_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin','supervisor','accountant'))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "member_see_bank_transactions" on bank_transactions for select using (
    exists (select 1 from company_members m where m.company_id = bank_transactions.company_id and m.user_id = auth.uid() and m.status = 'active')
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "member_manage_bank_transactions" on bank_transactions for all using (
    exists (select 1 from company_members m where m.company_id = bank_transactions.company_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin','supervisor','accountant'))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "member_see_match_suggestions" on bank_match_suggestions for select using (
    exists (select 1 from company_members m where m.company_id = bank_match_suggestions.company_id and m.user_id = auth.uid() and m.status = 'active')
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "member_manage_match_suggestions" on bank_match_suggestions for all using (
    exists (select 1 from company_members m where m.company_id = bank_match_suggestions.company_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin','supervisor','accountant'))
  );
exception when duplicate_object then null; end $$;

drop trigger if exists trg_bank_accounts_updated_at    on bank_accounts;
drop trigger if exists trg_bank_transactions_updated_at on bank_transactions;
create trigger trg_bank_accounts_updated_at     before update on bank_accounts     for each row execute function update_updated_at();
create trigger trg_bank_transactions_updated_at before update on bank_transactions for each row execute function update_updated_at();

grant select, insert, update, delete on bank_accounts          to authenticated;
grant select, insert, update, delete on bank_transactions      to authenticated;
grant select, insert, update, delete on bank_match_suggestions to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FlujoCheck
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists cash_flow_items (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  item_type     text not null,
  description   text not null,
  expected_date date not null,
  amount        numeric(15,2) not null,
  direction     text not null default 'out',
  status        text not null default 'pending',
  source        text not null default 'manual',
  source_id     uuid,
  is_scenario   boolean not null default false,
  scenario_id   uuid,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists cash_flow_scenarios (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references companies(id) on delete cascade,
  name               text not null,
  description        text,
  base_snapshot      jsonb,
  adjustments        jsonb,
  projected_balance  numeric(15,2),
  risk_level         text not null default 'green',
  created_by         uuid references profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_cash_flow_items_company    on cash_flow_items(company_id);
create index if not exists idx_cash_flow_items_date       on cash_flow_items(company_id, expected_date);
create index if not exists idx_cash_flow_items_status     on cash_flow_items(company_id, status);
create index if not exists idx_cash_flow_scenarios_company on cash_flow_scenarios(company_id);

alter table cash_flow_items     enable row level security;
alter table cash_flow_scenarios enable row level security;

do $$ begin
  create policy "member_see_cash_flow_items" on cash_flow_items for select using (
    exists (select 1 from company_members m where m.company_id = cash_flow_items.company_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin','supervisor','accountant'))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "member_manage_cash_flow_items" on cash_flow_items for all using (
    exists (select 1 from company_members m where m.company_id = cash_flow_items.company_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin','supervisor','accountant'))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "member_see_scenarios" on cash_flow_scenarios for select using (
    exists (select 1 from company_members m where m.company_id = cash_flow_scenarios.company_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin','supervisor','accountant'))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "member_manage_scenarios" on cash_flow_scenarios for all using (
    exists (select 1 from company_members m where m.company_id = cash_flow_scenarios.company_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin','supervisor','accountant'))
  );
exception when duplicate_object then null; end $$;

drop trigger if exists trg_cash_flow_items_updated_at     on cash_flow_items;
drop trigger if exists trg_cash_flow_scenarios_updated_at on cash_flow_scenarios;
create trigger trg_cash_flow_items_updated_at     before update on cash_flow_items     for each row execute function update_updated_at();
create trigger trg_cash_flow_scenarios_updated_at before update on cash_flow_scenarios for each row execute function update_updated_at();

grant select, insert, update, delete on cash_flow_items     to authenticated;
grant select, insert, update, delete on cash_flow_scenarios to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. InventarioCheck
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists inventory_products (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  name          text not null,
  sku           text,
  barcode       text,
  category      text,
  unit          text not null default 'pza',
  cost          numeric(15,2) not null default 0,
  price         numeric(15,2) not null default 0,
  stock_current numeric(10,3) not null default 0,
  stock_minimum numeric(10,3) not null default 0,
  photo_url     text,
  is_active     boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, sku)
);

create table if not exists inventory_movements (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  product_id    uuid not null references inventory_products(id) on delete cascade,
  movement_type text not null,
  quantity      numeric(10,3) not null,
  stock_before  numeric(10,3) not null,
  stock_after   numeric(10,3) not null,
  unit_cost     numeric(15,2),
  notes         text,
  source        text not null default 'manual',
  source_id     uuid,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table if not exists inventory_alerts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  product_id  uuid not null references inventory_products(id) on delete cascade,
  alert_type  text not null,
  message     text not null,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_inv_products_company  on inventory_products(company_id);
create index if not exists idx_inv_products_sku      on inventory_products(company_id, sku);
create index if not exists idx_inv_products_barcode  on inventory_products(company_id, barcode);
create index if not exists idx_inv_movements_company on inventory_movements(company_id);
create index if not exists idx_inv_movements_product on inventory_movements(product_id);
create index if not exists idx_inv_alerts_company    on inventory_alerts(company_id, is_read);

alter table inventory_products  enable row level security;
alter table inventory_movements enable row level security;
alter table inventory_alerts    enable row level security;

do $$ begin
  create policy "member_see_inventory" on inventory_products for select using (
    exists (select 1 from company_members m where m.company_id = inventory_products.company_id and m.user_id = auth.uid() and m.status = 'active')
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "member_manage_inventory" on inventory_products for all using (
    exists (select 1 from company_members m where m.company_id = inventory_products.company_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin','supervisor','accountant'))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "member_see_inv_movements" on inventory_movements for select using (
    exists (select 1 from company_members m where m.company_id = inventory_movements.company_id and m.user_id = auth.uid() and m.status = 'active')
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "member_manage_inv_movements" on inventory_movements for all using (
    exists (select 1 from company_members m where m.company_id = inventory_movements.company_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin','supervisor','accountant'))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "member_see_inv_alerts" on inventory_alerts for select using (
    exists (select 1 from company_members m where m.company_id = inventory_alerts.company_id and m.user_id = auth.uid() and m.status = 'active')
  );
exception when duplicate_object then null; end $$;

drop trigger if exists trg_inv_products_updated_at   on inventory_products;
drop trigger if exists trg_inv_product_stock_alert   on inventory_products;
create trigger trg_inv_products_updated_at before update on inventory_products for each row execute function update_updated_at();

create or replace function check_inventory_alert()
returns trigger language plpgsql as $$
begin
  if new.stock_current <= new.stock_minimum then
    insert into inventory_alerts (company_id, product_id, alert_type, message)
    values (
      new.company_id, new.id,
      case when new.stock_current = 0 then 'out_of_stock' else 'low_stock' end,
      case when new.stock_current = 0
        then new.name || ' está agotado'
        else new.name || ' está bajo (stock: ' || new.stock_current::text || ' ' || new.unit || ')'
      end
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger trg_inv_product_stock_alert after update of stock_current on inventory_products for each row execute function check_inventory_alert();

grant select, insert, update, delete on inventory_products  to authenticated;
grant select, insert, update, delete on inventory_movements to authenticated;
grant select, insert, update, delete on inventory_alerts    to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. FacturaCheck (CFDI)
-- Nota: cfdi_documents referencia bank_transactions, que ya existe arriba.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists cfdi_documents (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null references companies(id) on delete cascade,
  direction                text not null,
  uuid_cfdi                text not null,
  rfc_emisor               text not null,
  razon_social_emisor      text,
  rfc_receptor             text not null,
  razon_social_receptor    text,
  fecha_emision            timestamptz,
  subtotal                 numeric(15,2),
  iva                      numeric(15,2),
  ieps                     numeric(15,2),
  retenciones              numeric(15,2),
  total                    numeric(15,2),
  metodo_pago              text,
  forma_pago               text,
  uso_cfdi                 text,
  tipo_comprobante         text,
  status                   text not null default 'vigente',
  xml_storage_path         text,
  pdf_storage_path         text,
  related_receipt_id       uuid references receipts(id) on delete set null,
  related_cobra_invoice_id uuid,
  related_bank_txn_id      uuid references bank_transactions(id) on delete set null,
  sat_validated_at         timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (company_id, uuid_cfdi)
);

create table if not exists cfdi_issue_requests (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references companies(id) on delete cascade,
  cfdi_type              text not null,
  receptor_rfc           text not null,
  receptor_razon_social  text,
  receptor_uso_cfdi      text not null default 'G03',
  receptor_codigo_postal text,
  receptor_regimen       text,
  items                  jsonb not null default '[]',
  subtotal               numeric(15,2),
  iva                    numeric(15,2),
  total                  numeric(15,2),
  status                 text not null default 'draft',
  uuid_cfdi              text,
  provider               text not null default 'facturama',
  provider_id            text,
  xml_storage_path       text,
  pdf_storage_path       text,
  error_message          text,
  requested_by           uuid references profiles(id) on delete set null,
  timbrado_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists cfdi_provider_configs (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references companies(id) on delete cascade,
  provider              text not null default 'facturama',
  rfc                   text not null,
  razon_social          text,
  regimen_fiscal        text,
  codigo_postal_fiscal  text,
  csd_cert_enc          text,
  csd_key_enc           text,
  csd_pass_enc          text,
  pac_user_enc          text,
  pac_pass_enc          text,
  mode                  text not null default 'sandbox',
  is_active             boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (company_id, provider)
);

create index if not exists idx_cfdi_company          on cfdi_documents(company_id);
create index if not exists idx_cfdi_uuid             on cfdi_documents(uuid_cfdi);
create index if not exists idx_cfdi_status           on cfdi_documents(company_id, status);
create index if not exists idx_cfdi_direction        on cfdi_documents(company_id, direction);
create index if not exists idx_cfdi_issue_company    on cfdi_issue_requests(company_id);
create index if not exists idx_cfdi_provider_company on cfdi_provider_configs(company_id);

alter table cfdi_documents        enable row level security;
alter table cfdi_issue_requests   enable row level security;
alter table cfdi_provider_configs enable row level security;

do $$ begin
  create policy "member_see_cfdi" on cfdi_documents for select using (
    exists (select 1 from company_members m where m.company_id = cfdi_documents.company_id and m.user_id = auth.uid() and m.status = 'active')
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "member_manage_cfdi" on cfdi_documents for all using (
    exists (select 1 from company_members m where m.company_id = cfdi_documents.company_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin','supervisor','accountant'))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "member_see_cfdi_requests" on cfdi_issue_requests for select using (
    exists (select 1 from company_members m where m.company_id = cfdi_issue_requests.company_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin','supervisor','accountant'))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "member_manage_cfdi_requests" on cfdi_issue_requests for all using (
    exists (select 1 from company_members m where m.company_id = cfdi_issue_requests.company_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin','supervisor','accountant'))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admin_see_provider_config" on cfdi_provider_configs for select using (
    exists (select 1 from company_members m where m.company_id = cfdi_provider_configs.company_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin'))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admin_manage_provider_config" on cfdi_provider_configs for all using (
    exists (select 1 from company_members m where m.company_id = cfdi_provider_configs.company_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin'))
  );
exception when duplicate_object then null; end $$;

drop trigger if exists trg_cfdi_documents_updated_at       on cfdi_documents;
drop trigger if exists trg_cfdi_requests_updated_at        on cfdi_issue_requests;
drop trigger if exists trg_cfdi_provider_configs_updated_at on cfdi_provider_configs;
create trigger trg_cfdi_documents_updated_at        before update on cfdi_documents        for each row execute function update_updated_at();
create trigger trg_cfdi_requests_updated_at         before update on cfdi_issue_requests   for each row execute function update_updated_at();
create trigger trg_cfdi_provider_configs_updated_at before update on cfdi_provider_configs for each row execute function update_updated_at();

grant select, insert, update, delete on cfdi_documents        to authenticated;
grant select, insert, update, delete on cfdi_issue_requests   to authenticated;
grant select, insert, update, delete on cfdi_provider_configs to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Reload schema cache
-- ─────────────────────────────────────────────────────────────────────────────
notify pgrst, 'reload schema';
