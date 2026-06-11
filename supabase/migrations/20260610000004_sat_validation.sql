-- Agregar columnas de validación SAT a receipts
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS sat_validation_status text;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS sat_validation_reason text;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS sat_validation_at timestamptz;

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS receipts_sat_status_idx ON receipts(sat_validation_status);
