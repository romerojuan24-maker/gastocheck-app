-- Fixes de bugs críticos detectados en auditoría

-- BUG #7: FIX - Agregar unique index para suppliers upsert
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_company_normalized_unique
  ON suppliers(company_id, normalized_name)
  WHERE company_id IS NOT NULL AND normalized_name IS NOT NULL;

-- BUG #4: FIX - Agregar CHECK constraints en sat_validation_status
ALTER TABLE receipts
  ADD CONSTRAINT sat_validation_status_valid
    CHECK (sat_validation_status IS NULL OR sat_validation_status IN ('pending','validated','blocked','warning'));

-- BUG #6: FIX - Agregar constraints en advance_requests
ALTER TABLE advance_requests
  ADD CONSTRAINT reason_not_empty
    CHECK (length(trim(reason)) > 2),
  ADD CONSTRAINT reviewer_reviewed_at_consistent
    CHECK ((reviewer_id IS NULL AND reviewed_at IS NULL) OR (reviewer_id IS NOT NULL AND reviewed_at IS NOT NULL));

-- BUG #24: FIX - Prevenir ciclos en suppliers
CREATE OR REPLACE FUNCTION validate_supplier_no_cycle()
RETURNS TRIGGER AS $$
BEGIN
  -- Si hay canonical_supplier_id, verificar que no crea ciclo
  IF NEW.canonical_supplier_id IS NOT NULL THEN
    -- Evitar auto-referencia
    IF NEW.canonical_supplier_id = NEW.id THEN
      RAISE EXCEPTION 'Supplier no puede ser canonical de sí mismo';
    END IF;
    -- Prevenir ciclos: verificar que canonical_supplier_id no apunta atrás
    -- (validación simple: máximo 1 nivel de indirección)
    IF EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = NEW.canonical_supplier_id
        AND s.canonical_supplier_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Ciclo detectado en canonical_supplier_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_supplier_no_cycle
  BEFORE INSERT OR UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION validate_supplier_no_cycle();

-- BUG #9: FIX - Agregar RLS policy para SAT validation (supervisores pueden validar)
CREATE POLICY "Supervisores pueden validar SAT"
  ON receipts
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('supervisor', 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('supervisor', 'admin')
    )
  );

-- BUG #20: Agregar nota en whatsapp messages sobre image handling (documentación)
COMMENT ON TABLE notifications IS 'Notificaciones en-app; whatsapp-webhook debe descargar imágenes y llamar ocr-extract';
