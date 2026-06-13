-- Folios secuenciales por empresa: RC-NNNN para comprobantes, POL-NNN para pólizas
-- Migración: 20260613000001_company_folios.sql

-- Tabla de contadores por empresa
CREATE TABLE IF NOT EXISTS company_counters (
  company_id    uuid    NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  counter_type  text    NOT NULL,
  current_value integer NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, counter_type)
);

ALTER TABLE company_counters ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_counters' AND policyname = 'company_counters_member_select'
  ) THEN
    CREATE POLICY company_counters_member_select
      ON company_counters FOR SELECT TO authenticated
      USING (auth_is_member(company_id));
  END IF;
END $$;

-- Función atómica: obtiene y retorna el siguiente folio correlativo
CREATE OR REPLACE FUNCTION next_gc_folio(p_company_id uuid, p_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next   integer;
  v_prefix text;
  v_width  integer;
BEGIN
  INSERT INTO company_counters (company_id, counter_type, current_value)
  VALUES (p_company_id, p_type, 1)
  ON CONFLICT (company_id, counter_type)
  DO UPDATE SET current_value = company_counters.current_value + 1
  RETURNING current_value INTO v_next;

  CASE p_type
    WHEN 'receipt' THEN v_prefix := 'RC';  v_width := 4;
    WHEN 'policy'  THEN v_prefix := 'POL'; v_width := 3;
    ELSE                v_prefix := 'GC';  v_width := 4;
  END CASE;

  RETURN v_prefix || '-' || LPAD(v_next::text, v_width, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION next_gc_folio(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION next_gc_folio(uuid, text) TO authenticated;

-- Columna gc_folio en receipts (folio correlativo GastoCheck)
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS gc_folio text;

-- Columna gc_folio en policies
ALTER TABLE policies ADD COLUMN IF NOT EXISTS gc_folio text;
