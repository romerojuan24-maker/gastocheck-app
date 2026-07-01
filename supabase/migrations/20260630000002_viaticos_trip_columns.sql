-- ============================================================================
-- FIX VIATICOS — Agregar columnas de viaje (trip-based model)
-- La tabla viaticos fue creada con modelo simple (amount+category).
-- El código mobile usa destination, departure_date, etc. → Agregar columnas.
-- ============================================================================

-- 1. Columnas de viaje
ALTER TABLE viaticos
  ADD COLUMN IF NOT EXISTS destination    TEXT,
  ADD COLUMN IF NOT EXISTS purpose        TEXT,
  ADD COLUMN IF NOT EXISTS departure_date DATE,
  ADD COLUMN IF NOT EXISTS return_date    DATE,
  ADD COLUMN IF NOT EXISTS advance_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_spent    NUMERIC(12,2) DEFAULT 0;

-- 2. Fix status constraint — incluir ciclo de vida completo del viaje
ALTER TABLE viaticos DROP CONSTRAINT IF EXISTS viaticos_status_valid;
ALTER TABLE viaticos ADD CONSTRAINT viaticos_status_valid
  CHECK (status IN ('draft', 'submitted', 'pending', 'approved', 'rejected', 'closed'));

ALTER TABLE viaticos ALTER COLUMN status SET DEFAULT 'draft';

-- 3. Receipts → viáticos link (idempotente)
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS viatico_id UUID REFERENCES viaticos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_receipts_viatico_id ON receipts(viatico_id);

-- Verificación
SELECT column_name FROM information_schema.columns
WHERE table_name = 'viaticos'
  AND column_name IN ('destination', 'departure_date', 'return_date', 'advance_amount');
