-- ============================================================================
-- FACTURACHECK SCHEMA MIGRATION
-- Created: 2026-07-05
-- Purpose: 8 tables para FacturaCheck (CFDI generation + distribution)
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. CFDI_CREDITS — Saldo de créditos (prepago)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cfdi_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  credit_plan TEXT CHECK (credit_plan IN ('fixed', 'payperuse', 'hybrid')) DEFAULT 'fixed',
  total_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  monthly_allowance DECIMAL(15,2),      -- Para planes fixed (ej: $500/mes)
  price_per_cfdi DECIMAL(10,4),         -- Para planes payperuse (ej: $2.50/CFDI)

  consumed_this_month DECIMAL(15,2) DEFAULT 0,
  overage_allowed BOOLEAN DEFAULT true,
  overage_percentage DECIMAL(5,2) DEFAULT 20,  -- 20% line of credit

  last_reset_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cfdi_credits_company ON cfdi_credits(company_id);


-- ──────────────────────────────────────────────────────────────────────────
-- 2. CFDI_CREDIT_TRANSACTIONS — Movimientos de saldo
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cfdi_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id UUID NOT NULL REFERENCES cfdi_credits(id) ON DELETE CASCADE,

  transaction_type TEXT CHECK (transaction_type IN ('recharge', 'consumption', 'overage', 'adjustment')),
  amount DECIMAL(15,2) NOT NULL,
  balance_before DECIMAL(15,2),
  balance_after DECIMAL(15,2),

  reference TEXT,  -- CFDI folio, payment ID, etc.
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cfdi_credit_transactions_credit ON cfdi_credit_transactions(credit_id);


-- ──────────────────────────────────────────────────────────────────────────
-- 3. CFDI_DOCUMENTS — YA EXISTE en producción con esquema SAT maduro
-- (rfc_emisor, razon_social_emisor, iva, ieps, retenciones, uso_cfdi,
--  sat_validated_at, related_bank_txn_id, etc.) — NO recrear aquí.
-- Las tablas de abajo solo referencian cfdi_documents(id) como FK.
-- ──────────────────────────────────────────────────────────────────────────


-- ──────────────────────────────────────────────────────────────────────────
-- 4. CFDI_DISTRIBUTIONS — Distribución de CFDIs (email/WhatsApp)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cfdi_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cfdi_id UUID NOT NULL REFERENCES cfdi_documents(id) ON DELETE CASCADE,

  distribution_channel TEXT CHECK (distribution_channel IN ('email', 'whatsapp', 'download_link')),

  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_name TEXT,

  status TEXT CHECK (status IN ('pending', 'sent', 'failed', 'bounced', 'undelivered')) DEFAULT 'pending',
  error_message TEXT,

  sent_at TIMESTAMPTZ,
  retry_count INT DEFAULT 0,
  last_retry_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cfdi_distributions_cfdi ON cfdi_distributions(cfdi_id);
CREATE INDEX idx_cfdi_distributions_status ON cfdi_distributions(status);


-- ──────────────────────────────────────────────────────────────────────────
-- 5. PAC_CONFIGURATION — Configuración PAC (Proveedor Autorizado de Certificación)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pac_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  pac_provider TEXT CHECK (pac_provider IN ('facturama', 'solucion_facil', 'sw', 'finkok')),

  api_key_encrypted TEXT NOT NULL,  -- Encriptado
  api_user TEXT,
  api_password_encrypted TEXT,      -- Encriptado

  webhook_secret_encrypted TEXT,    -- Para verificar callbacks

  is_active BOOLEAN DEFAULT true,
  test_mode BOOLEAN DEFAULT false,

  last_validated TIMESTAMPTZ,
  validation_error TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pac_configuration_company ON pac_configuration(company_id);


-- ──────────────────────────────────────────────────────────────────────────
-- 6. EMAIL_TEMPLATES — Plantillas de email
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  template_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,  -- HTML o plain text

  variables JSONB,  -- {folio, total, receptor_name, etc.}

  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_email_templates_company ON email_templates(company_id);


-- ──────────────────────────────────────────────────────────────────────────
-- 7. WHATSAPP_TEMPLATES — Plantillas de WhatsApp
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  template_name TEXT NOT NULL,
  message_text TEXT NOT NULL,

  variables JSONB,  -- {folio, total, receptor_name, download_link, etc.}

  include_pdf BOOLEAN DEFAULT true,
  include_xml BOOLEAN DEFAULT true,

  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_whatsapp_templates_company ON whatsapp_templates(company_id);


-- ──────────────────────────────────────────────────────────────────────────
-- 8. AUDIT_LOG_FACTURACHECK — Auditoría fiscal
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log_facturacheck (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  cfdi_id UUID REFERENCES cfdi_documents(id) ON DELETE SET NULL,

  action TEXT NOT NULL,  -- 'created', 'stamped', 'cancelled', 'distributed', etc.
  action_by_user_id UUID,
  action_timestamp TIMESTAMPTZ DEFAULT now(),

  ip_address TEXT,
  user_agent TEXT,
  device_info JSONB,

  before_state JSONB,  -- Estado anterior (para auditoría)
  after_state JSONB,   -- Estado nuevo

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_log_facturacheck_company ON audit_log_facturacheck(company_id);
CREATE INDEX idx_audit_log_facturacheck_cfdi ON audit_log_facturacheck(cfdi_id);
CREATE INDEX idx_audit_log_facturacheck_date ON audit_log_facturacheck(action_timestamp);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE cfdi_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cfdi_credits_access"
  ON cfdi_credits FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
  );

ALTER TABLE cfdi_credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cfdi_credit_transactions_access"
  ON cfdi_credit_transactions FOR ALL USING (
    credit_id IN (SELECT id FROM cfdi_credits WHERE company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active'))
  );

-- cfdi_documents ya existe con su propia RLS en producción — no tocar aquí.

ALTER TABLE cfdi_distributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cfdi_distributions_access"
  ON cfdi_distributions FOR ALL USING (
    cfdi_id IN (SELECT id FROM cfdi_documents WHERE company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active'))
  );

ALTER TABLE pac_configuration ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pac_configuration_access"
  ON pac_configuration FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
  );

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_templates_access"
  ON email_templates FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
  );

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "whatsapp_templates_access"
  ON whatsapp_templates FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
  );

ALTER TABLE audit_log_facturacheck ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_facturacheck_access"
  ON audit_log_facturacheck FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
  );

-- ============================================================================
-- END MIGRATION
-- ============================================================================
