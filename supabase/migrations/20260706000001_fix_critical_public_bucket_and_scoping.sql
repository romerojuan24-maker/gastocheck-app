-- ============================================================================
-- CRÍTICO: bucket 'event-comprobantes' era público (cualquiera con la URL,
-- SIN autenticación, podía ver recibos/comprobantes de gastos de eventos de
-- cualquier empresa — ruta predecible {companyId}/{eventId}/{timestamp}.jpg).
-- Además, sus políticas de storage.objects solo exigían auth.role()=
-- 'authenticated', sin verificar pertenencia a la empresa — cualquier usuario
-- logueado de CUALQUIER empresa podía leer/subir a la carpeta de otra.
-- ============================================================================

-- 1. Bucket privado (deja de servirse por URL pública sin auth)
UPDATE storage.buckets SET public = false WHERE id = 'event-comprobantes';

-- 2. Reemplazar políticas por las mismas usadas en expense-attachments:
--    escopadas por company_id (primer segmento de la ruta del objeto).
DROP POLICY IF EXISTS "authenticated upload event comprobantes" ON storage.objects;
DROP POLICY IF EXISTS "authenticated read event comprobantes"   ON storage.objects;

CREATE POLICY "members upload event comprobantes"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'event-comprobantes'
  AND auth_is_member((storage.foldername(name))[1]::uuid)
);

CREATE POLICY "members read event comprobantes"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'event-comprobantes'
  AND auth_is_member((storage.foldername(name))[1]::uuid)
);
