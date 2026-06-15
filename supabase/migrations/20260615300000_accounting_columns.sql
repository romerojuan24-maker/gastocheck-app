-- Catálogo de cuentas contables + asignación en expenses
-- Permite: importar catálogo, asignar cuenta por gasto, exportar con cuentas reales.

-- ── accounting_accounts: jerarquía ───────────────────────────────────────────
ALTER TABLE accounting_accounts
  ADD COLUMN IF NOT EXISTS level       integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_code text;

-- ── expenses: cuenta contable asignada por supervisor ────────────────────────
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS accounting_account_id   uuid REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accounting_account_code text;  -- desnormalizado para export rápido

CREATE INDEX IF NOT EXISTS idx_expenses_account ON expenses(accounting_account_id) WHERE accounting_account_id IS NOT NULL;

-- GRANTs (por si accounting_accounts no tenía grant previo)
DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON accounting_accounts TO authenticated;
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN undefined_table THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
