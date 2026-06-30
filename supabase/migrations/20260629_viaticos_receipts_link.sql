-- Enlace receipts → viajes de viáticos
-- Migración segura: columna nullable, no destructiva

ALTER TABLE receipts ADD COLUMN IF NOT EXISTS viatico_id UUID REFERENCES viaticos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS receipts_viatico_id_idx ON receipts(viatico_id);
