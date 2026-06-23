-- Migración: Sistema Unificado de Rutas + Reportes (GastoCheck + CobraCheck)
-- Fecha: 2026-06-24
-- Propósito: Crear tablas base para rutas optimizadas, captura de movimientos y reportes diarios

-- ============================================================================
-- 1. EXTENDER cobra_clients CON HORARIOS Y PROCEDIMIENTOS
-- ============================================================================

ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS address TEXT;

-- Horarios de oficina (7 días)
ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS office_hours_monday_start TIME DEFAULT '09:00'::time;
ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS office_hours_monday_end TIME DEFAULT '18:00'::time;
ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS office_hours_tuesday_start TIME DEFAULT '09:00'::time;
ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS office_hours_tuesday_end TIME DEFAULT '18:00'::time;
ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS office_hours_wednesday_start TIME DEFAULT '09:00'::time;
ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS office_hours_wednesday_end TIME DEFAULT '18:00'::time;
ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS office_hours_thursday_start TIME DEFAULT '09:00'::time;
ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS office_hours_thursday_end TIME DEFAULT '18:00'::time;
ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS office_hours_friday_start TIME DEFAULT '09:00'::time;
ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS office_hours_friday_end TIME DEFAULT '18:00'::time;
ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS office_hours_saturday_start TIME DEFAULT '10:00'::time;
ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS office_hours_saturday_end TIME DEFAULT '13:00'::time;
ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS office_hours_sunday_start TIME;
ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS office_hours_sunday_end TIME;

-- Contacto y procedimientos
ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255);
ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS access_instructions TEXT; -- "Parqueo entrada 2A. Recepción piso 3."
ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS business_type VARCHAR(50); -- oficina, comercio, residencia
ALTER TABLE cobra_clients ADD COLUMN IF NOT EXISTS last_visit_date DATE;

-- ============================================================================
-- 2. TABLA: daily_routes (Ruta diaria/semanal para cobrador o comprador)
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL, -- user_id del cobrador/comprador
  actor_type VARCHAR(20) NOT NULL, -- 'cobrador' | 'comprador'
  assigned_date DATE NOT NULL,
  assigned_week INTEGER, -- opcional: semana del año

  -- Clientes asignados en ORDEN optimizado
  clients_assigned UUID[] NOT NULL DEFAULT '{}',

  -- Métricas de ruta
  total_distance_km DECIMAL(10, 2),
  estimated_duration_hours DECIMAL(5, 2),
  route_priority VARCHAR(20) DEFAULT 'media', -- baja, media, alta

  -- Estado
  status VARCHAR(20) NOT NULL DEFAULT 'planned', -- planned, in_progress, completed
  notes_supervisor TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_actor FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT unique_daily_route UNIQUE(company_id, actor_id, actor_type, assigned_date)
);

CREATE INDEX idx_daily_routes_company_actor ON daily_routes(company_id, actor_id);
CREATE INDEX idx_daily_routes_assigned_date ON daily_routes(assigned_date);

-- ============================================================================
-- 3. TABLA: movement_attempts (Intentos de movimientos - GastoCheck + CobraCheck)
-- ============================================================================

CREATE TABLE IF NOT EXISTS movement_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,

  -- Actor (cobrador o comprador)
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_type VARCHAR(20) NOT NULL, -- 'cobrador' | 'comprador'

  -- Documento (factura/gasto/etc)
  invoice_id UUID, -- reference cobra_invoices o gastocheck_expenses
  client_id UUID NOT NULL REFERENCES cobra_clients(id) ON DELETE CASCADE,

  -- Ubicación y tiempo
  attempt_date DATE NOT NULL,
  attempt_time TIME,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  -- Resultado del intento
  status_after VARCHAR(20) NOT NULL, -- 'pagó', 'pagó_parcial', 'no_pagó', 'promesa', 'no_disponible'
  amount_collected DECIMAL(15, 2), -- monto recaudado si pagó

  -- Si no pagó
  reason_not_paid VARCHAR(100), -- 'sin_fondos', 'disputa', 'no_disponible', 'rechazó', etc
  new_payment_date DATE, -- si hay promesa

  -- Contexto
  contact_person_met VARCHAR(255), -- con quién se habló
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_movement_attempts_company_actor ON movement_attempts(company_id, actor_id);
CREATE INDEX idx_movement_attempts_attempt_date ON movement_attempts(attempt_date);
CREATE INDEX idx_movement_attempts_client ON movement_attempts(client_id);

-- ============================================================================
-- 4. TABLA: daily_movement_report (Reporte diario del actor)
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_movement_report (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,

  -- Actor
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_type VARCHAR(20) NOT NULL,

  -- Fecha y ruta
  report_date DATE NOT NULL,
  route_id UUID REFERENCES daily_routes(id) ON DELETE SET NULL,

  -- Resumen de actividad
  total_clients_visited INTEGER DEFAULT 0,
  total_movements_processed INTEGER DEFAULT 0,
  total_amount_collected DECIMAL(15, 2) DEFAULT 0,
  total_partial_payments DECIMAL(15, 2) DEFAULT 0,
  total_promises INTEGER DEFAULT 0,

  -- Logística
  distance_traveled_km DECIMAL(10, 2),
  duration_hours DECIMAL(5, 2),
  time_started TIME,
  time_ended TIME,

  -- Efectivo
  cash_balance_start DECIMAL(15, 2) DEFAULT 0,
  cash_balance_end DECIMAL(15, 2) DEFAULT 0,

  -- Aprobación
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, submitted, approved, rejected
  supervisor_notes TEXT,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_daily_report UNIQUE(company_id, actor_id, actor_type, report_date)
);

CREATE INDEX idx_daily_movement_report_company_actor ON daily_movement_report(company_id, actor_id);
CREATE INDEX idx_daily_movement_report_date ON daily_movement_report(report_date);
CREATE INDEX idx_daily_movement_report_status ON daily_movement_report(status);

-- ============================================================================
-- 5. TABLA: cash_deposits (Depósitos de efectivo)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cash_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,

  -- Actor
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_type VARCHAR(20) NOT NULL,

  -- Depósito
  deposit_date DATE NOT NULL,
  deposit_time TIME,
  amount_deposited DECIMAL(15, 2) NOT NULL,

  -- Referencia
  report_id UUID REFERENCES daily_movement_report(id) ON DELETE SET NULL,
  invoices_paid UUID[] DEFAULT '{}', -- array de invoice_ids depositados
  receipt_number VARCHAR(100), -- referencia banco

  -- Verificación
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending_verification, verified
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cash_deposits_company_actor ON cash_deposits(company_id, actor_id);
CREATE INDEX idx_cash_deposits_date ON cash_deposits(deposit_date);
CREATE INDEX idx_cash_deposits_status ON cash_deposits(status);

-- ============================================================================
-- 6. TABLA: reason_codes (Catálogo de motivos de no pago/no entrega)
-- ============================================================================

CREATE TABLE IF NOT EXISTS reason_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES company(id) ON DELETE CASCADE,

  code VARCHAR(50) NOT NULL,
  description VARCHAR(255) NOT NULL,

  -- A quién aplica
  applicable_to VARCHAR(50) NOT NULL, -- 'cobrador', 'comprador', 'ambos'

  -- Orden en dropdown
  sort_order INTEGER DEFAULT 0,

  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_reason_code UNIQUE(company_id, code)
);

CREATE INDEX idx_reason_codes_company ON reason_codes(company_id);
CREATE INDEX idx_reason_codes_active ON reason_codes(is_active);

-- Insertar motivos por defecto (globales, sin company_id)
INSERT INTO reason_codes (code, description, applicable_to, sort_order) VALUES
  ('sin_fondos', 'Cliente sin fondos disponibles', 'ambos', 10),
  ('disputa', 'Cliente disputa el monto', 'ambos', 20),
  ('no_disponible', 'Cliente no disponible en horario', 'ambos', 30),
  ('rechazó_pago', 'Cliente rechazó realizar el pago', 'ambos', 40),
  ('cambio_dirección', 'Cliente cambió de dirección', 'ambos', 50),
  ('empresa_cerrada', 'Empresa cerrada/vacaciones', 'ambos', 60),
  ('contacto_incorrecto', 'Contacto incorrecto/no existe', 'ambos', 70),
  ('otro', 'Otro motivo', 'ambos', 999)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. RLS POLICIES (Row Level Security)
-- ============================================================================

-- Habilitar RLS
ALTER TABLE daily_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE movement_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_movement_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_deposits ENABLE ROW LEVEL SECURITY;

-- Policy: Actor ve solo su ruta del día
CREATE POLICY "actor_sees_own_route" ON daily_routes
  FOR SELECT
  USING (
    actor_id = auth.uid() AND
    assigned_date = CURRENT_DATE
  );

-- Policy: Actor registra movimientos solo en su ruta
CREATE POLICY "actor_registers_own_movements" ON movement_attempts
  FOR INSERT
  WITH CHECK (actor_id = auth.uid());

-- Policy: Actor ve solo sus propios movimientos
CREATE POLICY "actor_sees_own_movements" ON movement_attempts
  FOR SELECT
  USING (actor_id = auth.uid());

-- Policy: Actor ve solo su reporte
CREATE POLICY "actor_sees_own_report" ON daily_movement_report
  FOR SELECT
  USING (actor_id = auth.uid());

-- Policy: Actor registra su propio reporte
CREATE POLICY "actor_registers_own_report" ON daily_movement_report
  FOR INSERT
  WITH CHECK (actor_id = auth.uid());

-- Policy: Supervisor ve todos los reportes de su empresa
CREATE POLICY "supervisor_sees_company_reports" ON daily_movement_report
  FOR SELECT
  USING (
    company_id = (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor')
    )
  );

-- Policy: Supervisor ve todos los depósitos de su empresa
CREATE POLICY "supervisor_sees_company_deposits" ON cash_deposits
  FOR SELECT
  USING (
    company_id = (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor')
    )
  );

-- Policy: Supervisor crea rutas para su empresa
CREATE POLICY "supervisor_creates_routes" ON daily_routes
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor')
    )
  );

-- ============================================================================
-- 8. FUNCIONES HELPER
-- ============================================================================

-- Función: Obtener horario de oficina del cliente para hoy
CREATE OR REPLACE FUNCTION get_client_office_hours(client_id UUID)
RETURNS TABLE(opens_at TIME, closes_at TIME, is_open BOOLEAN) AS $$
DECLARE
  day_name TEXT;
  start_col TEXT;
  end_col TEXT;
  start_time TIME;
  end_time TIME;
BEGIN
  day_name := to_char(CURRENT_DATE, 'Day')::TEXT;
  start_col := 'office_hours_' || LOWER(TRIM(day_name)) || '_start';
  end_col := 'office_hours_' || LOWER(TRIM(day_name)) || '_end';

  EXECUTE format('SELECT %I, %I FROM cobra_clients WHERE id = $1', start_col, end_col)
    INTO start_time, end_time
    USING client_id;

  RETURN QUERY SELECT start_time, end_time, (start_time IS NOT NULL);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DONE
-- ============================================================================
-- Todas las tablas creadas con RLS habilitado y policies listas
-- Próximo paso: Edge Function para optimizar rutas (TSP)
