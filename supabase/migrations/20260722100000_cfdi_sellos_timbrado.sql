-- ============================================================================
-- FacturaCheck — guardar sellos digitales, cadena original y QR del timbrado
-- (pedido Juan 2026-07-22). El PAC (Facturama/AFIN) devuelve estos datos al
-- timbrar, pero timbrar-cfdi solo guardaba el UUID y descartaba el resto.
-- Columnas aditivas (seguro re-ejecutar).
-- ============================================================================

ALTER TABLE cfdi_documents
  ADD COLUMN IF NOT EXISTS serie              text,
  ADD COLUMN IF NOT EXISTS folio              text,
  ADD COLUMN IF NOT EXISTS lugar_expedicion   text,
  ADD COLUMN IF NOT EXISTS sello_cfdi         text,
  ADD COLUMN IF NOT EXISTS sello_sat          text,
  ADD COLUMN IF NOT EXISTS no_certificado_sat text,
  ADD COLUMN IF NOT EXISTS no_certificado_emisor text,
  ADD COLUMN IF NOT EXISTS cadena_original    text,
  ADD COLUMN IF NOT EXISTS fecha_timbrado     timestamptz,
  ADD COLUMN IF NOT EXISTS qr_url             text;

NOTIFY pgrst, 'reload schema';
