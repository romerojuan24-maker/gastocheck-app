-- InventarioCheck — Wave 1 (Core): ubicaciones, stock por ubicación,
-- movimientos ACID vía RPC, idempotencia, audit log reutilizado.
-- Extiende el esquema real ya en producción (inventory_products/
-- inventory_movements/inventory_alerts) — NO usa el esquema paralelo
-- 'inv_*' de 20260708000003 (roto, nunca se aplicó, se descarta).

-- ── Ubicaciones (jerárquicas) ────────────────────────────────────────────
create table if not exists inventory_locations (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  name        text not null,
  type        text not null default 'warehouse',
  -- company | branch | warehouse | area | shelf | vehicle | employee | project | customer | other
  parent_id   uuid references inventory_locations(id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_inv_locations_company on inventory_locations(company_id);

-- ── Stock por ubicación (un producto puede estar en varias) ──────────────
create table if not exists inventory_stock (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  product_id  uuid not null references inventory_products(id) on delete cascade,
  location_id uuid not null references inventory_locations(id) on delete cascade,
  quantity    numeric(12,3) not null default 0,
  updated_at  timestamptz not null default now(),
  unique (company_id, product_id, location_id)
);
create index if not exists idx_inv_stock_product on inventory_stock(product_id);
create index if not exists idx_inv_stock_location on inventory_stock(location_id);

-- ── Movimientos: agrega ubicación, motivo, transferencia, idempotencia ───
alter table inventory_movements
  add column if not exists location_id     uuid references inventory_locations(id) on delete set null,
  add column if not exists to_location_id  uuid references inventory_locations(id) on delete set null,  -- solo transfer
  add column if not exists reason          text,   -- venta | uso | compra | cliente | proyecto | merma | ajuste | otro
  add column if not exists idempotency_key text;

comment on column inventory_movements.idempotency_key is
  'Evita duplicar un movimiento por doble tap o reintento de red — único por empresa.';

create unique index if not exists idx_inv_movements_idempotency
  on inventory_movements(company_id, idempotency_key)
  where idempotency_key is not null;

-- ── Empresa sin control explícito de negativos = no permitido ────────────
alter table companies
  add column if not exists allow_negative_inventory boolean not null default false;

-- ── RLS ────────────────────────────────────────────────────────────────
alter table inventory_locations enable row level security;
alter table inventory_stock     enable row level security;

drop policy if exists "member_see_inv_locations" on inventory_locations;
create policy "member_see_inv_locations" on inventory_locations for select using (
  exists (select 1 from company_members m where m.company_id = inventory_locations.company_id and m.user_id = auth.uid() and m.status = 'active')
);
drop policy if exists "member_manage_inv_locations" on inventory_locations;
create policy "member_manage_inv_locations" on inventory_locations for all using (
  exists (
    select 1 from company_members m where m.company_id = inventory_locations.company_id and m.user_id = auth.uid() and m.status = 'active'
      and m.role in ('owner','admin','supervisor','operator','accountant','contador_general')
  )
);

drop policy if exists "member_see_inv_stock" on inventory_stock;
create policy "member_see_inv_stock" on inventory_stock for select using (
  exists (select 1 from company_members m where m.company_id = inventory_stock.company_id and m.user_id = auth.uid() and m.status = 'active')
);

-- inventory_stock se escribe SOLO vía RPC (security definer) — sin policy
-- de insert/update para miembros normales, para forzar que todo movimiento
-- pase por inventory_quick_movement/inventory_transfer (ACID real).

-- ── Ubicación "Almacén General" por cada empresa que ya tiene productos ──
-- (para no dejar huérfano el stock_current existente en inventory_products)
insert into inventory_locations (company_id, name, type)
select distinct company_id, 'Almacén General', 'warehouse'
from inventory_products
where company_id not in (select company_id from inventory_locations)
on conflict do nothing;

insert into inventory_stock (company_id, product_id, location_id, quantity)
select p.company_id, p.id, l.id, p.stock_current
from inventory_products p
join inventory_locations l on l.company_id = p.company_id and l.name = 'Almacén General'
where not exists (select 1 from inventory_stock s where s.product_id = p.id and s.location_id = l.id)
on conflict do nothing;
