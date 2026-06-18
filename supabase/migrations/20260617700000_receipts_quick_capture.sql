-- GastoCheck — Migration 0700: Captura rápida (OCR en segundo plano)
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS is_processing boolean NOT NULL DEFAULT false;
NOTIFY pgrst, 'reload schema';
