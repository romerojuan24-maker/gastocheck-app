-- OTA 82: Cuentas bancarias de la empresa
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS company_bank_accounts (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_name      text        NOT NULL,
  account_last4  text,                          -- últimos 4 dígitos visibles
  clabe          text,                          -- CLABE interbancaria (18 dígitos)
  account_holder text,                          -- nombre del titular
  account_type   text        NOT NULL DEFAULT 'checking', -- checking | savings
  currency       text        NOT NULL DEFAULT 'MXN',
  active         boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE company_bank_accounts ENABLE ROW LEVEL SECURITY;

-- Solo miembros activos de la empresa pueden ver las cuentas
CREATE POLICY "members_view_bank_accounts"
  ON company_bank_accounts FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- Solo owner/admin pueden insertar/actualizar/borrar
CREATE POLICY "admin_manage_bank_accounts"
  ON company_bank_accounts FOR ALL
  USING (company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid()
      AND status = 'active'
      AND role IN ('owner', 'admin')
  ));

-- Índice para listar por empresa
CREATE INDEX IF NOT EXISTS idx_company_bank_accounts_company
  ON company_bank_accounts (company_id, active);
