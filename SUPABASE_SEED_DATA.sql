-- ============================================
-- GASTOCHECK SEED DATA PARA SUPABASE PRODUCCIÓN
-- ============================================
-- Instrucciones:
-- 1. Ir a Supabase Dashboard → Tu proyecto producción
-- 2. Ir a SQL Editor
-- 3. Click "+ New Query"
-- 4. Copiar y pegar ESTE SCRIPT completo
-- 5. Click "Run" o Ctrl+Enter
-- ============================================

-- ============================================
-- 1. CREAR EMPRESA DE TEST
-- ============================================
INSERT INTO public.companies (id, legal_name, rfc, sector, status, created_at)
VALUES
  (gen_random_uuid(), 'TEST Inc. - Development', 'TEST123456789', 'Manufactura', 'active', NOW())
RETURNING id AS company_id;

-- NOTA: Copiar el company_id devuelto y usarlo en los siguientes inserts
-- Reemplazar [COMPANY_ID] con el ID que aparezca arriba

-- ============================================
-- 2. CREAR USUARIOS DE TEST
-- ============================================
-- Nota: Los usuarios deben crearse en Supabase Auth primero
-- Pasos en Auth:
-- 1. Ir a Authentication → Users
-- 2. Click "+ Add user"
-- 3. Email: testadmin@gastocheck.com
-- 4. Password: TestPass123!
-- 5. Copiar el user_id devuelto
-- Reemplazar [USER_ID] con ese ID

-- Después de crear usuarios en Auth, inserta aquí:
INSERT INTO public.profiles (id, full_name, email, role)
VALUES
  ('[USER_ID]', 'Test Admin', 'testadmin@gastocheck.com', 'owner');

-- ============================================
-- 3. VINCULAR USUARIO A EMPRESA (company_members)
-- ============================================
INSERT INTO public.company_members (user_id, company_id, role, status)
VALUES
  ('[USER_ID]', '[COMPANY_ID]', 'owner', 'active');

-- ============================================
-- 4. CREAR CLIENTES TEST PARA COBRACHECK
-- ============================================
INSERT INTO public.cobra_clients (
  id, company_id, name, rfc, email, phone,
  current_balance, credit_limit, risk_score,
  days_without_payment, status, created_at
)
VALUES
  (gen_random_uuid(), '[COMPANY_ID]', 'Cliente Premium A', 'CLI001234567', 'clientea@example.com', '5215551111111', 150000, 200000, 35, 0, 'active', NOW()),
  (gen_random_uuid(), '[COMPANY_ID]', 'Cliente Riesgo B', 'CLI002345678', 'clienteb@example.com', '5215552222222', 250000, 300000, 75, 45, 'active', NOW()),
  (gen_random_uuid(), '[COMPANY_ID]', 'Cliente Crítico C', 'CLI003456789', 'clientec@example.com', '5215553333333', 500000, 500000, 90, 120, 'active', NOW()),
  (gen_random_uuid(), '[COMPANY_ID]', 'Cliente Nuevo D', 'CLI004567890', 'cliented@example.com', '5215554444444', 50000, 100000, 25, 0, 'active', NOW()),
  (gen_random_uuid(), '[COMPANY_ID]', 'Cliente Moroso E', 'CLI005678901', 'clientee@example.com', '5215555555555', 320000, 300000, 95, 180, 'active', NOW());

-- ============================================
-- 5. CREAR FACTURAS TEST PARA COBRACHECK
-- ============================================
-- Primero obtén los IDs de los clientes creados arriba
-- SELECT id FROM public.cobra_clients WHERE company_id = '[COMPANY_ID]' LIMIT 5;

INSERT INTO public.cobra_invoices (
  id, company_id, client_id, folio, amount, issue_date, due_date,
  status, days_overdue, created_at
)
VALUES
  -- Cliente 1: Factura próxima a vencer
  (gen_random_uuid(), '[COMPANY_ID]', (SELECT id FROM cobra_clients WHERE company_id = '[COMPANY_ID]' LIMIT 1), 'FAC-001', 50000, NOW() - INTERVAL '10 days', NOW() + INTERVAL '5 days', 'pending', NULL, NOW()),

  -- Cliente 2: Facturas vencidas
  (gen_random_uuid(), '[COMPANY_ID]', (SELECT id FROM cobra_clients WHERE company_id = '[COMPANY_ID]' LIMIT 1 OFFSET 1), 'FAC-002', 75000, NOW() - INTERVAL '45 days', NOW() - INTERVAL '15 days', 'overdue', 15, NOW()),
  (gen_random_uuid(), '[COMPANY_ID]', (SELECT id FROM cobra_clients WHERE company_id = '[COMPANY_ID]' LIMIT 1 OFFSET 1), 'FAC-003', 125000, NOW() - INTERVAL '60 days', NOW() - INTERVAL '30 days', 'overdue', 30, NOW()),

  -- Cliente 3: Factura muy vencida
  (gen_random_uuid(), '[COMPANY_ID]', (SELECT id FROM cobra_clients WHERE company_id = '[COMPANY_ID]' LIMIT 1 OFFSET 2), 'FAC-004', 300000, NOW() - INTERVAL '120 days', NOW() - INTERVAL '90 days', 'overdue', 90, NOW()),

  -- Cliente 4: Varias facturas
  (gen_random_uuid(), '[COMPANY_ID]', (SELECT id FROM cobra_clients WHERE company_id = '[COMPANY_ID]' LIMIT 1 OFFSET 3), 'FAC-005', 25000, NOW() - INTERVAL '2 days', NOW() + INTERVAL '13 days', 'pending', NULL, NOW()),
  (gen_random_uuid(), '[COMPANY_ID]', (SELECT id FROM cobra_clients WHERE company_id = '[COMPANY_ID]' LIMIT 1 OFFSET 3), 'FAC-006', 35000, NOW() - INTERVAL '7 days', NOW() + INTERVAL '8 days', 'pending', NULL, NOW());

-- ============================================
-- 6. CREAR TRANSACCIONES BANCARIAS TEST (BANCOCHECK)
-- ============================================
-- Primero crear cuenta bancaria:
INSERT INTO public.bank_accounts (
  id, company_id, bank_name, account_number, account_type,
  is_active, created_at
)
VALUES
  (gen_random_uuid(), '[COMPANY_ID]', 'Banco XYZ', '123456789012345', 'checking', true, NOW())
RETURNING id AS account_id;

-- Después insertar transacciones (reemplazar [ACCOUNT_ID]):
INSERT INTO public.bank_transactions (
  id, company_id, bank_account_id, transaction_date, description,
  amount, reference, balance_after, status, imported_from, import_batch_id, created_at
)
VALUES
  -- Ingresos
  (gen_random_uuid(), '[COMPANY_ID]', '[ACCOUNT_ID]', NOW() - INTERVAL '5 days', 'Depósito de cliente', 50000, 'DEP-001', 500000, 'new', 'csv', gen_random_uuid(), NOW()),
  (gen_random_uuid(), '[COMPANY_ID]', '[ACCOUNT_ID]', NOW() - INTERVAL '3 days', 'Transferencia entrada', 75000, 'TRF-001', 575000, 'new', 'csv', gen_random_uuid(), NOW()),

  -- Egresos
  (gen_random_uuid(), '[COMPANY_ID]', '[ACCOUNT_ID]', NOW() - INTERVAL '4 days', 'Pago proveedores', -100000, 'PAG-001', 475000, 'new', 'csv', gen_random_uuid(), NOW()),
  (gen_random_uuid(), '[COMPANY_ID]', '[ACCOUNT_ID]', NOW() - INTERVAL '2 days', 'Nómina empleados', -120000, 'NOM-001', 355000, 'new', 'csv', gen_random_uuid(), NOW()),
  (gen_random_uuid(), '[COMPANY_ID]', '[ACCOUNT_ID]', NOW() - INTERVAL '1 day', 'Servicios (teléfono, internet)', -15000, 'SRV-001', 340000, 'new', 'csv', gen_random_uuid(), NOW());

-- ============================================
-- 7. VERIFICACIÓN: VER DATOS INSERTADOS
-- ============================================
-- Ejecuta estas queries para verificar que todo se creó:

-- Ver empresas:
-- SELECT id, legal_name, rfc FROM public.companies;

-- Ver clientes:
-- SELECT id, name, rfc, current_balance, risk_score FROM public.cobra_clients WHERE company_id = '[COMPANY_ID]';

-- Ver facturas:
-- SELECT folio, amount, status, days_overdue FROM public.cobra_invoices WHERE company_id = '[COMPANY_ID]';

-- Ver transacciones:
-- SELECT transaction_date, description, amount FROM public.bank_transactions WHERE company_id = '[COMPANY_ID]';

-- ============================================
-- 8. NOTAS IMPORTANTES
-- ============================================
-- - Reemplaza [COMPANY_ID] con el ID de la empresa creada
-- - Reemplaza [USER_ID] con el ID del usuario de Auth
-- - Reemplaza [ACCOUNT_ID] con el ID de la cuenta bancaria
-- - Los usuarios deben crearse primero en Auth (Security → Users)
-- - RLS está habilitado: solo el propietario ve sus datos
-- - Los datos se pueden eliminar con DELETE si necesitas resetear

-- ============================================
-- 9. SCRIPT PARA LIMPIAR (si necesitas resetear)
-- ============================================
-- DELETE FROM public.cobra_invoices WHERE company_id = '[COMPANY_ID]';
-- DELETE FROM public.cobra_clients WHERE company_id = '[COMPANY_ID]';
-- DELETE FROM public.bank_transactions WHERE company_id = '[COMPANY_ID]';
-- DELETE FROM public.bank_accounts WHERE company_id = '[COMPANY_ID]';
-- DELETE FROM public.company_members WHERE company_id = '[COMPANY_ID]';
-- DELETE FROM public.companies WHERE id = '[COMPANY_ID]';
