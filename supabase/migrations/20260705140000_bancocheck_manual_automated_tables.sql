-- BancoCheck: tablas manual/automated OCR+OAuth (nuevas, no conflictan)
-- Extraído de migrations_excluded/20260705120001_bancocheck_schema.sql —
-- se omite la sección 5 (bank_transactions) porque esa tabla ya existe en
-- producción con un esquema distinto. Ver supabase/migrations_excluded/README.md
-- 2026-07-05

-- ──────────────────────────────────────────────────────────────────────────
-- 1. BANK_ACCOUNTS_MANUAL — Cuentas importadas manualmente (OCR)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bank_accounts_manual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  account_name TEXT NOT NULL,
  bank_name TEXT,
  account_number TEXT,
  currency TEXT DEFAULT 'MXN',

  import_method TEXT CHECK (import_method IN ('pdf', 'image', 'csv', 'manual')),
  last_import_date TIMESTAMPTZ,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_manual_company ON bank_accounts_manual(company_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 2. BANK_STATEMENT_IMPORTS — Importaciones de estados de cuenta
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bank_statement_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_bank_statement_imports_company ON bank_statement_imports(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_statement_imports_status ON bank_statement_imports(processing_status);

-- ──────────────────────────────────────────────────────────────────────────
-- 3. BANK_STATEMENT_OCR_CONFIG — Configuración OCR por banco
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bank_statement_ocr_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  bank_name TEXT NOT NULL UNIQUE,

  ocr_engine TEXT CHECK (ocr_engine IN ('tesseract', 'aws_textract', 'google_vision')),

  table_detection_enabled BOOLEAN DEFAULT true,
  field_mapping JSONB,

  confidence_threshold DECIMAL(3,2) DEFAULT 0.85,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- 4. BANK_ACCOUNTS_AUTOMATED — Cuentas con API automática (OAuth)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bank_accounts_automated (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  bank_name TEXT NOT NULL,
  account_name TEXT,

  oauth_provider TEXT CHECK (oauth_provider IN ('bbva', 'santander', 'belvo')),
  oauth_token_encrypted TEXT,
  oauth_refresh_token TEXT,

  account_number TEXT,
  currency TEXT DEFAULT 'MXN',

  last_sync TIMESTAMPTZ,
  sync_status TEXT CHECK (sync_status IN ('connected', 'syncing', 'error', 'disconnected')) DEFAULT 'disconnected',
  last_error TEXT,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_automated_company ON bank_accounts_automated(company_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 5. TRANSACTION_MATCHING_LOG — Log de matching automático
-- FK a bank_transactions(id) — tabla ya existente en producción, id UUID
-- compatible, no requiere recrearla.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transaction_matching_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  transaction_a_id UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
  transaction_b_id UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,

  match_algorithm TEXT,
  confidence_score DECIMAL(3,2),

  matched BOOLEAN,
  reason TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transaction_matching_log_company ON transaction_matching_log(company_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 6. RECONCILIATION_STATUS — Estado de reconciliación
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reconciliation_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  reconciliation_period_start DATE NOT NULL,
  reconciliation_period_end DATE NOT NULL,

  total_transactions INT,
  matched_transactions INT,
  unmatched_transactions INT,
  disputed_transactions INT,

  matching_percentage DECIMAL(5,2),
  last_reconciliation TIMESTAMPTZ,

  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'discrepancies')) DEFAULT 'pending',
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_status_company ON reconciliation_status(company_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 7. UNSUPPORTED_BANK_REQUESTS — Admin alerts para bancos nuevos
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS unsupported_bank_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  bank_name TEXT NOT NULL,
  bank_country TEXT,

  requester_email TEXT,
  request_date TIMESTAMPTZ DEFAULT now(),

  request_count INT DEFAULT 1,
  last_request_date TIMESTAMPTZ,

  priority_score INT DEFAULT 0,

  status TEXT CHECK (status IN ('received', 'evaluated', 'in_progress', 'completed', 'rejected')) DEFAULT 'received',
  integration_status TEXT,

  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unsupported_bank_requests_status ON unsupported_bank_requests(status);
CREATE INDEX IF NOT EXISTS idx_unsupported_bank_requests_priority ON unsupported_bank_requests(priority_score DESC);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE bank_accounts_manual ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bank_accounts_manual_access" ON bank_accounts_manual;
CREATE POLICY "bank_accounts_manual_access" ON bank_accounts_manual FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);

ALTER TABLE bank_statement_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bank_statement_imports_access" ON bank_statement_imports;
CREATE POLICY "bank_statement_imports_access" ON bank_statement_imports FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);

ALTER TABLE bank_statement_ocr_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bank_statement_ocr_config_read" ON bank_statement_ocr_config;
CREATE POLICY "bank_statement_ocr_config_read" ON bank_statement_ocr_config FOR SELECT USING (true);

ALTER TABLE bank_accounts_automated ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bank_accounts_automated_access" ON bank_accounts_automated;
CREATE POLICY "bank_accounts_automated_access" ON bank_accounts_automated FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);

ALTER TABLE transaction_matching_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transaction_matching_log_access" ON transaction_matching_log;
CREATE POLICY "transaction_matching_log_access" ON transaction_matching_log FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);

ALTER TABLE reconciliation_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reconciliation_status_access" ON reconciliation_status;
CREATE POLICY "reconciliation_status_access" ON reconciliation_status FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);

ALTER TABLE unsupported_bank_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "unsupported_bank_requests_access" ON unsupported_bank_requests;
CREATE POLICY "unsupported_bank_requests_access" ON unsupported_bank_requests FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);
