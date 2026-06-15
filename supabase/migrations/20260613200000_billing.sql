-- ============================================================================
-- GastoCheck — Billing (Stripe)
-- Tablas: billing_plans, subscriptions
-- Helpers: get_company_subscription, company_has_access
-- ============================================================================

-- ----------------------------------------------------------------------------
-- BILLING PLANS
-- stripe_price_id: completar desde Stripe Dashboard antes de activar cobros
-- ----------------------------------------------------------------------------
CREATE TABLE billing_plans (
  plan_code               TEXT        PRIMARY KEY,
  stripe_price_id         TEXT        NOT NULL DEFAULT '',
  name                    TEXT        NOT NULL,
  billing_interval        TEXT        NOT NULL CHECK (billing_interval IN ('month','year')),
  monthly_price           NUMERIC(10,2),
  annual_price            NUMERIC(10,2),
  max_users               INTEGER     NOT NULL DEFAULT 3,
  max_receipts_per_month  INTEGER     NOT NULL DEFAULT 100,
  max_companies           INTEGER     NOT NULL DEFAULT 1,
  sat_validation_enabled  BOOLEAN     NOT NULL DEFAULT FALSE,
  collections_enabled     BOOLEAN     NOT NULL DEFAULT FALSE,
  fleet_vertical_enabled  BOOLEAN     NOT NULL DEFAULT FALSE,
  status                  TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO billing_plans
  (plan_code, name, billing_interval, monthly_price, annual_price,
   max_users, max_receipts_per_month, max_companies,
   sat_validation_enabled, collections_enabled, fleet_vertical_enabled)
VALUES
  ('GC_STARTER_M',    'Starter Mensual',   'month',  299,   NULL, 3,  100,  1, FALSE, FALSE, FALSE),
  ('GC_STARTER_A',    'Starter Anual',     'year',   NULL,  2990, 3,  100,  1, FALSE, FALSE, FALSE),
  ('GC_PRO_M',        'Pro Mensual',       'month',  699,   NULL, 10, 500,  1, TRUE,  TRUE,  FALSE),
  ('GC_PRO_A',        'Pro Anual',         'year',   NULL,  6990, 10, 500,  1, TRUE,  TRUE,  FALSE),
  ('GC_BUSINESS_M',   'Business Mensual',  'month', 1499,   NULL, 30, 2000, 3, TRUE,  TRUE,  TRUE),
  ('GC_BUSINESS_A',   'Business Anual',    'year',   NULL, 14990, 30, 2000, 3, TRUE,  TRUE,  TRUE),
  ('GC_ENTERPRISE_M', 'Enterprise Mensual','month', 2999,   NULL, -1, -1,  -1, TRUE,  TRUE,  TRUE),
  ('GC_ENTERPRISE_A', 'Enterprise Anual',  'year',   NULL, 29990, -1, -1,  -1, TRUE,  TRUE,  TRUE);

-- ----------------------------------------------------------------------------
-- SUBSCRIPTIONS
-- ----------------------------------------------------------------------------
CREATE TABLE subscriptions (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_code              TEXT        NOT NULL REFERENCES billing_plans(plan_code),
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT        UNIQUE,
  status                 TEXT        NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing','active','past_due','canceled','incomplete','paused')),
  trial_start            TIMESTAMPTZ,
  trial_end              TIMESTAMPTZ,
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subs_company  ON subscriptions(company_id);
CREATE INDEX idx_subs_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subs_status   ON subscriptions(status);

-- auto-touch updated_at
CREATE OR REPLACE FUNCTION touch_subscriptions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_subs_updated
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION touch_subscriptions_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
ALTER TABLE billing_plans  ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions  ENABLE ROW LEVEL SECURITY;

-- Planes: lectura pública (son info de marketing)
CREATE POLICY "billing_plans_public_read"
  ON billing_plans FOR SELECT USING (TRUE);

-- Suscripciones: solo miembros de la empresa leen la suya
CREATE POLICY "subscriptions_member_read"
  ON subscriptions FOR SELECT
  USING (auth_is_member(company_id));

-- Solo service role escribe (webhooks)
-- No policy for INSERT/UPDATE/DELETE from client

-- ----------------------------------------------------------------------------
-- HELPER: suscripción activa de una empresa
-- Devuelve la fila más reciente en estado facturable (trialing/active/past_due)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_company_subscription(p_company_id UUID)
RETURNS TABLE (
  plan_code               TEXT,
  status                  TEXT,
  trial_end               TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN,
  max_users               INTEGER,
  max_receipts_per_month  INTEGER,
  max_companies           INTEGER,
  sat_validation_enabled  BOOLEAN,
  collections_enabled     BOOLEAN,
  fleet_vertical_enabled  BOOLEAN
)
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT
    s.plan_code,
    s.status,
    s.trial_end,
    s.current_period_end,
    s.cancel_at_period_end,
    bp.max_users,
    bp.max_receipts_per_month,
    bp.max_companies,
    bp.sat_validation_enabled,
    bp.collections_enabled,
    bp.fleet_vertical_enabled
  FROM subscriptions s
  JOIN billing_plans bp ON bp.plan_code = s.plan_code
  WHERE s.company_id = p_company_id
    AND s.status IN ('trialing','active','past_due')
  ORDER BY s.created_at DESC
  LIMIT 1;
$$;

-- ----------------------------------------------------------------------------
-- HELPER: ¿la empresa tiene acceso premium?
-- Usado en RLS de funciones que requieren plan pagado
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION company_has_active_subscription(p_company_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM subscriptions
    WHERE company_id = p_company_id
      AND status IN ('trialing','active')
  );
$$;

-- Conveniente alias para usar en RLS
CREATE OR REPLACE FUNCTION company_is_past_due(p_company_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM subscriptions
    WHERE company_id = p_company_id
      AND status = 'past_due'
  );
$$;
