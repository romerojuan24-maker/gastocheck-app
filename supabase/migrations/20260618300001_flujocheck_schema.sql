-- ─────────────────────────────────────────────────────────────────────────────
-- FlujoCheck — flujo de caja proyectado
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists cash_flow_items (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  item_type     text not null,
  -- income | expense | invoice_receivable | pending_advance | inventory_restock | other
  description   text not null,
  expected_date date not null,
  amount        numeric(15,2) not null,          -- siempre positivo
  direction     text not null default 'out',     -- in | out
  status        text not null default 'pending',
  -- pending | paid | collected | at_risk | overdue | cancelled
  source        text not null default 'manual',
  -- manual | cobracheck | gastocheck | bancocheck | inventariocheck
  source_id     uuid,                            -- id del registro de origen
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
  base_snapshot      jsonb,                       -- copia del estado base
  adjustments        jsonb,                       -- modificaciones del escenario
  projected_balance  numeric(15,2),
  risk_level         text not null default 'green',  -- green | yellow | red
  created_by         uuid references profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ── Índices ───────────────────────────────────────────────────────────────────

create index if not exists idx_cash_flow_items_company on cash_flow_items(company_id);
create index if not exists idx_cash_flow_items_date on cash_flow_items(company_id, expected_date);
create index if not exists idx_cash_flow_items_status on cash_flow_items(company_id, status);
create index if not exists idx_cash_flow_scenarios_company on cash_flow_scenarios(company_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table cash_flow_items     enable row level security;
alter table cash_flow_scenarios enable row level security;

create policy "member_see_cash_flow_items" on cash_flow_items
  for select using (
    exists (
      select 1 from company_members m
      where m.company_id = cash_flow_items.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
        and m.role in ('owner','admin','supervisor','accountant')
    )
  );

create policy "member_manage_cash_flow_items" on cash_flow_items
  for all using (
    exists (
      select 1 from company_members m
      where m.company_id = cash_flow_items.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
        and m.role in ('owner','admin','supervisor','accountant')
    )
  );

create policy "member_see_scenarios" on cash_flow_scenarios
  for select using (
    exists (
      select 1 from company_members m
      where m.company_id = cash_flow_scenarios.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
        and m.role in ('owner','admin','supervisor','accountant')
    )
  );

create policy "member_manage_scenarios" on cash_flow_scenarios
  for all using (
    exists (
      select 1 from company_members m
      where m.company_id = cash_flow_scenarios.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
        and m.role in ('owner','admin','supervisor','accountant')
    )
  );

-- ── Triggers ──────────────────────────────────────────────────────────────────

create trigger trg_cash_flow_items_updated_at
  before update on cash_flow_items
  for each row execute function update_updated_at();

create trigger trg_cash_flow_scenarios_updated_at
  before update on cash_flow_scenarios
  for each row execute function update_updated_at();
