-- BancoCheck: Hub integral de tesorería
-- Conecta GastoCheck + CobraCheck + Contador + OCR
-- 2026-07-04

-- ============================================================================
-- 1. BANK ACCOUNTS (Tipos completos de cuentas)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),

  -- Identificación
  name VARCHAR(100) NOT NULL,
  account_type VARCHAR(50) NOT NULL CHECK (account_type IN (
    'bank_account', 'cash_register', 'savings', 'investment',
    'credit_card', 'debit_card', 'bank_loan', 'private_loan'
  )),

  -- Detalles bancarios
  bank_name VARCHAR(100),
  account_number VARCHAR(50),
  rfc VARCHAR(13),
  currency VARCHAR(3) DEFAULT 'MXN',

  -- Saldos
  current_balance DECIMAL(15, 2) DEFAULT 0,
  balance_last_reconcile DECIMAL(15, 2) DEFAULT 0,
  last_reconcile_date TIMESTAMP,

  -- Estado
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT check_balance CHECK (current_balance >= -999999999)
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_company ON public.bank_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_active ON public.bank_accounts(is_active) WHERE is_active = true;

-- ============================================================================
-- 2. BANK TRANSACTIONS (Movimientos con integraciones)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),

  -- Información básica
  description VARCHAR(500) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'MXN',
  transaction_date DATE NOT NULL,

  -- Integración con módulos
  source_module VARCHAR(50),  -- gastocheck, cobracheck, manual, ocr
  source_id UUID,  -- ref a expense_id o collection_id

  -- Detalles de pago
  payment_method VARCHAR(50),  -- cheque, transferencia, efectivo, tarjeta_credito, tarjeta_debito
  bank_reference_number VARCHAR(100),  -- Folio de banco/SAT

  -- Costos asociados
  commission DECIMAL(15, 2) DEFAULT 0,
  tax_on_commission DECIMAL(15, 2) DEFAULT 0,

  -- Clasificación
  category VARCHAR(100),
  status VARCHAR(50) DEFAULT 'new' CHECK (status IN (
    'new', 'explained', 'matched', 'reconciled', 'pending_document', 'pending_invoice'
  )),

  -- OCR
  ocr_data JSONB,
  receipt_image_url VARCHAR(500),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT check_amount CHECK (amount != 0)
);

CREATE INDEX IF NOT EXISTS idx_transactions_company ON public.bank_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON public.bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_source ON public.bank_transactions(source_module, source_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.bank_transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.bank_transactions(transaction_date);

-- ============================================================================
-- 3. BANK IMPORT LOGS (Trazabilidad de importaciones)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bank_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),

  -- Archivo importado
  filename VARCHAR(255) NOT NULL,
  import_type VARCHAR(50) NOT NULL CHECK (import_type IN ('OFX', 'MT940', 'CSV', 'SAT', 'MANUAL')),
  file_size_bytes INTEGER,

  -- Resultados
  total_records INTEGER,
  success_count INTEGER,
  error_count INTEGER,

  -- Trazabilidad
  imported_at TIMESTAMP DEFAULT NOW(),
  imported_by UUID NOT NULL REFERENCES auth.users(id),

  CONSTRAINT check_counts CHECK (success_count + error_count = total_records OR total_records IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_import_logs_company ON public.bank_import_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_account ON public.bank_import_logs(bank_account_id);

-- ============================================================================
-- 4. BANK RECONCILIATIONS (Reconciliación mensual)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),

  -- Período
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL CHECK (period_year >= 2000),

  -- Saldos
  bank_statement_balance DECIMAL(15, 2) NOT NULL,
  system_balance DECIMAL(15, 2) NOT NULL,
  difference DECIMAL(15, 2),

  -- Estado
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'reconciled', 'needs_review')),
  reconciled_at TIMESTAMP,
  reconciled_by UUID REFERENCES auth.users(id),
  notes TEXT,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(company_id, bank_account_id, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS idx_reconciliations_company ON public.bank_reconciliations(company_id);
CREATE INDEX IF NOT EXISTS idx_reconciliations_status ON public.bank_reconciliations(status);

-- ============================================================================
-- 5. ACCOUNTING VOUCHERS (Pólizas para contador)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.accounting_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),

  -- Identificación
  voucher_number VARCHAR(50) NOT NULL UNIQUE,
  voucher_type VARCHAR(50) NOT NULL CHECK (voucher_type IN ('INCOME', 'EXPENSE', 'TRANSFER')),

  -- Origen
  source_module VARCHAR(50) NOT NULL,
  source_ids UUID[] NOT NULL,

  -- Contabilidad
  total_debit DECIMAL(15, 2) DEFAULT 0,
  total_credit DECIMAL(15, 2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'MXN',

  -- Líneas de la póliza
  entries JSONB NOT NULL,  -- [{ account_code, description, debit, credit, tax_code }, ...]

  -- Exportación
  exported_format VARCHAR(50),  -- csv, contpaqui_xml, sat_xml
  exported_at TIMESTAMP,
  exported_by UUID REFERENCES auth.users(id),

  -- Estado
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'exported', 'reconciled')),
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT check_balance CHECK (total_debit = total_credit)
);

CREATE INDEX IF NOT EXISTS idx_vouchers_company ON public.accounting_vouchers(company_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON public.accounting_vouchers(status);

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

-- bank_accounts: Ver solo de la propia empresa
DROP POLICY IF EXISTS "bank_accounts_own_company" ON public.bank_accounts;
CREATE POLICY "bank_accounts_own_company" ON public.bank_accounts
  USING (company_id = auth_company_id())
  WITH CHECK (company_id = auth_company_id());

-- bank_transactions: Ver solo de la propia empresa
DROP POLICY IF EXISTS "bank_transactions_own_company" ON public.bank_transactions;
CREATE POLICY "bank_transactions_own_company" ON public.bank_transactions
  USING (company_id = auth_company_id())
  WITH CHECK (company_id = auth_company_id());

-- bank_reconciliations: Solo contador/admin pueden reconciliar
DROP POLICY IF EXISTS "reconciliation_read" ON public.bank_reconciliations;
CREATE POLICY "reconciliation_read" ON public.bank_reconciliations
  USING (company_id = auth_company_id());

DROP POLICY IF EXISTS "reconciliation_write" ON public.bank_reconciliations;
CREATE POLICY "reconciliation_write" ON public.bank_reconciliations
  WITH CHECK (
    company_id = auth_company_id() AND
    auth_role() IN ('accountant', 'admin', 'owner', 'superadmin')
  );

-- accounting_vouchers: Solo contador/admin pueden exportar
DROP POLICY IF EXISTS "vouchers_own_company" ON public.accounting_vouchers;
CREATE POLICY "vouchers_own_company" ON public.accounting_vouchers
  USING (company_id = auth_company_id());

DROP POLICY IF EXISTS "vouchers_export" ON public.accounting_vouchers;
CREATE POLICY "vouchers_export" ON public.accounting_vouchers
  FOR INSERT
  WITH CHECK (
    company_id = auth_company_id() AND
    auth_role() IN ('accountant', 'admin', 'owner', 'superadmin')
  );

-- ============================================================================
-- 7. ENABLE RLS
-- ============================================================================

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_import_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_vouchers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. GRANTS
-- ============================================================================

GRANT ALL ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_transactions TO authenticated;
GRANT ALL ON public.bank_import_logs TO authenticated;
GRANT ALL ON public.bank_reconciliations TO authenticated;
GRANT ALL ON public.accounting_vouchers TO authenticated;

-- ============================================================================
-- TRIGGERS (Integraciones automáticas)
-- ============================================================================

-- Trigger: Cuando se crea un gasto en GastoCheck → crear bank_transaction
-- (Nota: Esto se ejecutará desde el código, no aquí. Aquí dejamos la estructura.)

-- Trigger: Cuando se crea un cobro en CobraCheck → crear bank_transaction
-- (Nota: Esto se ejecutará desde el código, no aquí.)

-- Trigger: Auto-actualizar balance en bank_accounts cuando hay transacción nueva
CREATE OR REPLACE FUNCTION update_bank_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.bank_accounts
  SET current_balance = current_balance + NEW.amount,
      updated_at = NOW()
  WHERE id = NEW.bank_account_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_bank_balance ON public.bank_transactions;
CREATE TRIGGER trigger_update_bank_balance
  AFTER INSERT ON public.bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_account_balance();

-- ============================================================================
-- 9. INITIAL SEED (Opcional)
-- ============================================================================

-- Dejamos vacío: cada empresa creará sus propias cuentas
