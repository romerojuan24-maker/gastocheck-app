-- Rutas diarias de mensajeros/compradores
-- Los puntos GPS se guardan localmente y se sincronizan por WiFi

CREATE TABLE IF NOT EXISTS daily_routes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid        NOT NULL REFERENCES companies(id)   ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  route_date   date        NOT NULL,
  points       jsonb       NOT NULL DEFAULT '[]',   -- [{lat,lng,ts,note?}]
  total_km     numeric(8,2),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, route_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_routes_company_date ON daily_routes(company_id, route_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_routes_user_date   ON daily_routes(user_id,    route_date DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_daily_routes_touch
  BEFORE UPDATE ON daily_routes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE daily_routes ENABLE ROW LEVEL SECURITY;

-- El propio usuario gestiona su ruta
CREATE POLICY "own route" ON daily_routes FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin / supervisor puede leer rutas de toda la empresa
CREATE POLICY "admin read routes" ON daily_routes FOR SELECT
  USING (auth_role(company_id) IN ('owner','admin','superadmin','supervisor'));
