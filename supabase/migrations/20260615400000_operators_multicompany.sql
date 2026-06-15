-- Soporte multi-empresa para operadores
-- Un operador puede trabajar para múltiples empresas
-- Cada empresa tiene su propio catálogo de cuentas contables para ese operador

-- Tabla de unión: operador <-> empresa
CREATE TABLE IF NOT EXISTS operator_companies (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id     uuid        NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  company_id      uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  added_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(operator_id, company_id)
);

-- Migrar datos existentes de operators.company_id → operator_companies
-- (Solo si no existen ya)
INSERT INTO operator_companies (operator_id, company_id)
SELECT id, company_id FROM operators
WHERE company_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM operator_companies oc
    WHERE oc.operator_id = operators.id AND oc.company_id = operators.company_id
  )
ON CONFLICT DO NOTHING;

-- Índices
CREATE INDEX IF NOT EXISTS idx_operator_companies_operator   ON operator_companies(operator_id);
CREATE INDEX IF NOT EXISTS idx_operator_companies_company    ON operator_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_operator_companies_composite  ON operator_companies(operator_id, company_id);

-- RLS: usuario autenticado puede ver operadores de sus empresas
ALTER TABLE operator_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven operadores de sus empresas"
ON operator_companies FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Supervisores/admin pueden agregar operadores a empresas"
ON operator_companies FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid() AND status = 'active'
      AND role IN ('owner', 'admin', 'supervisor')
  )
);

CREATE POLICY "Supervisores/admin pueden quitar operadores"
ON operator_companies FOR DELETE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid() AND status = 'active'
      AND role IN ('owner', 'admin', 'supervisor')
  )
);

-- Trigger: si un receipt tiene operator_id, validar que la factura sea de una de las empresas del operador
-- (Esto se implementa en Edge Functions, no en triggers)

GRANT SELECT ON operator_companies TO authenticated;
GRANT INSERT ON operator_companies TO authenticated;
GRANT DELETE ON operator_companies TO authenticated;

NOTIFY pgrst, 'reload schema';
