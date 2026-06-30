-- OTA 92 — Columnas faltantes que rompen clasificación contable y cierre de pólizas
-- Ejecutar en Supabase Dashboard > SQL Editor

-- 1. receipts: clasificación contable (polizas.tsx las usa pero no existen)
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS accounting_account_id   UUID REFERENCES accounting_accounts(id),
  ADD COLUMN IF NOT EXISTS accounting_account_code TEXT;

-- 2. reembolsos: nombre del reembolso (viáticos lo inserta) y vínculo a póliza
ALTER TABLE reembolsos
  ADD COLUMN IF NOT EXISTS name             TEXT,
  ADD COLUMN IF NOT EXISTS linked_policy_id UUID REFERENCES policies(id);

-- Verificación rápida
SELECT column_name FROM information_schema.columns
WHERE table_name = 'receipts'
  AND column_name IN ('accounting_account_id', 'accounting_account_code')
UNION ALL
SELECT column_name FROM information_schema.columns
WHERE table_name = 'reembolsos'
  AND column_name IN ('name', 'linked_policy_id');
