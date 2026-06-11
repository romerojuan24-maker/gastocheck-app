-- GastoCheck — Vertical Flotillas y Reparto
-- Tablas: vehicles, operators, routes, fleet_clients
-- + columnas fleet en receipts

-- ── Vehículos ────────────────────────────────────────────────────────────────

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

-- ── Operadores ────────────────────────────────────────────────────────────────

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

-- ── Rutas ─────────────────────────────────────────────────────────────────────

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

-- ── Clientes de flotilla ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fleet_clients (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  address      text,
  client_type  text        NOT NULL DEFAULT 'regular',
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Columnas fleet en receipts ────────────────────────────────────────────────

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS vehicle_id      uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operator_id     uuid REFERENCES operators(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS route_id        uuid REFERENCES routes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fleet_client_id uuid REFERENCES fleet_clients(id) ON DELETE SET NULL;

-- ── Índices ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_vehicles_company      ON vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_operators_company     ON operators(company_id);
CREATE INDEX IF NOT EXISTS idx_routes_company        ON routes(company_id);
CREATE INDEX IF NOT EXISTS idx_fleet_clients_company ON fleet_clients(company_id);
CREATE INDEX IF NOT EXISTS idx_receipts_vehicle      ON receipts(vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_receipts_operator     ON receipts(operator_id) WHERE operator_id IS NOT NULL;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE vehicles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE operators     ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fleet_vehicles_company_members" ON vehicles
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "fleet_operators_company_members" ON operators
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "fleet_routes_company_members" ON routes
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "fleet_clients_company_members" ON fleet_clients
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );
