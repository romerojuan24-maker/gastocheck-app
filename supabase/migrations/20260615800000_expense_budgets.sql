-- Presupuestos de gastos por categoría
CREATE TABLE expense_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  limit_amount NUMERIC NOT NULL CHECK (limit_amount > 0),
  period TEXT NOT NULL CHECK (period IN ('monthly', 'quarterly', 'annual')),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(company_id, category_id, period)
);

CREATE INDEX expense_budgets_company_id ON expense_budgets(company_id);
CREATE INDEX expense_budgets_category_id ON expense_budgets(category_id);

-- RLS: solo supervisores/admins pueden ver y editar presupuestos
ALTER TABLE expense_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admin/supervisor can manage budgets" ON expense_budgets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.user_id = auth.uid()
      AND company_members.company_id = expense_budgets.company_id
      AND company_members.role IN ('admin', 'supervisor')
    )
  );
