-- Simplificar viáticos: son expenses clasificadas como viáticos
-- Agregar campos a expenses para clasificación

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_viatico BOOLEAN DEFAULT false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS viatico_concept TEXT
  CHECK (viatico_concept IN ('car_rental', 'presentation', 'meals', 'accommodation', 'transport', 'other', NULL));
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS viatico_type TEXT
  CHECK (viatico_type IN ('controlled', 'uncontrolled', NULL));
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS trip_city TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS trip_date DATE;

-- Índices para búsqueda rápida de viáticos
CREATE INDEX IF NOT EXISTS expenses_is_viatico ON expenses(company_id, is_viatico) WHERE is_viatico = true;
CREATE INDEX IF NOT EXISTS expenses_viatico_status ON expenses(company_id, is_viatico, status) WHERE is_viatico = true;

-- Trigger para validar que si is_viatico=true, tiene concept y type
CREATE OR REPLACE FUNCTION validate_viatico()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_viatico = true THEN
    IF NEW.viatico_concept IS NULL OR NEW.viatico_type IS NULL THEN
      RAISE EXCEPTION 'Viático debe tener concept y type';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_viatico ON expenses;
CREATE TRIGGER trg_validate_viatico
  BEFORE INSERT OR UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION validate_viatico();
