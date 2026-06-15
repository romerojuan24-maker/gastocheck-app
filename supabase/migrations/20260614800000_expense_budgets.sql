-- Presupuesto mensual por empleado
CREATE TABLE IF NOT EXISTS expense_budgets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  holder_id    uuid REFERENCES auth.users(id),
  period_month date NOT NULL,
  amount       numeric(14,2) NOT NULL CHECK (amount >= 0),
  notes        text,
  created_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS expense_budgets_unique
  ON expense_budgets(company_id, COALESCE(holder_id::text, ''), period_month);

ALTER TABLE expense_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage budgets" ON expense_budgets FOR ALL
  USING  (auth_role(company_id) IN ('owner','admin','superadmin','supervisor'))
  WITH CHECK (auth_role(company_id) IN ('owner','admin','superadmin','supervisor'));

CREATE POLICY "member read own budget" ON expense_budgets FOR SELECT
  USING (holder_id = auth.uid() OR auth_is_member(company_id));
