-- ============================================================
-- FIX INTEGRAL: tablas faltantes + GRANTs + reload schema cache
-- El CLI de Supabase registró varias migraciones como aplicadas
-- pero su SQL falló silenciosamente (race conditions / dependencias).
-- Esta migración recrea todo con IF NOT EXISTS y es idempotente.
-- ============================================================

-- ── 1. Tablas de flota (fleet_vertical) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicles (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  economic_number  text,
  plates           text,
  brand            text,
  model            text,
  year             integer,
  vehicle_type     text        NOT NULL DEFAULT 'otro',
  current_km       integer,
  status           text        NOT NULL DEFAULT 'active',
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operators (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                text        NOT NULL,
  phone               text,
  license_number      text,
  status              text        NOT NULL DEFAULT 'active',
  assigned_vehicle_id uuid        REFERENCES vehicles(id) ON DELETE SET NULL,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  zone         text,
  city         text,
  distance_km  numeric,
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fleet_clients (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  address      text,
  client_type  text        NOT NULL DEFAULT 'regular',
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Columnas fleet en receipts (idempotente)
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS vehicle_id      uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operator_id     uuid REFERENCES operators(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS route_id        uuid REFERENCES routes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fleet_client_id uuid REFERENCES fleet_clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_company      ON vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_operators_company     ON operators(company_id);
CREATE INDEX IF NOT EXISTS idx_routes_company        ON routes(company_id);
CREATE INDEX IF NOT EXISTS idx_fleet_clients_company ON fleet_clients(company_id);
CREATE INDEX IF NOT EXISTS idx_receipts_vehicle      ON receipts(vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_receipts_operator     ON receipts(operator_id) WHERE operator_id IS NOT NULL;

ALTER TABLE vehicles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE operators     ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_clients ENABLE ROW LEVEL SECURITY;

-- ── 2. Solicitudes de anticipo (advance_requests) ──────────────────────────────

CREATE TABLE IF NOT EXISTS advance_requests (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id        uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requester_id      uuid        NOT NULL REFERENCES auth.users(id),
  amount            numeric(12,2) NOT NULL CHECK (amount > 0),
  reason            text        NOT NULL,
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewer_id       uuid        REFERENCES auth.users(id),
  reviewed_at       timestamptz,
  rejection_reason  text,
  linked_advance_id uuid        REFERENCES advances(id) ON DELETE SET NULL,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advance_requests_company_idx   ON advance_requests(company_id);
CREATE INDEX IF NOT EXISTS advance_requests_requester_idx ON advance_requests(requester_id);
CREATE INDEX IF NOT EXISTS advance_requests_status_idx    ON advance_requests(status);

ALTER TABLE advance_requests ENABLE ROW LEVEL SECURITY;

-- ── 3. Presupuestos mensuales (expense_budgets) ────────────────────────────────

CREATE TABLE IF NOT EXISTS expense_budgets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  holder_id    uuid REFERENCES auth.users(id),
  period_month date NOT NULL,
  amount       numeric(14,2) NOT NULL CHECK (amount >= 0),
  notes        text,
  created_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS expense_budgets_unique
  ON expense_budgets(company_id, COALESCE(holder_id::text, ''), period_month);

ALTER TABLE expense_budgets ENABLE ROW LEVEL SECURITY;

-- ── 4. Rutas diarias GPS (daily_routes) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_routes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid        NOT NULL REFERENCES companies(id)   ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  route_date   date        NOT NULL,
  points       jsonb       NOT NULL DEFAULT '[]',
  total_km     numeric(8,2),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, route_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_routes_company_date ON daily_routes(company_id, route_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_routes_user_date   ON daily_routes(user_id,    route_date DESC);

ALTER TABLE daily_routes ENABLE ROW LEVEL SECURITY;

-- ── 5. Políticas RLS (CREATE OR REPLACE no existe en PG; usamos DO + exception) ─

DO $$ BEGIN
  CREATE POLICY "fleet_vehicles_company_members" ON vehicles FOR ALL
    USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "fleet_operators_company_members" ON operators FOR ALL
    USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "fleet_routes_company_members" ON routes FOR ALL
    USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "fleet_clients_company_members" ON fleet_clients FOR ALL
    USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "adv_req_own" ON advance_requests FOR ALL
    USING (requester_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "adv_req_supervisor" ON advance_requests FOR ALL
    USING (EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = advance_requests.company_id
        AND company_members.user_id = auth.uid()
        AND company_members.role IN ('admin','supervisor')
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin manage budgets" ON expense_budgets FOR ALL
    USING  (auth_role(company_id) IN ('owner','admin','superadmin','supervisor'))
    WITH CHECK (auth_role(company_id) IN ('owner','admin','superadmin','supervisor'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "member read own budget" ON expense_budgets FOR SELECT
    USING (holder_id = auth.uid() OR auth_is_member(company_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "own route" ON daily_routes FOR ALL
    USING  (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin read routes" ON daily_routes FOR SELECT
    USING (auth_role(company_id) IN ('owner','admin','superadmin','supervisor'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 6. GRANTs a todas las tablas (resiliente — salta si la tabla no existe) ─────

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'profiles','companies','company_members','accounting_accounts',
    'expense_categories','cost_centers','policies','advances','expenses',
    'cfdi_data','expense_attachments','expense_audit','invitations','report_exports',
    'receipts','suppliers','purchase_items','receipt_batches','receipt_batch_items',
    'receipt_duplicate_matches','receipt_tags','expense_tags',
    'audit_logs','notifications','sync_queue','trial_devices','subscriptions',
    'billing_plans','company_counters','events','event_expenses',
    'expense_category_templates','expense_category_rules',
    'accounting_category_map','accounting_export_profiles','policy_snapshots',
    'vehicles','operators','routes','fleet_clients',
    'advance_requests','expense_budgets','daily_routes'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated', tbl);
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'Tabla % no existe, omitiendo GRANT', tbl;
    END;
  END LOOP;
END $$;

-- ── 7. Forzar reload del schema cache ─────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
