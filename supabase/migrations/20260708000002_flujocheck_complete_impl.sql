-- FlujoCheck — Implementación COMPLETA (Flujo de caja + proyecciones)
-- 2026-07-08

-- ============================================================================
-- 1. CASH FLOW ITEMS (Transacciones proyectadas)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.flujo_cash_flow_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),

  -- Transacción
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('inflow', 'outflow')),
  category VARCHAR(100) NOT NULL, -- 'cobranza', 'gasto', 'nómina', 'impuesto', 'préstamo', 'inversión'
  description TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,

  -- Fecha
  projected_date DATE NOT NULL,
  actual_date DATE,

  -- Fuente
  source_type VARCHAR(50), -- 'invoice', 'bank_transaction', 'collection', 'payroll', 'other'
  source_id UUID,

  -- Estado
  status VARCHAR(50) DEFAULT 'projected' CHECK (status IN ('projected', 'confirmed', 'executed', 'cancelled')),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flujo_items_company ON public.flujo_cash_flow_items(company_id);
CREATE INDEX IF NOT EXISTS idx_flujo_items_date ON public.flujo_cash_flow_items(projected_date);
CREATE INDEX IF NOT EXISTS idx_flujo_items_status ON public.flujo_cash_flow_items(status);

-- ============================================================================
-- 2. ESCENARIOS DE FLUJO (Proyecciones: pesimista, realista, optimista)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.flujo_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),

  -- Escenario
  name VARCHAR(100) NOT NULL, -- 'pesimista', 'realista', 'optimista'
  description TEXT,

  -- Parámetros de ajuste
  collection_delay_days INTEGER DEFAULT 0, -- cuántos días demoran en cobrar
  payment_delay_days INTEGER DEFAULT 0,  -- cuántos días demoran en pagar

  -- Período
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Resultado
  opening_balance DECIMAL(15, 2),
  projected_inflow DECIMAL(15, 2),
  projected_outflow DECIMAL(15, 2),
  projected_ending_balance DECIMAL(15, 2),

  -- Alertas
  will_have_shortage BOOLEAN DEFAULT FALSE,
  shortage_days INTEGER,
  shortage_amount DECIMAL(15, 2),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scenarios_company ON public.flujo_scenarios(company_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_dates ON public.flujo_scenarios(start_date, end_date);

-- ============================================================================
-- 3. CASH RESERVES (Recomendaciones de reserva)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.flujo_cash_reserves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),

  -- Recomendación basada en promedio
  average_daily_outflow DECIMAL(15, 2),
  recommended_reserve_days INTEGER DEFAULT 30, -- días de cobertura
  recommended_amount DECIMAL(15, 2),

  -- Estado actual
  current_balance DECIMAL(15, 2),
  balance_vs_recommended DECIMAL(15, 2), -- positivo = exceso, negativo = falta

  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reserves_company ON public.flujo_cash_reserves(company_id);

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

ALTER TABLE public.flujo_cash_flow_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "flujo_items_access" ON public.flujo_cash_flow_items;
CREATE POLICY "flujo_items_access" ON public.flujo_cash_flow_items FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);

ALTER TABLE public.flujo_scenarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scenarios_access" ON public.flujo_scenarios;
CREATE POLICY "scenarios_access" ON public.flujo_scenarios FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);

ALTER TABLE public.flujo_cash_reserves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reserves_access" ON public.flujo_cash_reserves;
CREATE POLICY "reserves_access" ON public.flujo_cash_reserves FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);

-- ============================================================================
-- 5. GRANTS
-- ============================================================================

GRANT ALL ON public.flujo_cash_flow_items TO authenticated;
GRANT ALL ON public.flujo_scenarios TO authenticated;
GRANT ALL ON public.flujo_cash_reserves TO authenticated;
