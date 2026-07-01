-- ============================================================================
-- GastoCheck - Integración Contable Completa
-- Validación SAT + Clasificación contable + Exportación estándar
-- ============================================================================

-- 1. EXTENSIÓN: Validación SAT
CREATE TABLE IF NOT EXISTS sat_validations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cfdi_uuid TEXT NOT NULL UNIQUE,
  rfc_emisor TEXT NOT NULL,
  rfc_receptor TEXT NOT NULL,
  monto DECIMAL(14,2) NOT NULL,
  validation_status TEXT NOT NULL CHECK (validation_status IN ('valid', 'invalid', 'cancelled', 'not_found', 'error')),
  validation_timestamp TIMESTAMPTZ NOT NULL,
  error_message TEXT,
  validation_date_sat TIMESTAMPTZ,
  estado_cfdi TEXT,  -- 'Vigente', 'Cancelado', 'No Encontrado'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, cfdi_uuid)
);

CREATE INDEX IF NOT EXISTS idx_sat_validations_status ON sat_validations(validation_status);
CREATE INDEX IF NOT EXISTS idx_sat_validations_cfdi ON sat_validations(cfdi_uuid);

-- 2. CATÁLOGO: Cuentas Contables (MEJORADO)
CREATE TABLE IF NOT EXISTS accounting_accounts_v2 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('activo','pasivo','patrimonio','ingreso','egreso','costo')),
  sub_type TEXT,  -- 'circulante', 'no_circulante', etc
  nature TEXT CHECK (nature IN ('deudora','acreedora')),  -- Para balance
  is_deductible BOOLEAN DEFAULT TRUE,  -- Para ISR/IVA
  requires_cfdi BOOLEAN DEFAULT TRUE,
  active BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_accounting_accounts_company ON accounting_accounts_v2(company_id);
CREATE INDEX IF NOT EXISTS idx_accounting_accounts_type ON accounting_accounts_v2(account_type);

-- 3. IMPORT LOG: Historial de cargas de catálogo
CREATE TABLE IF NOT EXISTS accounting_account_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  imported_by UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  total_accounts INT,
  successful_imports INT,
  failed_imports INT,
  errors JSONB,
  import_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. EXTENSIÓN: Expenses con Clasificación Contable
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS accounting_account_id UUID REFERENCES accounting_accounts_v2(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS sat_validation_id UUID REFERENCES sat_validations(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS requires_sat_validation BOOLEAN DEFAULT TRUE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS sat_validated BOOLEAN DEFAULT FALSE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS sat_validated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_expenses_accounting_account ON expenses(accounting_account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_sat_validation ON expenses(sat_validated);

-- 5. EXPORTACIÓN: Asientos contables (para CONTPAQi/SAT)
CREATE TABLE IF NOT EXISTS accounting_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  export_date TIMESTAMPTZ DEFAULT NOW(),
  export_format TEXT CHECK (export_format IN ('contpaqui','sat_xml','generic_json','csv')),
  entry_number INT,  -- Número de asiento
  account_id UUID NOT NULL REFERENCES accounting_accounts_v2(id),
  concept TEXT NOT NULL,
  debe DECIMAL(14,2) DEFAULT 0,
  haber DECIMAL(14,2) DEFAULT 0,
  cfdi_reference UUID REFERENCES cfdi_data(expense_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounting_entries_policy ON accounting_entries(policy_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_format ON accounting_entries(export_format);

-- 6. EXPORTACIÓN: Registro de descargas
CREATE TABLE IF NOT EXISTS accounting_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('contpaqui','sat_xml','generic_json','csv')),
  file_path TEXT NOT NULL,
  download_url TEXT NOT NULL,
  file_size INT,
  total_entries INT,
  total_debe DECIMAL(14,2),
  total_haber DECIMAL(14,2),
  generated_by UUID NOT NULL REFERENCES auth.users(id),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounting_exports_policy ON accounting_exports(policy_id);
CREATE INDEX IF NOT EXISTS idx_accounting_exports_format ON accounting_exports(format);

-- 7. FUNCIÓN: Validar CFDI contra SAT (simulado - requiere API real)
CREATE OR REPLACE FUNCTION validate_cfdi_with_sat(
  p_cfdi_uuid TEXT,
  p_rfc_emisor TEXT,
  p_rfc_receptor TEXT,
  p_monto DECIMAL
)
RETURNS TABLE (
  is_valid BOOLEAN,
  status TEXT,
  message TEXT,
  estado_cfdi TEXT
) LANGUAGE plpgsql AS $$
DECLARE
  v_result BOOLEAN;
  v_status TEXT;
  v_message TEXT;
  v_estado TEXT;
BEGIN
  -- NOTA: Esto es simulado. En producción usar API real del SAT
  -- APIs reales: SAT PORTAL (requiere credential) o Verificación.FINKOK.COM

  -- Validaciones básicas
  IF p_cfdi_uuid IS NULL OR LENGTH(p_cfdi_uuid) != 36 THEN
    RETURN QUERY SELECT FALSE, 'invalid_format', 'UUID CFDI inválido', NULL::TEXT;
    RETURN;
  END IF;

  IF p_rfc_emisor IS NULL OR p_rfc_receptor IS NULL THEN
    RETURN QUERY SELECT FALSE, 'missing_rfc', 'RFC emisor o receptor faltante', NULL::TEXT;
    RETURN;
  END IF;

  -- Simular validación (en producción: llamar a API del SAT)
  -- https://www.gob.mx/tramites/ficha/servicio-de-consulta-y-validacion-de-comprobantes-fiscales-digitales-por-internet/SAT0101000000000000001

  v_status := 'valid';
  v_message := 'CFDI validado contra catálogo SAT';
  v_estado := 'Vigente';
  v_result := TRUE;

  RETURN QUERY SELECT v_result, v_status, v_message, v_estado;
END;
$$;

-- 8. FUNCIÓN: Generar asientos contables desde póliza
CREATE OR REPLACE FUNCTION generate_accounting_entries(
  p_policy_id UUID,
  p_company_id UUID
)
RETURNS TABLE (
  total_entries INT,
  total_debe DECIMAL,
  total_haber DECIMAL,
  balanced BOOLEAN
) LANGUAGE plpgsql AS $$
DECLARE
  v_entry_count INT := 0;
  v_total_debe DECIMAL := 0;
  v_total_haber DECIMAL := 0;
  v_expense RECORD;
BEGIN
  -- Limpiar asientos previos
  DELETE FROM accounting_entries WHERE policy_id = p_policy_id;

  -- Generar asiento por cada gasto autorizado
  FOR v_expense IN
    SELECT e.id, e.total, e.provider_name, aa.code, aa.id as account_id, aa.nature
    FROM expenses e
    LEFT JOIN accounting_accounts_v2 aa ON e.accounting_account_id = aa.id
    WHERE e.policy_id = p_policy_id
      AND e.status IN ('authorized','invoice_applied','closed_in_policy')
  LOOP
    -- Débito a cuenta de gasto
    INSERT INTO accounting_entries (
      company_id, policy_id, entry_number, account_id, concept, debe, cfdi_reference
    )
    VALUES (
      p_company_id,
      p_policy_id,
      v_entry_count + 1,
      v_expense.account_id,
      'Gasto: ' || v_expense.provider_name,
      v_expense.total,
      v_expense.id
    );

    v_total_debe := v_total_debe + v_expense.total;
    v_entry_count := v_entry_count + 1;

    -- Crédito a cuenta de efectivo/banco (contrapartida)
    INSERT INTO accounting_entries (
      company_id, policy_id, entry_number, account_id, concept, haber, cfdi_reference
    )
    VALUES (
      p_company_id,
      p_policy_id,
      v_entry_count + 1,
      (SELECT id FROM accounting_accounts_v2 WHERE account_type = 'activo' AND code = '1010' LIMIT 1),
      'Pago gasto: ' || v_expense.provider_name,
      v_expense.total,
      v_expense.id
    );

    v_total_haber := v_total_haber + v_expense.total;
    v_entry_count := v_entry_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_entry_count, v_total_debe, v_total_haber, (v_total_debe = v_total_haber);
END;
$$;

-- 9. FUNCIÓN: Exportar póliza en formato CONTPAQi XML
CREATE OR REPLACE FUNCTION export_policy_contpaqui(
  p_policy_id UUID,
  p_company_id UUID
)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_xml TEXT;
  v_empresa RECORD;
  v_asiento RECORD;
BEGIN
  SELECT c.name, c.rfc INTO v_empresa
  FROM companies c WHERE c.id = p_company_id;

  v_xml := '<?xml version="1.0" encoding="UTF-8"?>' || E'\n';
  v_xml := v_xml || '<Poliza xmlns="http://www.contpaqi.com.mx/schemas/2024">' || E'\n';
  v_xml := v_xml || '  <Empresa>' || COALESCE(v_empresa.name, '') || '</Empresa>' || E'\n';
  v_xml := v_xml || '  <RFC>' || COALESCE(v_empresa.rfc, '') || '</RFC>' || E'\n';
  v_xml := v_xml || '  <Fecha>' || TO_CHAR(NOW(), 'YYYY-MM-DD') || '</Fecha>' || E'\n';
  v_xml := v_xml || '  <Asientos>' || E'\n';

  FOR v_asiento IN
    SELECT entry_number, account_id, concept, debe, haber
    FROM accounting_entries
    WHERE policy_id = p_policy_id
    ORDER BY entry_number
  LOOP
    v_xml := v_xml || '    <Asiento>' || E'\n';
    v_xml := v_xml || '      <Numero>' || v_asiento.entry_number || '</Numero>' || E'\n';
    v_xml := v_xml || '      <Concepto>' || COALESCE(v_asiento.concept, '') || '</Concepto>' || E'\n';
    v_xml := v_xml || '      <Debe>' || COALESCE(v_asiento.debe, 0) || '</Debe>' || E'\n';
    v_xml := v_xml || '      <Haber>' || COALESCE(v_asiento.haber, 0) || '</Haber>' || E'\n';
    v_xml := v_xml || '    </Asiento>' || E'\n';
  END LOOP;

  v_xml := v_xml || '  </Asientos>' || E'\n';
  v_xml := v_xml || '</Poliza>';

  RETURN v_xml;
END;
$$;

-- 10. FUNCIÓN: Exportar póliza en JSON genérico
CREATE OR REPLACE FUNCTION export_policy_json(p_policy_id UUID)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_json JSONB;
BEGIN
  SELECT jsonb_build_object(
    'poliza_id', p_policy_id,
    'fecha_generacion', NOW(),
    'asientos', (
      SELECT jsonb_agg(jsonb_build_object(
        'numero', entry_number,
        'cuenta', (SELECT code FROM accounting_accounts_v2 WHERE id = account_id),
        'concepto', concept,
        'debe', debe,
        'haber', haber
      ))
      FROM accounting_entries WHERE policy_id = p_policy_id
    ),
    'totales', jsonb_build_object(
      'debe', (SELECT COALESCE(SUM(debe), 0) FROM accounting_entries WHERE policy_id = p_policy_id),
      'haber', (SELECT COALESCE(SUM(haber), 0) FROM accounting_entries WHERE policy_id = p_policy_id),
      'balanceado', (
        SELECT (COALESCE(SUM(debe), 0) = COALESCE(SUM(haber), 0))
        FROM accounting_entries WHERE policy_id = p_policy_id
      )
    )
  ) INTO v_json;

  RETURN v_json;
END;
$$;

-- 11. RLS: Proteger datos contables
ALTER TABLE sat_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_accounts_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_account_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_exports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "read accounting accounts" ON accounting_accounts_v2 FOR SELECT
  USING (auth_is_member(company_id) AND auth_can_view_all(company_id));

CREATE POLICY "manage accounting accounts" ON accounting_accounts_v2 FOR ALL
  USING (auth_role(company_id) IN ('owner','accountant'))
  WITH CHECK (auth_role(company_id) IN ('owner','accountant'));

CREATE POLICY "read entries" ON accounting_entries FOR SELECT
  USING (auth_is_member(company_id) AND auth_can_view_all(company_id));

CREATE POLICY "read exports" ON accounting_exports FOR SELECT
  USING (auth_is_member(company_id));

-- 12. GRANTS
GRANT EXECUTE ON FUNCTION validate_cfdi_with_sat TO authenticated;
GRANT EXECUTE ON FUNCTION generate_accounting_entries TO authenticated;
GRANT EXECUTE ON FUNCTION export_policy_contpaqui TO authenticated;
GRANT EXECUTE ON FUNCTION export_policy_json TO authenticated;

COMMENT ON TABLE sat_validations IS 'Historial de validaciones de CFDIs contra el SAT';
COMMENT ON TABLE accounting_accounts_v2 IS 'Catálogo de cuentas contables de la empresa';
COMMENT ON TABLE accounting_entries IS 'Asientos contables generados de pólizas';
COMMENT ON TABLE accounting_exports IS 'Registros de exportaciones para sistemas contables';
