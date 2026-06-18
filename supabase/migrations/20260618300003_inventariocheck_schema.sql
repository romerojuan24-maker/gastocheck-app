-- ─────────────────────────────────────────────────────────────────────────────
-- InventarioCheck — productos, movimientos y alertas de stock
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists inventory_products (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  name          text not null,
  sku           text,
  barcode       text,
  category      text,
  unit          text not null default 'pza',  -- pza | kg | lt | caja | metro | etc.
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
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  product_id      uuid not null references inventory_products(id) on delete cascade,
  movement_type   text not null,
  -- in | out | adjust | loss | return | transfer
  quantity        numeric(10,3) not null,     -- siempre positivo; dirección en movement_type
  stock_before    numeric(10,3) not null,
  stock_after     numeric(10,3) not null,
  unit_cost       numeric(15,2),
  notes           text,
  source          text not null default 'manual',
  -- manual | sale | purchase | adjustment | gastocheck | facturacheck
  source_id       uuid,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create table if not exists inventory_alerts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  product_id    uuid not null references inventory_products(id) on delete cascade,
  alert_type    text not null,
  -- low_stock | out_of_stock | no_movement | restock_suggested
  message       text not null,
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ── Índices ───────────────────────────────────────────────────────────────────

create index if not exists idx_inv_products_company on inventory_products(company_id);
create index if not exists idx_inv_products_sku on inventory_products(company_id, sku);
create index if not exists idx_inv_products_barcode on inventory_products(company_id, barcode);
create index if not exists idx_inv_movements_company on inventory_movements(company_id);
create index if not exists idx_inv_movements_product on inventory_movements(product_id);
create index if not exists idx_inv_alerts_company on inventory_alerts(company_id, is_read);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table inventory_products  enable row level security;
alter table inventory_movements enable row level security;
alter table inventory_alerts    enable row level security;

create policy "member_see_inventory" on inventory_products
  for select using (
    exists (
      select 1 from company_members m
      where m.company_id = inventory_products.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
    )
  );

create policy "member_manage_inventory" on inventory_products
  for all using (
    exists (
      select 1 from company_members m
      where m.company_id = inventory_products.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
        and m.role in ('owner','admin','supervisor','operator','accountant')
    )
  );

create policy "member_see_inv_movements" on inventory_movements
  for select using (
    exists (
      select 1 from company_members m
      where m.company_id = inventory_movements.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
    )
  );

create policy "member_manage_inv_movements" on inventory_movements
  for all using (
    exists (
      select 1 from company_members m
      where m.company_id = inventory_movements.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
        and m.role in ('owner','admin','supervisor','operator','accountant')
    )
  );

create policy "member_see_inv_alerts" on inventory_alerts
  for select using (
    exists (
      select 1 from company_members m
      where m.company_id = inventory_alerts.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
    )
  );

-- ── Triggers ──────────────────────────────────────────────────────────────────

create trigger trg_inv_products_updated_at
  before update on inventory_products
  for each row execute function update_updated_at();

-- ── Función automática: generar alerta de stock bajo ──────────────────────────

create or replace function check_inventory_alert()
returns trigger language plpgsql as $$
begin
  if new.stock_current <= new.stock_minimum then
    insert into inventory_alerts (company_id, product_id, alert_type, message)
    values (
      new.company_id,
      new.id,
      case when new.stock_current = 0 then 'out_of_stock' else 'low_stock' end,
      case
        when new.stock_current = 0
          then new.name || ' está agotado'
          else new.name || ' está bajo (stock: ' || new.stock_current::text || ' ' || new.unit || ')'
      end
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger trg_inv_product_stock_alert
  after update of stock_current on inventory_products
  for each row execute function check_inventory_alert();
