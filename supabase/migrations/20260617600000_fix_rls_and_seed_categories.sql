-- ============================================================================
-- GastoCheck — Migration 0600: Corregir RLS catálogos + sembrar categorías
-- ============================================================================

-- ── 1. accounting_accounts: agregar rol 'admin' a gestión ─────────────────
DROP POLICY IF EXISTS "manage accounts" ON accounting_accounts;
CREATE POLICY "manage accounts" ON accounting_accounts FOR ALL
  USING  (auth_role(company_id) IN ('owner', 'accountant', 'admin'))
  WITH CHECK (auth_role(company_id) IN ('owner', 'accountant', 'admin'));

-- ── 2. expense_categories: agregar roles 'admin' y 'accountant' ───────────
DROP POLICY IF EXISTS "manage categories" ON expense_categories;
CREATE POLICY "manage categories" ON expense_categories FOR ALL
  USING  (auth_role(company_id) IN ('owner', 'supervisor', 'admin', 'accountant'))
  WITH CHECK (auth_role(company_id) IN ('owner', 'supervisor', 'admin', 'accountant'));

-- ── 3. Sembrar categorías universales en empresas sin categorías ──────────
INSERT INTO expense_categories (company_id, name, description, display_order, active)
SELECT
  cm.company_id,
  t.name,
  t.description,
  t.display_order,
  true
FROM (
  SELECT DISTINCT company_id
  FROM company_members
  WHERE status = 'active'
) cm
CROSS JOIN (
  SELECT name, description, display_order
  FROM expense_category_templates
  WHERE sector = 'universal'
) t
WHERE NOT EXISTS (
  SELECT 1 FROM expense_categories ec
  WHERE ec.company_id = cm.company_id
)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
