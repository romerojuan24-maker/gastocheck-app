-- CobraCheck Module — Complete Integration (Clients, Invoices, Promises, Calls, Payments)

-- ============================================================================
-- 1. COBRA_CLIENTS — Customer base for collections
-- ============================================================================
CREATE TABLE IF NOT EXISTS cobra_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Client info
  name TEXT NOT NULL,
  rfc TEXT UNIQUE NOT NULL, -- Tax ID
  email TEXT,
  phone TEXT,
  contact_name TEXT,

  -- Credit & balance
  credit_limit NUMERIC(15,2) DEFAULT 0,
  current_balance NUMERIC(15,2) DEFAULT 0,

  -- Risk & status
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blacklist')),
  last_payment_date TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  UNIQUE(company_id, rfc)
);

CREATE INDEX idx_cobra_clients_company_id ON cobra_clients(company_id);
CREATE INDEX idx_cobra_clients_status ON cobra_clients(status);
CREATE INDEX idx_cobra_clients_risk_score ON cobra_clients(risk_score DESC);

-- ============================================================================
-- 2. COBRA_INVOICES — Invoices pending collection
-- ============================================================================
CREATE TABLE IF NOT EXISTS cobra_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES cobra_clients(id) ON DELETE CASCADE,

  -- Invoice details
  folio TEXT NOT NULL,
  uuid_sat TEXT, -- CFDI UUID for validation

  -- Amounts
  subtotal NUMERIC(15,2) NOT NULL,
  tax NUMERIC(15,2) DEFAULT 0,
  amount NUMERIC(15,2) NOT NULL GENERATED ALWAYS AS (subtotal + tax) STORED,

  -- Dates
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payment_date DATE,

  -- Tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled')),
  days_overdue INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN status IN ('paid', 'cancelled') THEN 0
      ELSE GREATEST(0, CURRENT_DATE - due_date)
    END
  ) STORED,

  -- Metadata
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  UNIQUE(company_id, folio)
);

CREATE INDEX idx_cobra_invoices_company_id ON cobra_invoices(company_id);
CREATE INDEX idx_cobra_invoices_client_id ON cobra_invoices(client_id);
CREATE INDEX idx_cobra_invoices_status ON cobra_invoices(status);
CREATE INDEX idx_cobra_invoices_due_date ON cobra_invoices(due_date);
CREATE INDEX idx_cobra_invoices_created_at ON cobra_invoices(created_at);

-- ============================================================================
-- 3. COBRA_PROMISES — Payment promises from clients
-- ============================================================================
CREATE TABLE IF NOT EXISTS cobra_promises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES cobra_clients(id) ON DELETE CASCADE,

  amount NUMERIC(15,2) NOT NULL,
  promise_date DATE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'broken')),
  notes TEXT,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_cobra_promises_company_id ON cobra_promises(company_id);
CREATE INDEX idx_cobra_promises_client_id ON cobra_promises(client_id);
CREATE INDEX idx_cobra_promises_status ON cobra_promises(status);
CREATE INDEX idx_cobra_promises_date ON cobra_promises(promise_date);

-- ============================================================================
-- 4. COBRA_CALLS — Call log for collectors
-- ============================================================================
CREATE TABLE IF NOT EXISTS cobra_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES cobra_clients(id) ON DELETE CASCADE,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),

  call_date TIMESTAMP NOT NULL,
  duration_minutes INTEGER,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'no_answer', 'voicemail')),
  notes TEXT,

  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_cobra_calls_company_id ON cobra_calls(company_id);
CREATE INDEX idx_cobra_calls_client_id ON cobra_calls(client_id);
CREATE INDEX idx_cobra_calls_recorded_by ON cobra_calls(recorded_by);
CREATE INDEX idx_cobra_calls_date ON cobra_calls(call_date);

-- ============================================================================
-- 5. COBRA_PAYMENTS — Payment register & tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS cobra_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES cobra_invoices(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES cobra_clients(id) ON DELETE CASCADE,

  amount NUMERIC(15,2) NOT NULL,
  payment_date DATE NOT NULL,
  method TEXT DEFAULT 'transfer' CHECK (method IN ('cash', 'transfer', 'check', 'credit_card', 'other')),
  reference TEXT,
  notes TEXT,

  -- Integration fields
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  created_by UUID REFERENCES auth.users(id),

  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_cobra_payments_company_id ON cobra_payments(company_id);
CREATE INDEX idx_cobra_payments_invoice_id ON cobra_payments(invoice_id);
CREATE INDEX idx_cobra_payments_client_id ON cobra_payments(client_id);
CREATE INDEX idx_cobra_payments_created_at ON cobra_payments(created_at);

-- ============================================================================
-- 6. AUDIT & TRIGGERS
-- ============================================================================

-- Trigger: Update cobra_clients.updated_at on any change
CREATE OR REPLACE TRIGGER cobra_clients_updated_at
  BEFORE UPDATE ON cobra_clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Update cobra_invoices.updated_at on any change
CREATE OR REPLACE TRIGGER cobra_invoices_updated_at
  BEFORE UPDATE ON cobra_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Recalc cobra_clients.current_balance after payment
CREATE OR REPLACE FUNCTION recalc_client_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cobra_clients
  SET current_balance = (
    SELECT COALESCE(SUM(
      CASE
        WHEN ci.status = 'paid' THEN 0
        WHEN ci.status = 'partial' THEN ci.amount - COALESCE(
          (SELECT SUM(cp.amount) FROM cobra_payments cp WHERE cp.invoice_id = ci.id),
          0
        )
        ELSE ci.amount
      END
    ), 0)
    FROM cobra_invoices ci
    WHERE ci.client_id = NEW.client_id
  ),
  last_payment_date = NEW.payment_date
  WHERE id = NEW.client_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cobra_payments_recalc_balance
  AFTER INSERT OR UPDATE ON cobra_payments
  FOR EACH ROW
  EXECUTE FUNCTION recalc_client_balance();

-- Trigger: Update invoice status to 'paid' when fully paid
CREATE OR REPLACE FUNCTION update_invoice_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cobra_invoices
  SET status = CASE
    WHEN (SELECT COALESCE(SUM(amount), 0) FROM cobra_payments WHERE invoice_id = NEW.invoice_id) >= amount
      THEN 'paid'
    WHEN (SELECT COALESCE(SUM(amount), 0) FROM cobra_payments WHERE invoice_id = NEW.invoice_id) > 0
      THEN 'partial'
    ELSE status
  END
  WHERE id = NEW.invoice_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cobra_payments_update_invoice
  AFTER INSERT OR UPDATE ON cobra_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_status();

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- cobra_clients RLS
ALTER TABLE cobra_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY cobra_clients_read
  ON cobra_clients FOR SELECT
  USING (
    company_id = (SELECT company_id FROM company_members WHERE auth_id = auth.uid())
    AND auth_role(company_id) IN ('owner', 'admin', 'supervisor', 'collector', 'operator')
  );

CREATE POLICY cobra_clients_write
  ON cobra_clients FOR INSERT, UPDATE
  USING (
    company_id = (SELECT company_id FROM company_members WHERE auth_id = auth.uid())
    AND auth_role(company_id) IN ('owner', 'admin', 'supervisor')
  );

-- cobra_invoices RLS
ALTER TABLE cobra_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY cobra_invoices_read
  ON cobra_invoices FOR SELECT
  USING (
    company_id = (SELECT company_id FROM company_members WHERE auth_id = auth.uid())
    AND auth_role(company_id) IN ('owner', 'admin', 'supervisor', 'collector', 'operator')
  );

CREATE POLICY cobra_invoices_write
  ON cobra_invoices FOR INSERT, UPDATE
  USING (
    company_id = (SELECT company_id FROM company_members WHERE auth_id = auth.uid())
    AND auth_role(company_id) IN ('owner', 'admin', 'supervisor')
  );

-- cobra_promises RLS
ALTER TABLE cobra_promises ENABLE ROW LEVEL SECURITY;

CREATE POLICY cobra_promises_read
  ON cobra_promises FOR SELECT
  USING (
    company_id = (SELECT company_id FROM company_members WHERE auth_id = auth.uid())
    AND auth_role(company_id) IN ('owner', 'admin', 'supervisor', 'collector', 'operator')
  );

CREATE POLICY cobra_promises_write
  ON cobra_promises FOR INSERT, UPDATE
  USING (
    company_id = (SELECT company_id FROM company_members WHERE auth_id = auth.uid())
    AND auth_role(company_id) IN ('owner', 'admin', 'supervisor', 'operator')
  );

-- cobra_calls RLS
ALTER TABLE cobra_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY cobra_calls_read
  ON cobra_calls FOR SELECT
  USING (
    company_id = (SELECT company_id FROM company_members WHERE auth_id = auth.uid())
    AND auth_role(company_id) IN ('owner', 'admin', 'supervisor')
    OR (recorded_by = auth.uid() AND auth_role(company_id) IN ('collector', 'operator'))
  );

CREATE POLICY cobra_calls_write
  ON cobra_calls FOR INSERT, UPDATE
  USING (
    company_id = (SELECT company_id FROM company_members WHERE auth_id = auth.uid())
    AND auth_role(company_id) IN ('owner', 'admin', 'supervisor', 'collector', 'operator')
  );

-- cobra_payments RLS
ALTER TABLE cobra_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY cobra_payments_read
  ON cobra_payments FOR SELECT
  USING (
    company_id = (SELECT company_id FROM company_members WHERE auth_id = auth.uid())
    AND auth_role(company_id) IN ('owner', 'admin', 'supervisor', 'operator')
  );

CREATE POLICY cobra_payments_write
  ON cobra_payments FOR INSERT
  USING (
    company_id = (SELECT company_id FROM company_members WHERE auth_id = auth.uid())
    AND (
      auth_role(company_id) IN ('owner', 'admin', 'supervisor')
      OR (auth_role(company_id) IN ('operator', 'collector') AND created_by = auth.uid())
    )
  );

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cobra_clients TO authenticated;
GRANT SELECT, INSERT, UPDATE ON cobra_invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON cobra_promises TO authenticated;
GRANT SELECT, INSERT ON cobra_calls TO authenticated;
GRANT SELECT, INSERT ON cobra_payments TO authenticated;
