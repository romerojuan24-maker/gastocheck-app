-- SEED DATA: CobraCheck — Datos de Prueba Realistas
-- Propósito: Generar clientes, facturas, rutas y movimientos para revisar en web
-- Fecha: 2026-07-04

-- Obtener IDs de la empresa de prueba (usa empresa creada en tests)
-- Si no existe, se crea una nueva
WITH company_data AS (
  SELECT
    COALESCE(
      (SELECT id FROM companies WHERE name LIKE '%Test%' OR name LIKE '%Demo%' LIMIT 1),
      (INSERT INTO companies (name, sector, payment_schedule, status, created_by)
       VALUES ('CobraCheck Demo', 'retail', 'monthly', 'active', auth.uid())
       RETURNING id)
    ) as company_id
),

-- Obtener supervisor cobrador
supervisor_data AS (
  SELECT
    company_data.company_id,
    auth.uid() as current_user_id,
    'cobrador-supervisor-001' as supervisor_email
  FROM company_data
)

-- ============================================================================
-- CREAR COBRA_CLIENTS (Clientes para Cobrar)
-- ============================================================================
INSERT INTO cobra_clients (
  company_id,
  name,
  contact_name,
  phone,
  address,
  latitude,
  longitude,
  total_invoiced,
  total_overdue,
  days_overdue,
  risk_score,
  status
)
SELECT
  company_data.company_id,
  name,
  contact,
  phone,
  address,
  lat,
  lng,
  total_inv,
  total_over,
  days_over,
  risk,
  'active'
FROM company_data,
LATERAL (VALUES
  ('Restaurante "La Cocina Roja"', 'Carlos Mendoza', '5551234567', 'Av. Paseo de la Reforma 222, CDMX', 25.3456, -103.4567, 15000.00, 8500.00, 45, 85),
  ('Tienda "El Ahorro"', 'María García', '5559876543', 'Calle Insurgentes 555, CDMX', 25.3400, -103.4500, 22500.00, 12000.00, 60, 90),
  ('Farmacia "Cruz Azul"', 'Juan Pérez', '5553334444', 'Prolongación Paseo de la Reforma 100, CDMX', 25.3300, -103.4400, 8750.00, 2500.00, 15, 45),
  ('Ferretería "Constructor"', 'Roberto López', '5555556666', 'Calz. de Tlalpan 300, CDMX', 25.3250, -103.4350, 35000.00, 18000.00, 75, 95),
  ('Papelería "Moderna"', 'Ana Rodríguez', '5557778888', 'Av. Coyoacán 400, CDMX', 25.3200, -103.4300, 5500.00, 0.00, 0, 15),
  ('Hotel "Casa Blanca"', 'Fernando Díaz', '5559999000', 'Reforma 500, CDMX', 25.3150, -103.4250, 42000.00, 25000.00, 90, 98),
  ('Supermercado "Mega"', 'Patricia Ruiz', '5551111222', 'Periférico Sur 600, CDMX', 25.3100, -103.4200, 85000.00, 45000.00, 120, 99),
  ('Clínica "Salud Plus"', 'Dr. Miguel Santos', '5553334455', 'Vasco de Quiroga 700, CDMX', 25.3050, -103.4150, 28000.00, 15000.00, 50, 80)
) AS t(name, contact, phone, address, lat, lng, total_inv, total_over, days_over, risk)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- CREAR COBRA_INVOICES (Facturas por Cobrar)
-- ============================================================================
INSERT INTO cobra_invoices (
  company_id,
  client_id,
  invoice_number,
  amount,
  due_date,
  days_overdue,
  status
)
SELECT
  company_data.company_id,
  (SELECT id FROM cobra_clients WHERE company_id = company_data.company_id LIMIT 1),
  'FAC-' || LPAD(ROW_NUMBER() OVER (), 6, '0'),
  (RANDOM() * 5000 + 1000)::numeric(12,2),
  CURRENT_DATE - (RANDOM() * 120)::int,
  GREATEST(0, CURRENT_DATE - (CURRENT_DATE - (RANDOM() * 120)::int))::int,
  CASE WHEN RANDOM() < 0.3 THEN 'paid' WHEN RANDOM() < 0.7 THEN 'overdue' ELSE 'pending' END
FROM company_data
CROSS JOIN GENERATE_SERIES(1, 8)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- CREAR COBRA_ROUTES (Rutas Diarias)
-- ============================================================================
INSERT INTO cobra_routes (
  company_id,
  actor_id,
  actor_type,
  assigned_date,
  clients_assigned,
  status,
  route_priority,
  total_distance_km,
  estimated_duration_hours,
  clients_visited,
  payments_collected,
  promises_made,
  rejections,
  actual_duration_minutes
)
SELECT
  company_data.company_id,
  company_data.current_user_id,
  'cobrador',
  CURRENT_DATE - (GENERATE_SERIES % 3),
  ARRAY(SELECT id FROM cobra_clients WHERE company_id = company_data.company_id LIMIT 5),
  CASE WHEN GENERATE_SERIES = 1 THEN 'completed' WHEN GENERATE_SERIES = 2 THEN 'in_progress' ELSE 'planned' END,
  CASE WHEN GENERATE_SERIES = 1 THEN 'crítica' ELSE 'media' END,
  (15 + RANDOM() * 40)::numeric(10,2),
  (2 + RANDOM() * 3)::numeric(5,2),
  CASE WHEN GENERATE_SERIES = 1 THEN 5 WHEN GENERATE_SERIES = 2 THEN 3 ELSE 0 END,
  CASE WHEN GENERATE_SERIES = 1 THEN 25000.00 WHEN GENERATE_SERIES = 2 THEN 8500.00 ELSE 0 END,
  CASE WHEN GENERATE_SERIES = 1 THEN 2 WHEN GENERATE_SERIES = 2 THEN 1 ELSE 0 END,
  CASE WHEN GENERATE_SERIES = 1 THEN 0 WHEN GENERATE_SERIES = 2 THEN 1 ELSE 0 END,
  CASE WHEN GENERATE_SERIES = 1 THEN 180 WHEN GENERATE_SERIES = 2 THEN 120 ELSE NULL END
FROM company_data,
GENERATE_SERIES(1, 3) AS GENERATE_SERIES
ON CONFLICT (actor_id, assigned_date) DO UPDATE SET
  payments_collected = EXCLUDED.payments_collected,
  promises_made = EXCLUDED.promises_made
WHERE EXTRACT(DAY FROM cobra_routes.assigned_date) <= 5; -- Solo actualizar rutas recientes

-- ============================================================================
-- CREAR COBRA_MOVEMENTS (Intentos de Cobro)
-- ============================================================================
INSERT INTO cobra_movements (
  company_id,
  cobrador_id,
  client_id,
  invoice_id,
  movement_date,
  status,
  amount,
  method,
  payment_date,
  promise_date,
  notes
)
SELECT
  company_data.company_id,
  company_data.current_user_id,
  cc.id,
  ci.id,
  CURRENT_DATE - (GENERATE_SERIES % 5),
  CASE
    WHEN RANDOM() < 0.5 THEN 'paid'
    WHEN RANDOM() < 0.8 THEN 'promise'
    ELSE 'unpaid'
  END,
  CASE
    WHEN RANDOM() < 0.5 THEN ci.amount
    ELSE (ci.amount * (0.3 + RANDOM() * 0.7))::numeric(12,2)
  END,
  CASE WHEN RANDOM() < 0.6 THEN 'cash' WHEN RANDOM() < 0.8 THEN 'transfer' ELSE 'check' END,
  CASE WHEN RANDOM() < 0.5 THEN CURRENT_DATE - (GENERATE_SERIES % 3) ELSE NULL END,
  CASE WHEN RANDOM() < 0.3 THEN CURRENT_DATE + 7 ELSE NULL END,
  CASE
    WHEN RANDOM() < 0.3 THEN 'Pago parcial - cliente sin efectivo suficiente'
    WHEN RANDOM() < 0.5 THEN 'Promesa de pago para el viernes'
    ELSE NULL
  END
FROM company_data
CROSS JOIN (SELECT id FROM cobra_clients WHERE company_id = company_data.company_id LIMIT 3) cc
CROSS JOIN (SELECT id, amount FROM cobra_invoices WHERE company_id = company_data.company_id LIMIT 4) ci
CROSS JOIN GENERATE_SERIES(1, 4)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- CREAR COBRA_DAILY_REPORTS (Reportes Diarios)
-- ============================================================================
INSERT INTO cobra_daily_reports (
  company_id,
  cobrador_id,
  report_date,
  clients_visited,
  total_collected,
  total_promised,
  cash_deposits,
  notes
)
SELECT
  company_data.company_id,
  company_data.current_user_id,
  CURRENT_DATE - (GENERATE_SERIES % 3),
  3 + GENERATE_SERIES,
  (10000 + RANDOM() * 20000)::numeric(12,2),
  (5000 + RANDOM() * 10000)::numeric(12,2),
  (ARRAY[
    JSONB_BUILD_OBJECT('amount', (8000 + RANDOM() * 5000)::numeric(12,2), 'reference', 'DEP-' || LPAD((RANDOM() * 9999)::int::text, 4, '0'), 'deposit_date', CURRENT_DATE - (GENERATE_SERIES % 2))
  ]),
  'Reporte de cobranza - ' || CASE WHEN RANDOM() < 0.7 THEN 'Día productivo' ELSE 'Algunos rechazos pero avance' END
FROM company_data,
GENERATE_SERIES(1, 3)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Logging
-- ============================================================================
SELECT pg_notify('seed_cobracheck', 'Datos de prueba insertados correctamente');
