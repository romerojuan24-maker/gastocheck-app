-- CobraCheck — Implementación COMPLETA (Recepción de cobranzas + comisiones)
-- 2026-07-08

-- ============================================================================
-- 1. COBRANZAS (Recepción de dinero de clientes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cobra_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),

  -- Cliente que paga
  client_id UUID,
  client_name VARCHAR(255) NOT NULL,

  -- Dinero recibido
  amount_received DECIMAL(15, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'cheque', 'card')),
  payment_reference VARCHAR(255),
  received_date DATE NOT NULL,
  received_time TIME,

  -- Vinculación automática
  linked_invoice_id UUID REFERENCES public.invoices(id),
  linked_bank_transaction_id UUID,

  -- Cobrador
  collector_id UUID NOT NULL,
  collector_name VARCHAR(255),

  -- Estado
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'registered', 'deposited', 'reconciled', 'disputed')),

  -- Comisión
  commission_percentage DECIMAL(5, 2),
  commission_amount DECIMAL(15, 2),
  commission_status VARCHAR(50) DEFAULT 'pending' CHECK (commission_status IN ('pending', 'approved', 'paid', 'disputed')),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cobra_collections_company ON public.cobra_collections(company_id);
CREATE INDEX IF NOT EXISTS idx_cobra_collections_collector ON public.cobra_collections(collector_id);
CREATE INDEX IF NOT EXISTS idx_cobra_collections_status ON public.cobra_collections(status);
CREATE INDEX IF NOT EXISTS idx_cobra_collections_date ON public.cobra_collections(received_date);

-- ============================================================================
-- 2. COMISIONES (Pago a cobradores)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cobra_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),

  -- Cobrador
  collector_id UUID NOT NULL REFERENCES auth.users(id),

  -- Período
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL CHECK (period_year >= 2000),

  -- Monto
  total_collections DECIMAL(15, 2),
  commission_rate DECIMAL(5, 2) NOT NULL, -- % (ej: 5.00 = 5%)
  commission_amount DECIMAL(15, 2),

  -- Estado
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP,
  paid_at TIMESTAMP,

  -- Pago (vinculación a banco)
  paid_via_bank_transaction_id UUID,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(company_id, collector_id, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS idx_commissions_company ON public.cobra_commissions(company_id);
CREATE INDEX IF NOT EXISTS idx_commissions_collector ON public.cobra_commissions(collector_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON public.cobra_commissions(status);

-- ============================================================================
-- 3. ROUTES (Rutas de cobranza — quién cobrará qué)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cobra_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),

  -- Ruta
  name VARCHAR(255) NOT NULL,
  collector_id UUID NOT NULL REFERENCES auth.users(id),

  -- Clientes en la ruta
  client_ids UUID[] NOT NULL,

  -- Estado
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'paused')),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routes_company ON public.cobra_routes(company_id);
CREATE INDEX IF NOT EXISTS idx_routes_collector ON public.cobra_routes(collector_id);

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

ALTER TABLE public.cobra_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cobra_collections_access" ON public.cobra_collections;
CREATE POLICY "cobra_collections_access" ON public.cobra_collections FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);

ALTER TABLE public.cobra_commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commissions_access" ON public.cobra_commissions;
CREATE POLICY "commissions_access" ON public.cobra_commissions FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);

ALTER TABLE public.cobra_routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "routes_access" ON public.cobra_routes;
CREATE POLICY "routes_access" ON public.cobra_routes FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_cobra_collections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cobra_collections_updated_at ON public.cobra_collections;
CREATE TRIGGER trigger_cobra_collections_updated_at
BEFORE UPDATE ON public.cobra_collections
FOR EACH ROW
EXECUTE FUNCTION update_cobra_collections_updated_at();

CREATE OR REPLACE FUNCTION update_cobra_commissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cobra_commissions_updated_at ON public.cobra_commissions;
CREATE TRIGGER trigger_cobra_commissions_updated_at
BEFORE UPDATE ON public.cobra_commissions
FOR EACH ROW
EXECUTE FUNCTION update_cobra_commissions_updated_at();

-- ============================================================================
-- 6. GRANTS
-- ============================================================================

GRANT ALL ON public.cobra_collections TO authenticated;
GRANT ALL ON public.cobra_commissions TO authenticated;
GRANT ALL ON public.cobra_routes TO authenticated;
