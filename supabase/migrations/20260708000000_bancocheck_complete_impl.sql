-- BancoCheck — Implementación COMPLETA (Recepción, clasificación, sugerencias, autorización)
-- 2026-07-08
-- Incluye TODO lo que falta para que BancoCheck sea funcional (no solo reconciliación)

-- ============================================================================
-- 1. MOVIMIENTOS BANCARIOS (Transacciones importadas o capturadas)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),

  -- Datos básicos del movimiento
  transaction_date DATE NOT NULL,
  transaction_time TIME,
  reference VARCHAR(255),
  description TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  balance_after DECIMAL(15, 2),

  -- Clasificación automática
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('debit', 'credit', 'transfer')),
  -- IMPORTANTE: Estos se llenan AUTOMÁTICAMENTE por sistema (no usuario)
  detected_category VARCHAR(100), -- 'collection', 'expense', 'supplier_payment', 'transfer', 'tax', 'commission', 'payroll', 'unknown'
  detected_confidence DECIMAL(3, 2), -- 0.95 = muy seguro, 0.60 = dudoso

  -- Vinculación automática (se propone, no se fuerza)
  linked_receipt_id UUID REFERENCES public.receipts(id),
  linked_invoice_id UUID REFERENCES public.invoices(id),
  linked_supplier_id UUID,  -- proveedor detectado
  linked_client_id UUID,    -- cliente detectado
  linked_ot_id UUID,        -- orden de trabajo detectada

  -- Estado y autorización
  status VARCHAR(50) DEFAULT 'new' CHECK (status IN (
    'new',                -- Acaba de llegar (no procesado)
    'auto_approved',      -- Sistema autoaprobó (confianza alta)
    'pending_approval',   -- Esperando aprobación manual
    'approved',           -- Contador lo aprobó
    'rejected',           -- Contador lo rechazó
    'duplicate',          -- Es duplicado de otro
    'personal',           -- Personal (ignora para pólizas)
    'reconciled'          -- Ya reconciliado
  )),

  -- Auditoría de aprobación
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP,
  approval_notes TEXT,

  -- Importación
  import_batch_id UUID REFERENCES public.bank_import_logs(id),
  import_source VARCHAR(50), -- 'csv', 'ofx', 'belvo_api', 'manual'

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_tx_company ON public.bank_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_tx_account ON public.bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_tx_date ON public.bank_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_bank_tx_status ON public.bank_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bank_tx_detected_category ON public.bank_transactions(detected_category);
CREATE INDEX IF NOT EXISTS idx_bank_tx_linked_receipt ON public.bank_transactions(linked_receipt_id);
CREATE INDEX IF NOT EXISTS idx_bank_tx_linked_invoice ON public.bank_transactions(linked_invoice_id);

-- ============================================================================
-- 2. SUGERENCIAS DE ASIENTOS CONTABLES (No son pólizas, son borradores)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transaction_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),

  -- Qué dispara la sugerencia
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('bank_transaction', 'receipt', 'invoice', 'payroll', 'inventory')),
  source_id UUID NOT NULL,

  -- El asiento sugerido (JSONB con estructura flexible)
  suggested_entries JSONB NOT NULL, -- [{account_code: '1110', description: 'Banco', debit: 1000, credit: 0, tax_code: null}, ...]
  total_debit DECIMAL(15, 2),
  total_credit DECIMAL(15, 2),

  -- Confianza (IA calcula esto)
  confidence DECIMAL(3, 2) NOT NULL, -- 0.95 = aprueba automáticamente; < 0.70 = requiere contador
  confidence_reason TEXT, -- "Monto exacto de factura pendiente del cliente XYZ"

  -- Estado
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending',          -- Esperando aprobación
    'auto_approved',    -- Aprobado automáticamente por confianza alta
    'approved',         -- Contador lo aprobó
    'approved_modified',-- Contador lo aprobó pero editó los montos/cuentas
    'rejected',         -- Contador lo rechazó
    'executed'          -- Ya se convirtió en póliza/asiento real
  )),

  -- Auditoría
  suggested_by_module VARCHAR(50), -- 'bancocheck', 'gastocheck', 'inventario'
  suggested_at TIMESTAMP DEFAULT NOW(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP,
  review_notes TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suggestions_company ON public.transaction_suggestions(company_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON public.transaction_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_source ON public.transaction_suggestions(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_confidence ON public.transaction_suggestions(confidence);

-- ============================================================================
-- 3. CLASIFICACIÓN DE TRANSACCIONES (Reglas de detección automática)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transaction_classification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),

  -- Cuándo aplica esta regla
  keyword VARCHAR(255) NOT NULL, -- "OXXO", "PAYPAL", "IMPUESTOS", etc.
  bank_name VARCHAR(100),        -- Si es específica a banco
  amount_min DECIMAL(15, 2),
  amount_max DECIMAL(15, 2),

  -- Qué categoría sugerir
  detected_category VARCHAR(100) NOT NULL,
  confidence_score DECIMAL(3, 2) DEFAULT 0.85,

  -- Qué cuenta contable sugerir
  suggested_account_code VARCHAR(10),
  suggested_account_name VARCHAR(255),

  -- Auditoría
  created_by UUID NOT NULL REFERENCES auth.users(id),
  is_system_rule BOOLEAN DEFAULT FALSE, -- Sistema (no puede modificar usuario)
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(company_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_classification_company ON public.transaction_classification_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_classification_keyword ON public.transaction_classification_rules(keyword);

-- ============================================================================
-- 4. VINCULOS ENTRE TRANSACCIONES Y DOCUMENTOS (Trazabilidad completa)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transaction_linkages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),

  -- La transacción bancaria
  bank_transaction_id UUID NOT NULL REFERENCES public.bank_transactions(id),

  -- Lo que vincula (puede ser múltiple: 1 pago paga 3 facturas)
  linked_type VARCHAR(50) NOT NULL CHECK (linked_type IN ('invoice', 'receipt', 'supplier', 'client', 'ot', 'other')),
  linked_id UUID NOT NULL,

  -- Cómo se detectó
  linkage_method VARCHAR(50) NOT NULL CHECK (linkage_method IN ('automatic', 'ai_suggested', 'manual', 'auto_reconciled')),
  confidence_score DECIMAL(3, 2),

  -- Si es parcial (un pago paga parte de una deuda)
  is_partial BOOLEAN DEFAULT FALSE,
  partial_amount DECIMAL(15, 2),

  -- Auditoría
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(bank_transaction_id, linked_type, linked_id)
);

CREATE INDEX IF NOT EXISTS idx_linkages_company ON public.transaction_linkages(company_id);
CREATE INDEX IF NOT EXISTS idx_linkages_transaction ON public.transaction_linkages(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_linkages_linked ON public.transaction_linkages(linked_type, linked_id);

-- ============================================================================
-- 5. REGLAS DE AUTORIZACIÓN (Quién aprueba qué, bajo qué condiciones)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),

  -- Cuándo aplica
  min_amount DECIMAL(15, 2),
  max_amount DECIMAL(15, 2),
  applies_to_category VARCHAR(100), -- 'all', 'expense', 'collection', etc.
  applies_to_role VARCHAR(50), -- Quién puede crear (buyer, supervisor, etc.)

  -- Quién debe aprobar
  required_approval_role VARCHAR(50) NOT NULL, -- 'accountant', 'admin', 'owner'
  auto_approve_above_confidence DECIMAL(3, 2), -- Si confianza > 0.95, aprueba automáticamente

  -- Auditoría
  created_by UUID NOT NULL REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_rules_company ON public.approval_rules(company_id);

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bank_transactions_access" ON public.bank_transactions;
CREATE POLICY "bank_transactions_access" ON public.bank_transactions FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);
DROP POLICY IF EXISTS "bank_transactions_insert" ON public.bank_transactions;
CREATE POLICY "bank_transactions_insert" ON public.bank_transactions FOR INSERT WITH CHECK (
  company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid() AND status = 'active'
      AND role IN ('accountant', 'admin', 'owner', 'superadmin')
  )
);
DROP POLICY IF EXISTS "bank_transactions_update" ON public.bank_transactions;
CREATE POLICY "bank_transactions_update" ON public.bank_transactions FOR UPDATE USING (
  company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid() AND status = 'active'
      AND role IN ('accountant', 'admin', 'owner', 'superadmin')
  )
);

ALTER TABLE public.transaction_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suggestions_read" ON public.transaction_suggestions;
CREATE POLICY "suggestions_read" ON public.transaction_suggestions FOR SELECT USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);
DROP POLICY IF EXISTS "suggestions_write" ON public.transaction_suggestions;
CREATE POLICY "suggestions_write" ON public.transaction_suggestions FOR INSERT WITH CHECK (
  company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid() AND status = 'active'
      AND role IN ('accountant', 'admin', 'owner', 'superadmin')
  )
);
DROP POLICY IF EXISTS "suggestions_update" ON public.transaction_suggestions;
CREATE POLICY "suggestions_update" ON public.transaction_suggestions FOR UPDATE USING (
  company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid() AND status = 'active'
      AND role IN ('accountant', 'admin', 'owner', 'superadmin')
  )
);

ALTER TABLE public.transaction_classification_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rules_access" ON public.transaction_classification_rules;
CREATE POLICY "rules_access" ON public.transaction_classification_rules FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);

ALTER TABLE public.transaction_linkages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "linkages_access" ON public.transaction_linkages;
CREATE POLICY "linkages_access" ON public.transaction_linkages FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);

ALTER TABLE public.approval_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "approval_rules_read" ON public.approval_rules;
CREATE POLICY "approval_rules_read" ON public.approval_rules FOR SELECT USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);
DROP POLICY IF EXISTS "approval_rules_write" ON public.approval_rules;
CREATE POLICY "approval_rules_write" ON public.approval_rules FOR INSERT WITH CHECK (
  company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid() AND status = 'active'
      AND role IN ('admin', 'owner', 'superadmin')
  )
);

-- ============================================================================
-- 7. TRIGGERS PARA AUDITORÍA
-- ============================================================================

CREATE OR REPLACE FUNCTION update_bank_transaction_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_bank_transactions_updated_at ON public.bank_transactions;
CREATE TRIGGER trigger_bank_transactions_updated_at
BEFORE UPDATE ON public.bank_transactions
FOR EACH ROW
EXECUTE FUNCTION update_bank_transaction_updated_at();

-- ============================================================================
-- 8. GRANTS
-- ============================================================================

GRANT ALL ON public.bank_transactions TO authenticated;
GRANT ALL ON public.transaction_suggestions TO authenticated;
GRANT ALL ON public.transaction_classification_rules TO authenticated;
GRANT ALL ON public.transaction_linkages TO authenticated;
GRANT ALL ON public.approval_rules TO authenticated;
