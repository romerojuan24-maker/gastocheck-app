-- BancoCheck: tablas de reconciliación y contabilidad (nuevas, no conflictan)
-- Extraído de 20260704000002_bancocheck_complete_schema.sql (Chat 1) —
-- se excluyeron bank_accounts/bank_transactions de ese archivo porque ya
-- existen en producción con un esquema distinto. Ver supabase/migrations_excluded/README.md
-- 2026-07-05

-- ============================================================================
-- 1. BANK IMPORT LOGS (Trazabilidad de importaciones)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bank_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),

  filename VARCHAR(255) NOT NULL,
  import_type VARCHAR(50) NOT NULL CHECK (import_type IN ('OFX', 'MT940', 'CSV', 'SAT', 'MANUAL')),
  file_size_bytes INTEGER,

  total_records INTEGER,
  success_count INTEGER,
  error_count INTEGER,

  imported_at TIMESTAMP DEFAULT NOW(),
  imported_by UUID NOT NULL REFERENCES auth.users(id),

  CONSTRAINT check_counts CHECK (success_count + error_count = total_records OR total_records IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_import_logs_company ON public.bank_import_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_account ON public.bank_import_logs(bank_account_id);

-- ============================================================================
-- 2. BANK RECONCILIATIONS (Reconciliación mensual)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),

  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL CHECK (period_year >= 2000),

  bank_statement_balance DECIMAL(15, 2) NOT NULL,
  system_balance DECIMAL(15, 2) NOT NULL,
  difference DECIMAL(15, 2),

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
-- 3. ACCOUNTING VOUCHERS (Pólizas para contador)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.accounting_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),

  voucher_number VARCHAR(50) NOT NULL UNIQUE,
  voucher_type VARCHAR(50) NOT NULL CHECK (voucher_type IN ('INCOME', 'EXPENSE', 'TRANSFER')),

  source_module VARCHAR(50) NOT NULL,
  source_ids UUID[] NOT NULL,

  total_debit DECIMAL(15, 2) DEFAULT 0,
  total_credit DECIMAL(15, 2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'MXN',

  entries JSONB NOT NULL,

  exported_format VARCHAR(50),
  exported_at TIMESTAMP,
  exported_by UUID REFERENCES auth.users(id),

  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'exported', 'reconciled')),
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT check_balance CHECK (total_debit = total_credit)
);

CREATE INDEX IF NOT EXISTS idx_vouchers_company ON public.accounting_vouchers(company_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON public.accounting_vouchers(status);

-- ============================================================================
-- 4. RLS POLICIES (patrón company_members, ya probado en el resto del proyecto)
-- ============================================================================

ALTER TABLE public.bank_import_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bank_import_logs_access" ON public.bank_import_logs;
CREATE POLICY "bank_import_logs_access" ON public.bank_import_logs FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);

ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reconciliation_read" ON public.bank_reconciliations;
CREATE POLICY "reconciliation_read" ON public.bank_reconciliations FOR SELECT USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);
DROP POLICY IF EXISTS "reconciliation_write" ON public.bank_reconciliations;
CREATE POLICY "reconciliation_write" ON public.bank_reconciliations FOR INSERT WITH CHECK (
  company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid() AND status = 'active'
      AND role IN ('accountant', 'admin', 'owner', 'superadmin')
  )
);
DROP POLICY IF EXISTS "reconciliation_update" ON public.bank_reconciliations;
CREATE POLICY "reconciliation_update" ON public.bank_reconciliations FOR UPDATE USING (
  company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid() AND status = 'active'
      AND role IN ('accountant', 'admin', 'owner', 'superadmin')
  )
);

ALTER TABLE public.accounting_vouchers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vouchers_own_company" ON public.accounting_vouchers;
CREATE POLICY "vouchers_own_company" ON public.accounting_vouchers FOR SELECT USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);
DROP POLICY IF EXISTS "vouchers_export" ON public.accounting_vouchers;
CREATE POLICY "vouchers_export" ON public.accounting_vouchers FOR INSERT WITH CHECK (
  company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid() AND status = 'active'
      AND role IN ('accountant', 'admin', 'owner', 'superadmin')
  )
);

-- ============================================================================
-- 5. GRANTS
-- ============================================================================

GRANT ALL ON public.bank_import_logs TO authenticated;
GRANT ALL ON public.bank_reconciliations TO authenticated;
GRANT ALL ON public.accounting_vouchers TO authenticated;
