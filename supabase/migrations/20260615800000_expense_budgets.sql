-- expense_budgets ya existe en 20260615100000_grant_all_tables.sql
-- Solo agregar IF NOT EXISTS para columnas que puedan faltar
DO $$
BEGIN
  -- Asegurar columna category_id existe (puede no estar si se usó la versión simplificada)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expense_budgets' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE expense_budgets ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES expense_categories(id) ON DELETE CASCADE;
  END IF;
END;
$$;
