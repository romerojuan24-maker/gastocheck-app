-- GastoCheck seed data
-- 1. Crea 3 usuarios en Dashboard → Authentication → Users:
--    owner@gastocheck.test / super@gastocheck.test / spender@gastocheck.test (pass: Test1234!)
-- 2. Reemplaza los 3 UUIDs abajo con los reales
-- 3. Ejecuta en SQL Editor

DO $$
DECLARE
  v_owner_id    uuid := 'a2c3d805-47ee-4936-8559-3e68e62d58de';
  v_super_id    uuid := '47483796-3b3f-4eca-adcf-fd8e25a9a1ec';
  v_spender_id  uuid := '80e4c231-b8fa-4521-8819-3cb610b96849';
  v_company_id  uuid;
  v_policy_id   uuid;
BEGIN
  INSERT INTO companies (name, rfc, plan, plan_seats, created_by, allow_supervisor_close)
  VALUES ('Constructora Demo SA de CV', 'CDM240101XX1', 'equipo', 10, v_owner_id, true)
  RETURNING id INTO v_company_id;

  INSERT INTO profiles (id, full_name, phone) VALUES
    (v_owner_id,   'Juan Romero (Owner)',    '+521XXXXXXXXXX'),
    (v_super_id,   'Carlos (Supervisor)',    '+521XXXXXXXXXX'),
    (v_spender_id, 'Pedro (Tecnico/Gastos)', '+521XXXXXXXXXX')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO company_members (company_id, user_id, role, status) VALUES
    (v_company_id, v_owner_id,   'owner',      'active'),
    (v_company_id, v_super_id,   'supervisor', 'active'),
    (v_company_id, v_spender_id, 'spender',    'active')
  ON CONFLICT (company_id, user_id) DO NOTHING;

  INSERT INTO expense_categories (company_id, name) VALUES
    (v_company_id, 'Combustible'), (v_company_id, 'Materiales'),
    (v_company_id, 'Alimentacion'), (v_company_id, 'Herramientas'),
    (v_company_id, 'Transporte'), (v_company_id, 'Servicios'),
    (v_company_id, 'Papeleria'), (v_company_id, 'Otros');

  INSERT INTO cost_centers (company_id, name, type, code) VALUES
    (v_company_id, 'Obra Norte - Fase 1', 'obra',     'OBR-N01'),
    (v_company_id, 'Ruta Guadalajara',    'ruta',     'RUT-GDL'),
    (v_company_id, 'Oficina Central',     'proyecto', 'OFI-CEN');

  INSERT INTO policies (company_id, holder_id, name, opening_balance, status, created_by)
  VALUES (v_company_id, v_spender_id, 'Poliza Junio 2026 Pedro', 2000.00, 'open', v_owner_id)
  RETURNING id INTO v_policy_id;

  INSERT INTO advances (company_id, policy_id, amount, method, reference, date, created_by)
  VALUES (v_company_id, v_policy_id, 5000.00, 'transfer', 'TRF-2026-001', current_date, v_owner_id);

  INSERT INTO expenses (company_id, policy_id, spender_id, provider_name, total, expense_date, status) VALUES
    (v_company_id, v_policy_id, v_spender_id, 'Gasolinera Pemex',    850.00, current_date-3, 'pending_auth'),
    (v_company_id, v_policy_id, v_spender_id, 'Ferreteria La Obra', 1240.00, current_date-2, 'pending_auth'),
    (v_company_id, v_policy_id, v_spender_id, 'Restaurante El Paso', 430.00, current_date-4, 'authorized'),
    (v_company_id, v_policy_id, v_spender_id, 'AutoZone',           2100.00, current_date-5, 'authorized'),
    (v_company_id, v_policy_id, v_spender_id, 'OXXO',                 95.00, current_date-1, 'rejected');

  RAISE NOTICE 'Seed OK. company=% policy=%', v_company_id, v_policy_id;
END $$;
