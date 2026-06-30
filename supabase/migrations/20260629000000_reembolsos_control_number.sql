-- OTA 80: Número de control y nombre por reembolso
-- Ejecutar en Supabase SQL Editor

-- 1. Nuevas columnas en reembolsos
ALTER TABLE reembolsos
  ADD COLUMN IF NOT EXISTS control_number integer,
  ADD COLUMN IF NOT EXISTS name           text NOT NULL DEFAULT '';

-- 2. Tabla de contadores por empresa (1 fila por empresa, se incrementa atómicamente)
CREATE TABLE IF NOT EXISTS company_reembolso_counters (
  company_id  uuid    PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  last_number integer NOT NULL DEFAULT 0
);

-- 3. Función atómica: devuelve el siguiente número sin duplicados
--    Usa INSERT ... ON CONFLICT DO UPDATE → una sola operación, sin race conditions
CREATE OR REPLACE FUNCTION next_reembolso_number(p_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_num integer;
BEGIN
  INSERT INTO company_reembolso_counters (company_id, last_number)
  VALUES (p_company_id, 1)
  ON CONFLICT (company_id) DO UPDATE
    SET last_number = company_reembolso_counters.last_number + 1
  RETURNING last_number INTO next_num;
  RETURN next_num;
END;
$$;

-- 4. RLS: solo la misma empresa puede ver/modificar sus contadores
ALTER TABLE company_reembolso_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_read_own_counter"
  ON company_reembolso_counters FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- 5. Índice para buscar por número de control dentro de una empresa
CREATE INDEX IF NOT EXISTS idx_reembolsos_control_number
  ON reembolsos (company_id, control_number);
