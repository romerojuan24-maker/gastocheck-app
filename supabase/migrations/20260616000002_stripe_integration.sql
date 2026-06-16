-- Stripe integration tables + billing_plans con Price IDs reales

-- Tabla stripe_customers: company → stripe_customer_id
CREATE TABLE IF NOT EXISTS stripe_customers (
  company_id         UUID        PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  stripe_customer_id TEXT        NOT NULL UNIQUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stripe_customers_member_read" ON stripe_customers;
CREATE POLICY "stripe_customers_member_read" ON stripe_customers FOR SELECT
  USING (auth_is_member(company_id));

-- Plan codes simples para la app (basico/profesional/empresarial)
INSERT INTO billing_plans
  (plan_code, stripe_price_id, name, billing_interval, monthly_price,
   max_users, max_receipts_per_month, max_companies, sat_validation_enabled,
   collections_enabled, fleet_vertical_enabled)
VALUES
  ('basico',      'price_1Tj1zzL2neyywaFYirjaQbQ0', 'Básico',      'month',  299, 3,  100,  1, FALSE, FALSE, FALSE),
  ('profesional', 'price_1Tj21yL2neyywaFYbhdUtrZm', 'Profesional', 'month',  699, 10, 500,  1, TRUE,  TRUE,  FALSE),
  ('empresarial', 'price_1Tj26cL2neyywaFYT6KJGCCh', 'Empresarial', 'month', 1499, 30, 2000, 3, TRUE,  TRUE,  TRUE)
ON CONFLICT (plan_code) DO UPDATE
  SET stripe_price_id = EXCLUDED.stripe_price_id,
      name            = EXCLUDED.name;

-- Recargar schema cache de PostgREST
NOTIFY pgrst, 'reload schema';
