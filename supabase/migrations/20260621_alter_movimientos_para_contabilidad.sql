-- Alter table: movimientos_financieros
-- Propósito: Agregar campos para sincronización contable
-- Uso: Tracking completo de validaciones y reconciliaciones

ALTER TABLE movimientos_financieros
ADD COLUMN IF NOT EXISTS cfdi_recibido_id UUID REFERENCES cfdi_recibidos(id),
ADD COLUMN IF NOT EXISTS reconciliacion_id UUID REFERENCES reconciliaciones(id),
ADD COLUMN IF NOT EXISTS estado_contable VARCHAR(50) DEFAULT 'REGISTRADO', -- REGISTRADO, PÓLIZA_CREADA, CFDI_VALIDADO, PAGADO, RECONCILIADO
ADD COLUMN IF NOT EXISTS validado_por_sat BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS validado_por_banco BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reconciliacion_confianza NUMERIC(3, 0),
ADD COLUMN IF NOT EXISTS fecha_última_sync TIMESTAMP,
ADD COLUMN IF NOT EXISTS próxima_sync TIMESTAMP,
ADD COLUMN IF NOT EXISTS errores_sync TEXT[];

-- Alter table: polizas
-- Propósito: Agregar campos para auditoría SAT y validación
-- Uso: Tracking de validaciones de CFDI y reconciliación bancaria

ALTER TABLE polizas
ADD COLUMN IF NOT EXISTS cfdi_uuid VARCHAR(36),
ADD COLUMN IF NOT EXISTS validada_por_cfdi BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS validada_por_banco BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS estado_sincronizacion VARCHAR(50) DEFAULT 'SINCRONIZADA', -- SINCRONIZADA, FALLO, PENDIENTE
ADD COLUMN IF NOT EXISTS última_sync TIMESTAMP,
ADD COLUMN IF NOT EXISTS reconciliacion_id UUID REFERENCES reconciliaciones(id);

-- Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_movimientos_cfdi_recibido ON movimientos_financieros(cfdi_recibido_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_reconciliacion ON movimientos_financieros(reconciliacion_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_estado_contable ON movimientos_financieros(estado_contable);
CREATE INDEX IF NOT EXISTS idx_movimientos_validado_sat ON movimientos_financieros(validado_por_sat);
CREATE INDEX IF NOT EXISTS idx_movimientos_validado_banco ON movimientos_financieros(validado_por_banco);

CREATE INDEX IF NOT EXISTS idx_polizas_cfdi_uuid ON polizas(cfdi_uuid);
CREATE INDEX IF NOT EXISTS idx_polizas_validada_cfdi ON polizas(validada_por_cfdi);
CREATE INDEX IF NOT EXISTS idx_polizas_validada_banco ON polizas(validada_por_banco);
CREATE INDEX IF NOT EXISTS idx_polizas_estado_sync ON polizas(estado_sincronizacion);

-- Trigger: Actualizar estado_contable cuando se crea póliza
CREATE OR REPLACE FUNCTION actualizar_estado_contable_on_poliza()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE movimientos_financieros
  SET estado_contable = 'PÓLIZA_CREADA'
  WHERE id = NEW.movimiento_financiero_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_estado_on_poliza
AFTER INSERT ON polizas
FOR EACH ROW
EXECUTE FUNCTION actualizar_estado_contable_on_poliza();

-- Trigger: Actualizar estado_contable cuando se valida CFDI
CREATE OR REPLACE FUNCTION actualizar_estado_cfdi_validado()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.validado = TRUE AND OLD.validado = FALSE THEN
    UPDATE movimientos_financieros
    SET estado_contable = 'CFDI_VALIDADO',
        validado_por_sat = TRUE,
        fecha_última_sync = CURRENT_TIMESTAMP
    WHERE id IN (
      SELECT id FROM movimientos_financieros
      WHERE cfdi_recibido_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_estado_cfdi_validado
AFTER UPDATE ON cfdi_recibidos
FOR EACH ROW
EXECUTE FUNCTION actualizar_estado_cfdi_validado();

-- Trigger: Actualizar estado_contable cuando se reconcilia
CREATE OR REPLACE FUNCTION actualizar_estado_reconciliacion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reconciliado = TRUE AND OLD.reconciliado = FALSE THEN
    UPDATE movimientos_financieros
    SET estado_contable = 'PAGADO',
        validado_por_banco = TRUE,
        reconciliacion_id = NEW.id,
        fecha_última_sync = CURRENT_TIMESTAMP,
        estado_pago = 'PAGADO'
    WHERE id = NEW.movimiento_bancario_id;

    UPDATE polizas
    SET validada_por_banco = TRUE,
        estado_sincronizacion = 'SINCRONIZADA',
        última_sync = CURRENT_TIMESTAMP,
        reconciliacion_id = NEW.id
    WHERE movimiento_financiero_id = NEW.movimiento_bancario_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_estado_reconciliacion
AFTER UPDATE ON reconciliaciones
FOR EACH ROW
EXECUTE FUNCTION actualizar_estado_reconciliacion();
