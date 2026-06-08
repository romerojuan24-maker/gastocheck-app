-- ============================================================================
-- GastoCheck — Migration 0002: Storage buckets + RLS + Seed data
-- Ejecutar en Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STORAGE BUCKETS
-- ----------------------------------------------------------------------------

-- Bucket para tickets/fotos/PDF/XML de gastos (privado, solo acceso vía RLS)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expense-attachments',
  'expense-attachments',
  false,
  10485760,  -- 10 MB máximo por archivo
  ARRAY['image/jpeg','image/png','image/webp','application/pdf','text/xml','application/xml']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket para reportes Excel/ZIP generados (privado, acceso por signed URL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-exports',
  'report-exports',
  false,
  52428800,  -- 50 MB máximo por archivo
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- STORAGE RLS — expense-attachments
-- Ruta esperada: {company_id}/{expense_id}/{filename}
-- ----------------------------------------------------------------------------

-- Leer: miembro de la empresa puede leer archivos de sus gastos
CREATE POLICY "members read attachments storage"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'expense-attachments'
  AND auth_is_member((storage.foldername(name))[1]::uuid)
);

-- Subir: miembro activo puede subir a su company_id
CREATE POLICY "members upload attachments storage"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'expense-attachments'
  AND auth_is_member((storage.foldername(name))[1]::uuid)
);

-- Eliminar: solo owner/supervisor pueden eliminar archivos
CREATE POLICY "supervisor delete attachments storage"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'expense-attachments'
  AND auth_role((storage.foldername(name))[1]::uuid) IN ('owner','supervisor')
);

-- ----------------------------------------------------------------------------
-- STORAGE RLS — report-exports
-- Ruta esperada: {company_id}/exports/{filename}
-- ----------------------------------------------------------------------------

-- Leer: miembro activo puede descargar exports de su empresa
CREATE POLICY "members read exports storage"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'report-exports'
  AND auth_is_member((storage.foldername(name))[1]::uuid)
);

-- Subir: solo Edge Functions usan service_role para subir exports (no RLS para INSERT)
-- Esto se maneja via service_role en las Edge Functions de export

-- ----------------------------------------------------------------------------
-- CONSTRAINT: UUID de CFDI único por empresa
-- (previene ligar el mismo CFDI a dos gastos distintos)
-- ----------------------------------------------------------------------------
ALTER TABLE cfdi_data
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;

-- Poblamos company_id desde expenses si ya hay datos
UPDATE cfdi_data cd
SET company_id = e.company_id
FROM expenses e
WHERE e.id = cd.expense_id
  AND cd.company_id IS NULL;

-- Índice único: mismo UUID no puede existir dos veces en la misma empresa
CREATE UNIQUE INDEX IF NOT EXISTS cfdi_data_uuid_company_unique
  ON cfdi_data(uuid, company_id)
  WHERE uuid IS NOT NULL AND company_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- TABLA: policy_snapshot (pólizas cerradas — inmutable)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS policy_snapshots (
  id            uuid primary key default gen_random_uuid(),
  policy_id     uuid not null references policies(id) on delete cascade,
  company_id    uuid not null references companies(id) on delete cascade,
  closed_by     uuid references auth.users(id),
  closed_at     timestamptz not null default now(),
  opening_balance    numeric(14,2) not null,
  total_advances     numeric(14,2) not null default 0,
  total_authorized   numeric(14,2) not null default 0,
  total_pending      numeric(14,2) not null default 0,
  closing_balance    numeric(14,2) not null,
  expense_count      int not null default 0,
  created_at    timestamptz not null default now()
);

ALTER TABLE policy_snapshots ENABLE ROW LEVEL SECURITY;

-- Solo lectura para miembros; nadie puede insertar/editar (lo hace close-policy con service_role)
CREATE POLICY "members read snapshots"
  ON policy_snapshots FOR SELECT
  USING (auth_is_member(company_id));

-- ----------------------------------------------------------------------------
-- CAMPO: rejection_reason en expenses
-- ----------------------------------------------------------------------------
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- ----------------------------------------------------------------------------
-- SEED DATA — Empresa y usuarios de prueba
-- INSTRUCCIONES:
--   1. Primero crea los 3 usuarios en Supabase Dashboard → Authentication → Users:
--      a) owner@gastocheck.test   (contraseña: Test1234!)
--      b) super@gastocheck.test   (contraseña: Test1234!)
--      c) spender@gastocheck.test (contraseña: Test1234!)
--   2. Reemplaza los UUIDs de abajo con los IDs reales de esos usuarios
--   3. Ejecuta este bloque
-- ----------------------------------------------------------------------------

-- ⚠️  REEMPLAZA ESTOS UUIDs CON LOS REALES DE TUS USUARIOS DE PRUEBA
DO $$
DECLARE
  v_owner_id    uuid := '00000000-0000-0000-0000-000000000001'; -- REEMPLAZAR
  v_super_id    uuid := '00000000-0000-0000-0000-000000000002'; -- REEMPLAZAR
  v_spender_id  uuid := '00000000-0000-0000-0000-000000000003'; -- REEMPLAZAR
  v_company_id  uuid;
  v_policy_id   uuid;
BEGIN
  -- Empresa de prueba
  INSERT INTO companies (name, rfc, plan, plan_seats, created_by, allow_supervisor_close)
  VALUES ('Constructora Demo SA de CV', 'CDM240101XX1', 'equipo', 10, v_owner_id, true)
  RETURNING id INTO v_company_id;

  -- Perfiles
  INSERT INTO profiles (id, full_name, phone) VALUES
    (v_owner_id,   'Juan Romero (Owner)',    '+5210000000001'),
    (v_super_id,   'Carlos (Supervisor)',    '+5210000000002'),
    (v_spender_id, 'Pedro (Técnico/Gastos)', '+5210000000003')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  -- Membresías
  INSERT INTO company_members (company_id, user_id, role, status) VALUES
    (v_company_id, v_owner_id,   'owner',      'active'),
    (v_company_id, v_super_id,   'supervisor', 'active'),
    (v_company_id, v_spender_id, 'spender',    'active')
  ON CONFLICT (company_id, user_id) DO NOTHING;

  -- Catálogo de categorías de gasto
  INSERT INTO expense_categories (company_id, name) VALUES
    (v_company_id, 'Combustible'),
    (v_company_id, 'Materiales de construcción'),
    (v_company_id, 'Alimentación'),
    (v_company_id, 'Herramientas'),
    (v_company_id, 'Transporte'),
    (v_company_id, 'Servicios'),
    (v_company_id, 'Papelería'),
    (v_company_id, 'Otros');

  -- Centro de costo
  INSERT INTO cost_centers (company_id, name, type, code) VALUES
    (v_company_id, 'Obra Norte - Fase 1', 'obra',     'OBR-N01'),
    (v_company_id, 'Ruta Guadalajara',    'ruta',     'RUT-GDL'),
    (v_company_id, 'Oficina Central',     'proyecto', 'OFI-CEN');

  -- Póliza abierta para el spender
  INSERT INTO policies (company_id, holder_id, name, opening_balance, status, created_by)
  VALUES (v_company_id, v_spender_id, 'Póliza Junio 2026 — Pedro', 2000.00, 'open', v_owner_id)
  RETURNING id INTO v_policy_id;

  -- Anticipo entregado
  INSERT INTO advances (company_id, policy_id, amount, method, reference, date, created_by)
  VALUES (v_company_id, v_policy_id, 5000.00, 'transfer', 'TRF-2026-001', current_date, v_owner_id);

  -- Gastos de ejemplo en diferentes estados
  INSERT INTO expenses (company_id, policy_id, spender_id, provider_name, total, expense_date, status)
  VALUES
    (v_company_id, v_policy_id, v_spender_id, 'Gasolinera Pemex',        850.00, current_date - 3, 'pending_auth'),
    (v_company_id, v_policy_id, v_spender_id, 'Ferretería La Obra',     1240.00, current_date - 2, 'pending_auth'),
    (v_company_id, v_policy_id, v_spender_id, 'Restaurante El Paso',     430.00, current_date - 4, 'authorized'),
    (v_company_id, v_policy_id, v_spender_id, 'AutoZone',               2100.00, current_date - 5, 'authorized'),
    (v_company_id, v_policy_id, v_spender_id, 'OXXO',                     95.00, current_date - 1, 'rejected');

  RAISE NOTICE 'Seed completado. company_id=% policy_id=%', v_company_id, v_policy_id;
END $$;
