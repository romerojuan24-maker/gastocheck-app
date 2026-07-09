-- ============================================================================
-- BANCOCHECK REDESIGNED: Control operativo de movimientos
-- No es banco digital, es clasificación y reconciliación
-- ============================================================================

-- BankAccount: Cuentas bancarias importadas
CREATE TABLE bank_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number_last4 TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MXN',
  type TEXT NOT NULL,
  imported_balance NUMERIC(19, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_id TEXT NOT NULL,
  UNIQUE (tenant_id, bank_name, account_number_last4)
);

CREATE INDEX idx_bank_accounts_tenant ON bank_accounts(tenant_id);

-- ============================================================================
-- BankImportBatch: Lotes de importación (CSV/Excel)
-- ============================================================================

CREATE TABLE bank_import_batches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  total_rows INT NOT NULL,
  imported_rows INT NOT NULL,
  duplicate_rows INT NOT NULL,
  error_rows INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_id TEXT NOT NULL,
  UNIQUE (tenant_id, bank_account_id, file_hash)
);

CREATE INDEX idx_bank_import_batches_tenant ON bank_import_batches(tenant_id);
CREATE INDEX idx_bank_import_batches_account ON bank_import_batches(bank_account_id);

-- ============================================================================
-- BankTransaction: Movimientos importados
-- ============================================================================

CREATE TABLE bank_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,

  -- Detalles del movimiento
  date DATE NOT NULL,
  description TEXT NOT NULL,
  reference TEXT,
  debit NUMERIC(19, 2) NOT NULL DEFAULT 0,
  credit NUMERIC(19, 2) NOT NULL DEFAULT 0,
  balance_after NUMERIC(19, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MXN',

  -- Tracking
  import_batch_id TEXT NOT NULL REFERENCES bank_import_batches(id) ON DELETE CASCADE,
  unique_hash TEXT NOT NULL,
  raw_data JSONB,

  -- Status y clasificación
  status TEXT NOT NULL DEFAULT 'NEW', -- NEW, SUGGESTED_MATCH, EXPLAINED, NEEDS_RECEIPT, NEEDS_INVOICE, NEEDS_PAYMENT_COMPLEMENT, UNIDENTIFIED, PERSONAL, IGNORED
  category TEXT, -- gasto_negocio, proveedor, anticipo, reembolso, impuesto, comision_bancaria, prestamo, personal, otro

  -- Matching
  matched_entity_type TEXT, -- invoice, receipt, expense, advance, collection, payment
  matched_entity_id TEXT,
  confidence INT, -- 0-100

  -- Flags
  is_personal BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (tenant_id, import_batch_id, unique_hash)
);

CREATE INDEX idx_bank_transactions_tenant ON bank_transactions(tenant_id);
CREATE INDEX idx_bank_transactions_account ON bank_transactions(bank_account_id);
CREATE INDEX idx_bank_transactions_status ON bank_transactions(status);
CREATE INDEX idx_bank_transactions_match ON bank_transactions(matched_entity_type, matched_entity_id);
CREATE INDEX idx_bank_transactions_date ON bank_transactions(date);

-- ============================================================================
-- BankMatchSuggestion: Sugerencias automáticas de matching
-- ============================================================================

CREATE TABLE bank_match_suggestions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  bank_transaction_id TEXT NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,

  entity_type TEXT NOT NULL, -- invoice, receipt, expense, advance, collection, payment
  entity_id TEXT NOT NULL,

  confidence INT NOT NULL, -- 0-100
  reason TEXT NOT NULL, -- "same_amount_and_date", "amount_matches", "supplier_in_description"

  accepted BOOLEAN NOT NULL DEFAULT false,
  dismissed BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bank_match_suggestions_tenant ON bank_match_suggestions(tenant_id);
CREATE INDEX idx_bank_match_suggestions_transaction ON bank_match_suggestions(bank_transaction_id);
CREATE INDEX idx_bank_match_suggestions_entity ON bank_match_suggestions(entity_type, entity_id);

-- ============================================================================
-- BankAuditLog: Auditoría de cambios
-- ============================================================================

CREATE TABLE bank_audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  bank_transaction_id TEXT,

  action TEXT NOT NULL, -- classify, match, mark_personal, ignore
  old_value JSONB,
  new_value JSONB,

  user_id TEXT NOT NULL,
  reason TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bank_audit_logs_tenant ON bank_audit_logs(tenant_id);
CREATE INDEX idx_bank_audit_logs_transaction ON bank_audit_logs(bank_transaction_id);

-- ============================================================================
-- RLS POLICIES: Cada tenant ve solo sus datos
-- ============================================================================

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_match_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_audit_logs ENABLE ROW LEVEL SECURITY;

-- Members of a tenant can view and modify accounts
CREATE POLICY "members_view_accounts" ON bank_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = bank_accounts.tenant_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "members_insert_accounts" ON bank_accounts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = tenant_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "members_update_accounts" ON bank_accounts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = tenant_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  );

-- Import batches
CREATE POLICY "members_view_batches" ON bank_import_batches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = tenant_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "members_insert_batches" ON bank_import_batches
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = tenant_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin', 'contador_general')
    )
  );

-- Transactions
CREATE POLICY "members_view_transactions" ON bank_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = tenant_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "members_update_transactions" ON bank_transactions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = tenant_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin', 'contador_general')
    )
  );

-- Match suggestions
CREATE POLICY "members_view_suggestions" ON bank_match_suggestions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = tenant_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "members_update_suggestions" ON bank_match_suggestions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = tenant_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin', 'contador_general')
    )
  );

-- Audit logs
CREATE POLICY "members_view_audit" ON bank_audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = tenant_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "members_insert_audit" ON bank_audit_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = tenant_id
        AND cm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- CONSTRAINTS: Validaciones
-- ============================================================================

-- No permitir valores negativos en dinero
ALTER TABLE bank_transactions
  ADD CONSTRAINT debit_non_negative CHECK (debit >= 0),
  ADD CONSTRAINT credit_non_negative CHECK (credit >= 0),
  ADD CONSTRAINT balance_numeric CHECK (balance_after IS NOT NULL);

-- Solo un tipo de movimiento (débito O crédito, no ambos)
ALTER TABLE bank_transactions
  ADD CONSTRAINT debit_or_credit CHECK (
    (debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)
  );

-- Confidence debe estar entre 0 y 100
ALTER TABLE bank_match_suggestions
  ADD CONSTRAINT confidence_range CHECK (confidence >= 0 AND confidence <= 100);

ALTER TABLE bank_transactions
  ADD CONSTRAINT confidence_range CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100));

COMMENT ON TABLE bank_accounts IS 'Cuentas bancarias importadas. NO es operaciones, es clasificación.';
COMMENT ON TABLE bank_transactions IS 'Movimientos importados de CSV/Excel. Estado muestra si está explicado.';
COMMENT ON TABLE bank_match_suggestions IS 'Sugerencias automáticas para relacionar con GastoCheck, CobraCheck, etc.';
COMMENT ON TABLE bank_audit_logs IS 'Auditoría completa de quién clasificó/relacionó qué y cuándo.';
