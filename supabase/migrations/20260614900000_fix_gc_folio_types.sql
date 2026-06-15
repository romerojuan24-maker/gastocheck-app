-- Agrega tipos de folio faltantes: reembolso y batch
-- El default 'GC' era el fallback pero mejor ser explícito.

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
    WHEN 'receipt'   THEN v_prefix := 'RC';  v_width := 4;
    WHEN 'policy'    THEN v_prefix := 'POL'; v_width := 3;
    WHEN 'reembolso' THEN v_prefix := 'RB';  v_width := 4;
    WHEN 'batch'     THEN v_prefix := 'BT';  v_width := 4;
    ELSE                  v_prefix := 'GC';  v_width := 4;
  END CASE;

  RETURN v_prefix || '-' || LPAD(v_next::text, v_width, '0');
END;
$$;
