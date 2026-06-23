-- ============================================================================
-- GastoCheck Mobile - Mi Ruta
-- Migración: Tablas para captura de cobros en campo
-- Date: 2026-06-23
-- ============================================================================

-- ============================================================================
-- 1. TABLA: daily_routes
-- Descripción: Ruta optimizada diaria asignada a cada cobrador
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES company_members(id) ON DELETE CASCADE,
  route_date DATE NOT NULL,
  client_id UUID NOT NULL REFERENCES cobra_clients(id) ON DELETE CASCADE,
  sequence INT NOT NULL,
  distance_km DECIMAL(8, 2),
  eta_minutes INT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'visited', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(actor_id, route_date, client_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_routes_actor_date
ON daily_routes(actor_id, route_date);

CREATE INDEX IF NOT EXISTS idx_daily_routes_company
ON daily_routes(company_id, route_date);

COMMENT ON TABLE daily_routes IS 'Ruta optimizada del cobrador por día';
COMMENT ON COLUMN daily_routes.sequence IS 'Orden en que visitar clientes';
COMMENT ON COLUMN daily_routes.distance_km IS 'Distancia desde cliente anterior';
COMMENT ON COLUMN daily_routes.eta_minutes IS 'Tiempo estimado de llegada desde cliente anterior';

-- ============================================================================
-- 2. TABLA: cobra_movements
-- Descripción: Registra cada intento de cobro en el campo
-- ============================================================================

CREATE TABLE IF NOT EXISTS cobra_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES cobra_clients(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES cobra_invoices(id),
  actor_id UUID NOT NULL REFERENCES company_members(id) ON DELETE CASCADE,
  movement_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('paid', 'unpaid', 'promise')),
  amount DECIMAL(10, 2) NOT NULL,
  method TEXT CHECK (method IN ('cash', 'transfer', 'check', 'card')),
  payment_date TIMESTAMPTZ,
  unpaid_reason TEXT,
  promise_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cobra_movements_actor_date
ON cobra_movements(actor_id, movement_date DESC);

CREATE INDEX IF NOT EXISTS idx_cobra_movements_client
ON cobra_movements(client_id);

CREATE INDEX IF NOT EXISTS idx_cobra_movements_status
ON cobra_movements(status);

COMMENT ON TABLE cobra_movements IS 'Intentos de cobro registrados en campo';
COMMENT ON COLUMN cobra_movements.status IS 'paid: pagó, unpaid: no pagó, promise: promesa de pago';
COMMENT ON COLUMN cobra_movements.method IS 'Método de pago (cash/transfer/check/card)';
COMMENT ON COLUMN cobra_movements.promise_date IS 'Fecha en que promete pagar';

-- ============================================================================
-- 3. TABLA: cobra_daily_reports
-- Descripción: Reporte diario enviado a supervisor
-- ============================================================================

CREATE TABLE IF NOT EXISTS cobra_daily_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES company_members(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  clients_visited INT DEFAULT 0,
  total_collected DECIMAL(10, 2) DEFAULT 0,
  promises_made INT DEFAULT 0,
  cash_deposited DECIMAL(10, 2) DEFAULT 0,
  cash_deposit_ref TEXT,
  notes TEXT,
  submitted_to_id UUID REFERENCES company_members(id),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(actor_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_cobra_daily_reports_date
ON cobra_daily_reports(report_date);

CREATE INDEX IF NOT EXISTS idx_cobra_daily_reports_submitted
ON cobra_daily_reports(submitted_at);

COMMENT ON TABLE cobra_daily_reports IS 'Resumen diario de cobrador para supervisor';
COMMENT ON COLUMN cobra_daily_reports.clients_visited IS 'Cantidad de clientes visitados';
COMMENT ON COLUMN cobra_daily_reports.total_collected IS 'Monto total cobrado en MXN';
COMMENT ON COLUMN cobra_daily_reports.cash_deposit_ref IS 'Referencia del depósito de efectivo';

-- ============================================================================
-- 4. TABLA: cobra_cash_deposits
-- Descripción: Registro de depósitos de efectivo realizados
-- ============================================================================

CREATE TABLE IF NOT EXISTS cobra_cash_deposits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES company_members(id) ON DELETE CASCADE,
  report_id UUID REFERENCES cobra_daily_reports(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  deposit_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reference TEXT,
  bank_account_id UUID,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cobra_cash_deposits_actor_date
ON cobra_cash_deposits(actor_id, deposit_date DESC);

CREATE INDEX IF NOT EXISTS idx_cobra_cash_deposits_verified
ON cobra_cash_deposits(verified, verified_at);

COMMENT ON TABLE cobra_cash_deposits IS 'Depósitos de efectivo realizados por cobrador';
COMMENT ON COLUMN cobra_cash_deposits.reference IS 'Comprobante o referencia del depósito';
COMMENT ON COLUMN cobra_cash_deposits.verified IS 'Si fue verificado por supervisor';

-- ============================================================================
-- 5. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Habilitar RLS
ALTER TABLE daily_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobra_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobra_daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobra_cash_deposits ENABLE ROW LEVEL SECURITY;

-- Política: daily_routes - Cobrador ve su propia ruta
CREATE POLICY "Cobrador ve su propia ruta" ON daily_routes FOR SELECT
USING (
  auth.uid() = (
    SELECT auth_id FROM company_members WHERE id = actor_id
  )
);

-- Política: daily_routes - Supervisor ve rutas de su equipo
CREATE POLICY "Supervisor ve rutas del equipo" ON daily_routes FOR SELECT
USING (
  auth.uid() IN (
    SELECT auth_id FROM company_members cm
    WHERE cm.company_id = daily_routes.company_id
    AND cm.role IN ('supervisor', 'admin')
  )
);

-- Política: cobra_movements - Cobrador crea sus propios movimientos
CREATE POLICY "Cobrador crea sus movimientos" ON cobra_movements FOR INSERT
WITH CHECK (
  auth.uid() = (
    SELECT auth_id FROM company_members WHERE id = actor_id
  )
);

-- Política: cobra_movements - Cobrador ve sus movimientos
CREATE POLICY "Cobrador ve sus movimientos" ON cobra_movements FOR SELECT
USING (
  auth.uid() = (
    SELECT auth_id FROM company_members WHERE id = actor_id
  )
);

-- Política: cobra_movements - Supervisor ve movimientos de su equipo
CREATE POLICY "Supervisor ve movimientos" ON cobra_movements FOR SELECT
USING (
  auth.uid() IN (
    SELECT auth_id FROM company_members cm
    WHERE cm.company_id = cobra_movements.company_id
    AND cm.role IN ('supervisor', 'admin')
  )
);

-- Política: cobra_daily_reports - Cobrador crea su reporte
CREATE POLICY "Cobrador crea reporte" ON cobra_daily_reports FOR INSERT
WITH CHECK (
  auth.uid() = (
    SELECT auth_id FROM company_members WHERE id = actor_id
  )
);

-- Política: cobra_daily_reports - Supervisor ve reportes
CREATE POLICY "Supervisor ve reportes" ON cobra_daily_reports FOR SELECT
USING (
  auth.uid() IN (
    SELECT auth_id FROM company_members cm
    WHERE cm.company_id = cobra_daily_reports.company_id
    AND cm.role IN ('supervisor', 'admin')
  )
);

-- Política: cobra_daily_reports - Cobrador puede actualizar su reporte
CREATE POLICY "Cobrador actualiza reporte" ON cobra_daily_reports FOR UPDATE
USING (
  auth.uid() = (
    SELECT auth_id FROM company_members WHERE id = actor_id
  )
);

-- Política: cobra_cash_deposits - Cobrador crea depósito
CREATE POLICY "Cobrador crea depósito" ON cobra_cash_deposits FOR INSERT
WITH CHECK (
  auth.uid() = (
    SELECT auth_id FROM company_members WHERE id = actor_id
  )
);

-- Política: cobra_cash_deposits - Cobrador ve sus depósitos
CREATE POLICY "Cobrador ve sus depósitos" ON cobra_cash_deposits FOR SELECT
USING (
  auth.uid() = (
    SELECT auth_id FROM company_members WHERE id = actor_id
  )
);

-- Política: cobra_cash_deposits - Supervisor ve depósitos
CREATE POLICY "Supervisor ve depósitos" ON cobra_cash_deposits FOR SELECT
USING (
  auth.uid() IN (
    SELECT auth_id FROM company_members cm
    WHERE cm.company_id = cobra_cash_deposits.company_id
    AND cm.role IN ('supervisor', 'admin')
  )
);

-- ============================================================================
-- 6. FUNCIONES HELPER
-- ============================================================================

-- Función: Obtener estadísticas del cobrador del día
CREATE OR REPLACE FUNCTION get_cobrador_daily_stats(
  p_actor_id UUID,
  p_date DATE
)
RETURNS TABLE (
  clients_visited INT,
  total_collected NUMERIC,
  total_pending NUMERIC,
  promises_made INT,
  cash_deposited NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT cm.client_id)::INT as clients_visited,
    COALESCE(SUM(CASE WHEN cm.status = 'paid' THEN cm.amount ELSE 0 END), 0) as total_collected,
    COALESCE(
      SUM(CASE WHEN ci.status IN ('pending', 'partial') THEN ci.amount ELSE 0 END), 0
    ) as total_pending,
    COUNT(CASE WHEN cm.status = 'promise' THEN 1 END)::INT as promises_made,
    COALESCE(
      SUM(CASE WHEN cm.method = 'cash' AND cm.status = 'paid' THEN cm.amount ELSE 0 END), 0
    ) as cash_deposited
  FROM cobra_movements cm
  LEFT JOIN cobra_invoices ci ON cm.client_id = ci.client_id
  WHERE cm.actor_id = p_actor_id
  AND DATE(cm.movement_date) = p_date;
END;
$$ LANGUAGE plpgsql STABLE;

-- Función: Obtener ruta del día con datos agregados
CREATE OR REPLACE FUNCTION get_daily_route_with_details(
  p_actor_id UUID,
  p_date DATE
)
RETURNS TABLE (
  route_id UUID,
  sequence INT,
  client_id UUID,
  client_name TEXT,
  address TEXT,
  phone TEXT,
  office_hours TEXT,
  lat DECIMAL,
  lng DECIMAL,
  distance_km DECIMAL,
  eta_minutes INT,
  invoices_count INT,
  total_invoice_amount NUMERIC,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dr.id,
    dr.sequence,
    dr.client_id,
    cc.name,
    cc.address,
    cc.phone,
    cc.office_hours,
    cc.lat,
    cc.lng,
    dr.distance_km,
    dr.eta_minutes,
    COUNT(ci.id)::INT,
    COALESCE(SUM(ci.amount), 0),
    dr.status
  FROM daily_routes dr
  JOIN cobra_clients cc ON dr.client_id = cc.id
  LEFT JOIN cobra_invoices ci ON cc.id = ci.client_id
    AND ci.status IN ('pending', 'partial')
  WHERE dr.actor_id = p_actor_id
  AND dr.route_date = p_date
  GROUP BY dr.id, cc.id
  ORDER BY dr.sequence ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Función: Trigger para actualizar reporte cuando se agrega movimiento
CREATE OR REPLACE FUNCTION update_daily_report_on_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_report_id UUID;
BEGIN
  -- Crear o actualizar reporte
  INSERT INTO cobra_daily_reports (
    company_id,
    actor_id,
    report_date,
    clients_visited,
    total_collected,
    promises_made,
    cash_deposited
  )
  SELECT
    NEW.company_id,
    NEW.actor_id,
    DATE(NEW.movement_date),
    COUNT(DISTINCT client_id),
    COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0),
    COUNT(CASE WHEN status = 'promise' THEN 1 END),
    COALESCE(SUM(CASE WHEN method = 'cash' AND status = 'paid' THEN amount ELSE 0 END), 0)
  FROM cobra_movements
  WHERE actor_id = NEW.actor_id
  AND DATE(movement_date) = DATE(NEW.movement_date)
  ON CONFLICT (actor_id, report_date)
  DO UPDATE SET
    clients_visited = EXCLUDED.clients_visited,
    total_collected = EXCLUDED.total_collected,
    promises_made = EXCLUDED.promises_made,
    cash_deposited = EXCLUDED.cash_deposited,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
DROP TRIGGER IF EXISTS trg_update_daily_report_on_movement ON cobra_movements;
CREATE TRIGGER trg_update_daily_report_on_movement
AFTER INSERT ON cobra_movements
FOR EACH ROW
EXECUTE FUNCTION update_daily_report_on_movement();

-- ============================================================================
-- 7. DATOS DE PRUEBA (OPCIONAL - comentar en producción)
-- ============================================================================

/*
-- Datos de prueba para desarrollo
INSERT INTO daily_routes (company_id, actor_id, route_date, client_id, sequence, distance_km, eta_minutes, status)
SELECT
  'company-id-test'::UUID,
  'actor-id-test'::UUID,
  '2026-06-23',
  id,
  ROW_NUMBER() OVER (ORDER BY RANDOM()),
  ROUND((RANDOM() * 20)::NUMERIC, 2),
  (RANDOM() * 30)::INT
FROM cobra_clients
LIMIT 5;

-- Movimiento de prueba
INSERT INTO cobra_movements (company_id, client_id, actor_id, status, amount, method, notes)
SELECT
  'company-id-test'::UUID,
  id,
  'actor-id-test'::UUID,
  CASE (RANDOM() * 3)::INT WHEN 0 THEN 'paid' WHEN 1 THEN 'unpaid' ELSE 'promise' END,
  (RANDOM() * 5000 + 500)::NUMERIC,
  'cash',
  'Movimiento de prueba'
FROM cobra_clients
LIMIT 3;
*/

-- ============================================================================
-- 8. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON daily_routes TO authenticated;
GRANT INSERT, UPDATE ON cobra_movements TO authenticated;
GRANT SELECT, INSERT ON cobra_daily_reports TO authenticated;
GRANT INSERT, SELECT ON cobra_cash_deposits TO authenticated;

-- ============================================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================================
