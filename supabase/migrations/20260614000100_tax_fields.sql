-- OTA 12: Campos de impuestos adicionales (IEPS, ISH, retenciones)
-- IEPS: combustibles, bebidas alcohólicas, cigarros, saborizadas
-- ISH: Impuesto al Hospedaje (~3%, impuesto estatal)
-- retencion_iva / retencion_isr: honorarios, arrendamiento, servicios profesionales

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS ieps_amount   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS ish_amount    NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS retencion_iva NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS retencion_isr NUMERIC(12,2);

COMMENT ON COLUMN receipts.ieps_amount   IS 'IEPS (clave 003) — combustibles, alcohol, tabacos, bebidas saborizadas';
COMMENT ON COLUMN receipts.ish_amount    IS 'ISH (Impuesto al Hospedaje) — impuesto estatal ~3%';
COMMENT ON COLUMN receipts.retencion_iva IS 'Retención de IVA (clave 002 en Retenciones) — honorarios, arrendamiento';
COMMENT ON COLUMN receipts.retencion_isr IS 'Retención de ISR (clave 001 en Retenciones) — honorarios, arrendamiento';
