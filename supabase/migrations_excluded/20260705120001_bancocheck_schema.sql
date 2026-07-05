-- ============================================================================
-- BANCOCHECK SCHEMA MIGRATION
-- Created: 2026-07-05
-- Purpose: 8 tables para BancoCheck (manual OCR imports + automatic API sync)
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. BANK_ACCOUNTS_MANUAL — Cuentas importadas manualmente (OCR)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bank_accounts_manual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,

  account_name TEXT NOT NULL,         -- "Cuenta Milenio 2024"
  bank_name TEXT,                     -- "BBVA", "Santander", etc.
  account_number TEXT,
  currency TEXT DEFAULT 'MXN',

  import_method TEXT CHECK (import_method IN ('pdf', 'image', 'csv', 'manual')),
  last_import_date TIMESTAMPTZ,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bank_accounts_manual_company ON bank_accounts_manual(company_id);


-- ──────────────────────────────────────────────────────────────────────────
-- 2. BANK_STATEMENT_IMPORTS — Importaciones de estados de cuenta
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bank_statement_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  manual_account_id UUID REFERENCES bank_accounts_manual(id) ON DELETE CASCADE,

  import_date TIMESTAMPTZ DEFAULT now(),
  file_name TEXT,
  file_size INT,
  file_format TEXT CHECK (file_format IN ('pdf', 'jpg', 'png', 'csv')),
  file_url TEXT,

  statement_start_date DATE,
  statement_end_date DATE,
  total_transactions INT DEFAULT 0,

  processing_status TEXT CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bank_statement_imports_company ON bank_statement_imports(company_id);
CREATE INDEX idx_bank_statement_imports_status ON bank_statement_imports(processing_status);


-- ──────────────────────────────────────────────────────────────────────────
-- 3. BANK_STATEMENT_OCR_CONFIG — Configuración OCR por banco
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bank_statement_ocr_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  bank_name TEXT NOT NULL UNIQUE,     -- "BBVA", "Santander", etc.

  ocr_engine TEXT CHECK (ocr_engine IN ('tesseract', 'aws_textract', 'google_vision')),

  table_detection_enabled BOOLEAN DEFAULT true,
  field_mapping JSONB,                -- {fecha: [row, col], monto: [row, col], desc: [row, col]}

  confidence_threshold DECIMAL(3,2) DEFAULT 0.85,  -- Min 85% confidence

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ──────────────────────────────────────────────────────────────────────────
-- 4. BANK_ACCOUNTS_AUTOMATED — Cuentas con API automática (OAuth)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bank_accounts_automated (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,

  bank_name TEXT NOT NULL,            -- "BBVA", "Santander", "Belvo"
  account_name TEXT,                  -- Nombre amigable

  oauth_provider TEXT CHECK (oauth_provider IN ('bbva', 'santander', 'belvo')),
  oauth_token_encrypted TEXT,         -- Encriptado
  oauth_refresh_token TEXT,           -- Encriptado

  account_number TEXT,
  currency TEXT DEFAULT 'MXN',

  last_sync TIMESTAMPTZ,
  sync_status TEXT CHECK (sync_status IN ('connected', 'syncing', 'error', 'disconnected')) DEFAULT 'disconnected',
  last_error TEXT,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bank_accounts_automated_company ON bank_accounts_automated(company_id);


-- ──────────────────────────────────────────────────────────────────────────
-- 5. BANK_TRANSACTIONS — Transacciones (union manual + API)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,

  -- Source: manual account (OCR) OR automated account (API)
  manual_account_id UUID REFERENCES bank_accounts_manual(id) ON DELETE SET NULL,
  automated_account_id UUID REFERENCES bank_accounts_automated(id) ON DELETE SET NULL,

  transaction_date DATE NOT NULL,
  transaction_time TIME,

  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  transaction_type TEXT CHECK (transaction_type IN ('debit', 'credit', 'transfer')),

  reference_number TEXT,              -- Check number, transfer ID, etc.
  balance_after DECIMAL(15,2),

  -- Matching status
  matching_status TEXT CHECK (matching_status IN ('unmatched', 'matched', 'disputed', 'manual')) DEFAULT 'unmatched',
  matched_with_id UUID,               -- FK to another transaction if matched
  matched_date TIMESTAMPTZ,

  -- Source indicator
  source TEXT CHECK (source IN ('manual_ocr', 'api_sync', 'manual_entry')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bank_transactions_company ON bank_transactions(company_id);
CREATE INDEX idx_bank_transactions_date ON bank_transactions(company_id, transaction_date);
CREATE INDEX idx_bank_transactions_matching ON bank_transactions(matching_status);


-- ──────────────────────────────────────────────────────────────────────────
-- 6. TRANSACTION_MATCHING_LOG — Log de matching automático
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transaction_matching_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,

  transaction_a_id UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
  transaction_b_id UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,

  match_algorithm TEXT,               -- "date_amount", "fuzzy_match", "manual"
  confidence_score DECIMAL(3,2),      -- 0.00 to 1.00

  matched BOOLEAN,
  reason TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_transaction_matching_log_company ON transaction_matching_log(company_id);


-- ──────────────────────────────────────────────────────────────────────────
-- 7. RECONCILIATION_STATUS — Estado de reconciliación
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reconciliation_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,

  reconciliation_period_start DATE NOT NULL,
  reconciliation_period_end DATE NOT NULL,

  total_transactions INT,
  matched_transactions INT,
  unmatched_transactions INT,
  disputed_transactions INT,

  matching_percentage DECIMAL(5,2),   -- 0-100
  last_reconciliation TIMESTAMPTZ,

  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'discrepancies')) DEFAULT 'pending',
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reconciliation_status_company ON reconciliation_status(company_id);


-- ──────────────────────────────────────────────────────────────────────────
-- 8. UNSUPPORTED_BANK_REQUESTS — Admin alerts para bancos nuevos
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS unsupported_bank_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,

  bank_name TEXT NOT NULL,
  bank_country TEXT,

  requester_email TEXT,
  request_date TIMESTAMPTZ DEFAULT now(),

  request_count INT DEFAULT 1,        -- Cuántos clientes lo han pedido
  last_request_date TIMESTAMPTZ,

  priority_score INT DEFAULT 0,       -- Calculated: based on demand

  status TEXT CHECK (status IN ('received', 'evaluated', 'in_progress', 'completed', 'rejected')) DEFAULT 'received',
  integration_status TEXT,            -- "Pending approval", "In development", "Beta testing", "Live"

  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_unsupported_bank_requests_status ON unsupported_bank_requests(status);
CREATE INDEX idx_unsupported_bank_requests_priority ON unsupported_bank_requests(priority_score DESC);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Bank Accounts Manual
ALTER TABLE bank_accounts_manual ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_accounts_manual_access"
  ON bank_accounts_manual FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
  );

-- Bank Statement Imports
ALTER TABLE bank_statement_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_statement_imports_access"
  ON bank_statement_imports FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
  );

-- Bank Statement OCR Config (global read, admin write)
ALTER TABLE bank_statement_ocr_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_statement_ocr_config_read"
  ON bank_statement_ocr_config FOR SELECT USING (true);

-- Bank Accounts Automated
ALTER TABLE bank_accounts_automated ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_accounts_automated_access"
  ON bank_accounts_automated FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
  );

-- Bank Transactions
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_transactions_access"
  ON bank_transactions FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
  );

-- Transaction Matching Log
ALTER TABLE transaction_matching_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transaction_matching_log_access"
  ON transaction_matching_log FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
  );

-- Reconciliation Status
ALTER TABLE reconciliation_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reconciliation_status_access"
  ON reconciliation_status FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
  );

-- Unsupported Bank Requests
ALTER TABLE unsupported_bank_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "unsupported_bank_requests_access"
  ON unsupported_bank_requests FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
  );

-- ============================================================================
-- END MIGRATION
-- ============================================================================
