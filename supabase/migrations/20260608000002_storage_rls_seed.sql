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
-- SEED DATA — Ver archivo separado: supabase/seed.sql
-- Ejecutar MANUALMENTE en SQL Editor DESPUÉS de crear los usuarios de prueba
-- ----------------------------------------------------------------------------
-- El seed está en supabase/seed.sql para no bloquear esta migration.
-- Pasos:
--   1. Crea los usuarios en Authentication → Users
--   2. Copia sus UUIDs en supabase/seed.sql
--   3. Ejecuta seed.sql en SQL Editor

-- (seed movido a supabase/seed.sql)
