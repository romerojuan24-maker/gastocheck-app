-- InventarioCheck — Implementación COMPLETA (Movimientos de almacén + costos)
-- 2026-07-08

-- ============================================================================
-- 1. INVENTORY PRODUCTS (Catálogo expandido)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inv_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),

  -- Producto
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(50) UNIQUE,
  barcode VARCHAR(100),
  category VARCHAR(100),
  description TEXT,

  -- Unidades
  unit VARCHAR(20) NOT NULL, -- 'pz', 'kg', 'l', 'metros', etc.

  -- Costos (PEPS - últimas entradas)
  cost_peps DECIMAL(15, 4),
  cost_average DECIMAL(15, 4),
  cost_fifo DECIMAL(15, 4),

  -- Precios
  price_sale DECIMAL(15, 2),
  price_distributor DECIMAL(15, 2),

  -- Stock
  stock_current INTEGER NOT NULL DEFAULT 0,
  stock_minimum INTEGER DEFAULT 0,
  stock_maximum INTEGER DEFAULT 1000,

  -- Estado
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_products_company ON public.inv_products(company_id);
CREATE INDEX IF NOT EXISTS idx_inv_products_sku ON public.inv_products(sku);
CREATE INDEX IF NOT EXISTS idx_inv_products_barcode ON public.inv_products(barcode);

-- ============================================================================
-- 2. INVENTORY MOVEMENTS (Entrada/Salida/Ajuste)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inv_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  product_id UUID NOT NULL REFERENCES public.inv_products(id),

  -- Tipo de movimiento
  movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('entrada', 'salida', 'ajuste', 'devolucion')),
  reason VARCHAR(100), -- 'compra', 'venta', 'robo', 'pérdida', 'daño', 'inventario'

  -- Cantidades
  quantity INTEGER NOT NULL,
  unit_cost DECIMAL(15, 4),
  total_cost DECIMAL(15, 2),

  -- Origen/Destino
  source_type VARCHAR(50), -- 'proveedor', 'cliente', 'otro', 'merma'
  source_id UUID,

  -- Documentación
  reference_doc VARCHAR(255), -- número de OC, OT, factura
  linked_transaction_id UUID, -- a bank_transaction, si aplica

  -- Usuario que registra
  registered_by UUID NOT NULL REFERENCES auth.users(id),
  registered_at TIMESTAMP DEFAULT NOW(),

  -- Autorización
  authorized_by UUID REFERENCES auth.users(id),
  authorized_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_movements_company ON public.inv_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_product ON public.inv_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_type ON public.inv_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inv_movements_date ON public.inv_movements(registered_at);

-- ============================================================================
-- 3. INVENTORY ALERTS (Stock bajo, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inv_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  product_id UUID NOT NULL REFERENCES public.inv_products(id),

  -- Alerta
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('stock_bajo', 'stock_negativo', 'diferencia_inventario')),
  severity VARCHAR(50) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),

  -- Datos
  current_stock INTEGER,
  minimum_stock INTEGER,
  shortage_amount INTEGER,

  -- Estado
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_alerts_company ON public.inv_alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_inv_alerts_product ON public.inv_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_alerts_severity ON public.inv_alerts(severity);

-- ============================================================================
-- 4. INVENTORY VALUATIONS (Cierre de período)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inv_valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),

  -- Período
  valuation_month INTEGER NOT NULL CHECK (valuation_month BETWEEN 1 AND 12),
  valuation_year INTEGER NOT NULL CHECK (valuation_year >= 2000),

  -- Método de cálculo
  costing_method VARCHAR(50) NOT NULL CHECK (costing_method IN ('PEPS', 'UEPS', 'Promedio')),

  -- Valores
  total_quantity INTEGER,
  total_inventory_value DECIMAL(15, 2),
  cost_of_goods_sold DECIMAL(15, 2),

  -- Para contabilidad
  suggested_account_code VARCHAR(10), -- 1300 (Inventario)

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(company_id, valuation_month, valuation_year, costing_method)
);

CREATE INDEX IF NOT EXISTS idx_valuations_company ON public.inv_valuations(company_id);
CREATE INDEX IF NOT EXISTS idx_valuations_period ON public.inv_valuations(valuation_year, valuation_month);

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================

ALTER TABLE public.inv_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inv_products_access" ON public.inv_products;
CREATE POLICY "inv_products_access" ON public.inv_products FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);

ALTER TABLE public.inv_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inv_movements_access" ON public.inv_movements;
CREATE POLICY "inv_movements_access" ON public.inv_movements FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);

ALTER TABLE public.inv_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inv_alerts_access" ON public.inv_alerts;
CREATE POLICY "inv_alerts_access" ON public.inv_alerts FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);

ALTER TABLE public.inv_valuations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inv_valuations_access" ON public.inv_valuations;
CREATE POLICY "inv_valuations_access" ON public.inv_valuations FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);

-- ============================================================================
-- 6. GRANTS
-- ============================================================================

GRANT ALL ON public.inv_products TO authenticated;
GRANT ALL ON public.inv_movements TO authenticated;
GRANT ALL ON public.inv_alerts TO authenticated;
GRANT ALL ON public.inv_valuations TO authenticated;
