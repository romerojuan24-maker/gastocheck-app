-- Agrega campos de dirección completa a companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS colonia TEXT,
  ADD COLUMN IF NOT EXISTS estado  TEXT,
  ADD COLUMN IF NOT EXISTS pais    TEXT DEFAULT 'México';
