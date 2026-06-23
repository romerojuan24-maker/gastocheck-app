-- Seed data para CobraCheck, FlujoCheck, BancoCheck
-- Ejecutar solo en desarrollo

-- Clients demo
INSERT INTO cobra_clients (company_id, name, rfc, email, credit_limit, current_balance, risk_score) VALUES
('123e4567-e89b-12d3-a456-426614174000'::uuid, 'Cliente Acme Inc', 'AAA010101AAA', 'contact@acme.com', 50000, 25000, 45),
('123e4567-e89b-12d3-a456-426614174000'::uuid, 'Distribuidor Beta', 'BBB020202BBB', 'sales@beta.com', 100000, 75000, 75),
('123e4567-e89b-12d3-a456-426614174000'::uuid, 'Retailer Gamma', 'CCC030303CCC', 'admin@gamma.com', 30000, 15000, 20)
ON CONFLICT DO NOTHING;

-- Invoices demo
INSERT INTO cobra_invoices (company_id, client_id, folio, subtotal, tax, issue_date, due_date, status) VALUES
('123e4567-e89b-12d3-a456-426614174000'::uuid, (SELECT id FROM cobra_clients WHERE rfc = 'AAA010101AAA' LIMIT 1), 'F-001', 10000, 1600, '2026-06-10', '2026-06-25', 'overdue'),
('123e4567-e89b-12d3-a456-426614174000'::uuid, (SELECT id FROM cobra_clients WHERE rfc = 'BBB020202BBB' LIMIT 1), 'F-002', 35000, 5600, '2026-06-15', '2026-07-15', 'pending'),
('123e4567-e89b-12d3-a456-426614174000'::uuid, (SELECT id FROM cobra_clients WHERE rfc = 'CCC030303CCC' LIMIT 1), 'F-003', 15000, 2400, '2026-06-01', '2026-06-20', 'paid')
ON CONFLICT DO NOTHING;

-- Bank accounts demo
INSERT INTO bank_accounts (company_id, name, bank_name, account_number, current_balance, is_active) VALUES
('123e4567-e89b-12d3-a456-426614174000'::uuid, 'Cuenta Corriente Principal', 'Banco XXX', '1234567890', 500000, true),
('123e4567-e89b-12d3-a456-426614174000'::uuid, 'Cuenta Ahorros', 'Banco YYY', '0987654321', 250000, true)
ON CONFLICT DO NOTHING;

-- Cash flow items demo
INSERT INTO cash_flow_items (company_id, description, amount, direction, expected_date, source_type, source_id, is_scenario) VALUES
('123e4567-e89b-12d3-a456-426614174000'::uuid, 'Ingreso: Venta Cliente ABC', 50000, 'in', '2026-06-28', 'invoice', null, false),
('123e4567-e89b-12d3-a456-426614174000'::uuid, 'Egreso: Nómina', 80000, 'out', '2026-06-30', 'expense', null, false),
('123e4567-e89b-12d3-a456-426614174000'::uuid, 'Ingreso: Préstamo Bancario', 100000, 'in', '2026-07-05', 'loan', null, false)
ON CONFLICT DO NOTHING;
