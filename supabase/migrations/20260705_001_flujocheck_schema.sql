-- ============================================================================
-- FLUJOCHECK SCHEMA MIGRATION
-- Created: 2026-07-05
-- Purpose: 14 tables para FlujoCheck (cash flow + credit + projection + transfers)
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. CASH_FLOW_PERIODS — Período de flujo (semanal)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cash_flow_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,

  period_start DATE NOT NULL,        -- Lunes de la semana
  period_end DATE NOT NULL,          -- Domingo de la semana

  balance_start DECIMAL(15,2) NOT NULL DEFAULT 0,
  balance_projected DECIMAL(15,2) NOT NULL DEFAULT 0,
  balance_actual DECIMAL(15,2),      -- Se actualiza al cierre

  risk_level TEXT CHECK (risk_level IN ('green', 'yellow', 'red')),
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(company_id, period_start)
);

CREATE INDEX idx_cash_flow_periods_company_date
  ON cash_flow_periods(company_id, period_start DESC);


-- ──────────────────────────────────────────────────────────────────────────
-- 2. PAYABLES — Deudas/Pasivos
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES cash_flow_periods(id) ON DELETE CASCADE,

  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status TEXT CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')) DEFAULT 'pending',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payables_company_status ON payables(company_id, status);
CREATE INDEX idx_payables_due_date ON payables(company_id, due_date);


-- ──────────────────────────────────────────────────────────────────────────
-- 3. RECEIVABLES — Ingresos/Activos (cobros)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES cash_flow_periods(id) ON DELETE CASCADE,

  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  expected_date DATE NOT NULL,
  received_date DATE,
  status TEXT CHECK (status IN ('pending', 'received', 'overdue', 'cancelled')) DEFAULT 'pending',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_receivables_company_status ON receivables(company_id, status);
CREATE INDEX idx_receivables_expected_date ON receivables(company_id, expected_date);


-- ──────────────────────────────────────────────────────────────────────────
-- 4. CREDITS — Créditos/Financiamientos
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,

  name TEXT NOT NULL,                 -- "Crédito Azteca", "BBVA Línea A", etc.
  principal DECIMAL(15,2) NOT NULL,   -- Monto original
  current_balance DECIMAL(15,2) NOT NULL,

  interest_rate DECIMAL(5,4) NOT NULL, -- Tasa anual (ej: 0.1250 = 12.50%)
  amortization_type TEXT CHECK (amortization_type IN
    ('fixed_payment', 'amortized_balance', 'last_payment_balloon', 'interest_only'))
    DEFAULT 'fixed_payment',

  start_date DATE NOT NULL,
  end_date DATE,                      -- Vencimiento (null si indefinido)

  monthly_payment DECIMAL(15,2),      -- Cuota fija o promedio
  payments_remaining INT,             -- Cuotas pendientes

  terms_document_url TEXT,            -- URL a documento con términos
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_credits_company ON credits(company_id);


-- ──────────────────────────────────────────────────────────────────────────
-- 5. CREDIT_AMORTIZATION_RULES — Reglas de comportamiento de crédito
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS credit_amortization_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id UUID NOT NULL REFERENCES credits(id) ON DELETE CASCADE,

  rule_type TEXT CHECK (rule_type IN
    ('early_payment_allowed', 'early_payment_penalty', 'extra_payments_apply_to_principal', 'extra_payments_apply_to_last_payment'))
    DEFAULT 'early_payment_allowed',

  rule_value DECIMAL(15,2),           -- Monto o porcentaje
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);


-- ──────────────────────────────────────────────────────────────────────────
-- 6. PAYMENT_SCHEDULE — Plan de pagos (por crédito)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id UUID NOT NULL REFERENCES credits(id) ON DELETE CASCADE,

  payment_number INT NOT NULL,        -- Cuota 1, 2, 3...
  due_date DATE NOT NULL,

  principal_payment DECIMAL(15,2) NOT NULL,
  interest_payment DECIMAL(15,2) NOT NULL,
  total_payment DECIMAL(15,2) NOT NULL,

  balance_after DECIMAL(15,2) NOT NULL,

  status TEXT CHECK (status IN ('scheduled', 'paid', 'overdue', 'missed')) DEFAULT 'scheduled',
  paid_date DATE,
  paid_amount DECIMAL(15,2),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payment_schedule_credit ON payment_schedule(credit_id, due_date);


-- ──────────────────────────────────────────────────────────────────────────
-- 7. WEEKLY_PAYMENT_PLAN — Qué pagar cada día de la semana
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS weekly_payment_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES cash_flow_periods(id) ON DELETE CASCADE,

  day_of_week INT CHECK (day_of_week >= 0 AND day_of_week <= 6),  -- 0=Mon, 6=Sun
  payment_items JSONB NOT NULL,  -- Array: {type: 'credit' | 'payable', id: UUID, amount, description}
  total_amount DECIMAL(15,2) NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ──────────────────────────────────────────────────────────────────────────
-- 8. BANK_ACCOUNTS_MULTI — Múltiples cuentas bancarias
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bank_accounts_multi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,

  name TEXT NOT NULL,                 -- "Cuenta Operativa", "Fondo Reserva", etc.
  bank_name TEXT,                     -- BBVA, Santander, etc.
  account_number TEXT,

  purpose TEXT CHECK (purpose IN ('operational', 'reserve', 'payroll', 'investment')),

  balance_current DECIMAL(15,2) NOT NULL DEFAULT 0,
  min_buffer DECIMAL(15,2) DEFAULT 0,  -- Buffer mínimo recomendado

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bank_accounts_multi_company ON bank_accounts_multi(company_id);


-- ──────────────────────────────────────────────────────────────────────────
-- 9. MULTI_ACCOUNT_RECOMMENDATIONS — Recomendaciones de transferencias
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS multi_account_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES cash_flow_periods(id) ON DELETE CASCADE,

  from_account_id UUID NOT NULL REFERENCES bank_accounts_multi(id),
  to_account_id UUID NOT NULL REFERENCES bank_accounts_multi(id),

  recommended_amount DECIMAL(15,2) NOT NULL,
  reason TEXT,  -- "Mantener buffer", "Preparar nómina", "Invertir excedentes", etc.

  priority INT DEFAULT 0,  -- 0=lowest, 100=highest
  action_status TEXT CHECK (action_status IN ('pending', 'executed', 'dismissed')) DEFAULT 'pending',
  executed_date DATE,

  created_at TIMESTAMPTZ DEFAULT now()
);


-- ──────────────────────────────────────────────────────────────────────────
-- 10. RECURRING_PAYMENTS — Pagos automáticos (impuestos, servicios, etc.)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recurring_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,

  name TEXT NOT NULL,                 -- "ISR mensual", "Servicio telefonía", etc.
  amount DECIMAL(15,2) NOT NULL,

  frequency TEXT CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'annual')),
  next_due_date DATE NOT NULL,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ──────────────────────────────────────────────────────────────────────────
-- 11. PAYMENT_COLLECTION_CONFIDENCE — Confianza de cobro (IA/ML scoring)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_collection_confidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_id UUID NOT NULL REFERENCES receivables(id) ON DELETE CASCADE,

  confidence_score INT CHECK (confidence_score >= 0 AND confidence_score <= 100),  -- 0-100
  confidence_level TEXT CHECK (confidence_level IN ('green', 'yellow', 'red')),

  reasoning TEXT,  -- Por qué el score (ej: "Cliente con 100% puntualidad histórica")

  created_at TIMESTAMPTZ DEFAULT now()
);


-- ──────────────────────────────────────────────────────────────────────────
-- 12. CASH_FLOW_TRANSACTIONS — Historial de transacciones
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cash_flow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES cash_flow_periods(id),

  transaction_date DATE NOT NULL,
  transaction_type TEXT CHECK (transaction_type IN ('payable', 'receivable', 'transfer', 'adjustment')),

  reference_id UUID,  -- Referencia a payable_id, receivable_id, etc.
  description TEXT NOT NULL,

  amount DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2),

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cash_flow_transactions_period ON cash_flow_transactions(company_id, period_id);


-- ──────────────────────────────────────────────────────────────────────────
-- 13. ANNUAL_PROJECTION — Proyección anual (12 meses)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS annual_projection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,

  projection_month INT CHECK (projection_month >= 1 AND projection_month <= 12),  -- 1-12
  projection_year INT,

  projected_income DECIMAL(15,2),
  projected_expenses DECIMAL(15,2),
  projected_net_cash DECIMAL(15,2),

  health_status TEXT CHECK (health_status IN ('green', 'yellow', 'red')),  -- Tendencia
  health_score DECIMAL(5,2),  -- 0-100

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_annual_projection_company ON annual_projection(company_id, projection_year, projection_month);


-- ──────────────────────────────────────────────────────────────────────────
-- 14. ECONOMIC_INDICATORS — Indicadores económicos (TIIE, UDI, inflación)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS economic_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  indicator_name TEXT NOT NULL,  -- "TIIE 28", "UDI", "Inflación"
  indicator_date DATE NOT NULL,
  indicator_value DECIMAL(10,6) NOT NULL,

  source TEXT,  -- "Banxico", "INEGI", etc.

  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(indicator_name, indicator_date)
);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Cash Flow Periods
ALTER TABLE cash_flow_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_flow_periods_company_access"
  ON cash_flow_periods FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
  );

-- Payables
ALTER TABLE payables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payables_company_access"
  ON payables FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
  );

-- Receivables
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receivables_company_access"
  ON receivables FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
  );

-- Credits
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credits_company_access"
  ON credits FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
  );

-- Credit Amortization Rules (via credit)
ALTER TABLE credit_amortization_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_amortization_rules_access"
  ON credit_amortization_rules FOR ALL USING (
    credit_id IN (SELECT id FROM credits WHERE company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active'))
  );

-- Payment Schedule (via credit)
ALTER TABLE payment_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_schedule_access"
  ON payment_schedule FOR ALL USING (
    credit_id IN (SELECT id FROM credits WHERE company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active'))
  );

-- Weekly Payment Plan
ALTER TABLE weekly_payment_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weekly_payment_plan_access"
  ON weekly_payment_plan FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
  );

-- Bank Accounts Multi
ALTER TABLE bank_accounts_multi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_accounts_multi_access"
  ON bank_accounts_multi FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
  );

-- Multi Account Recommendations
ALTER TABLE multi_account_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "multi_account_recommendations_access"
  ON multi_account_recommendations FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
  );

-- Recurring Payments
ALTER TABLE recurring_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recurring_payments_access"
  ON recurring_payments FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
  );

-- Payment Collection Confidence (via receivables)
ALTER TABLE payment_collection_confidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_collection_confidence_access"
  ON payment_collection_confidence FOR ALL USING (
    receivable_id IN (SELECT id FROM receivables WHERE company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active'))
  );

-- Cash Flow Transactions
ALTER TABLE cash_flow_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_flow_transactions_access"
  ON cash_flow_transactions FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
  );

-- Annual Projection
ALTER TABLE annual_projection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "annual_projection_access"
  ON annual_projection FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
  );

-- Economic Indicators (public read)
ALTER TABLE economic_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "economic_indicators_public_read"
  ON economic_indicators FOR SELECT USING (true);

-- ============================================================================
-- END MIGRATION
-- ============================================================================
