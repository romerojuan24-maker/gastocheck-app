-- Tabla: reconciliaciones
-- Propósito: Tracking de todas las reconciliaciones (compra→banco, cobro→banco)
-- Uso: Historial de validaciones y matches

CREATE TABLE reconciliaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id),

  -- Relaciones
  movimiento_bancario_id UUID NOT NULL REFERENCES movimientos_financieros(id),
  compra_id UUID REFERENCES gastos(id),
  cobro_id UUID REFERENCES cobros(id),

  -- Datos del match
  tipo VARCHAR(20) NOT NULL, -- EGRESO, INGRESO
  monto NUMERIC(15, 2) NOT NULL,
  monto_diferencia NUMERIC(15, 2), -- Diferencia si no es exacto
  fecha_movimiento TIMESTAMP NOT NULL,
  fecha_registro TIMESTAMP NOT NULL,
  dias_diferencia INTEGER, -- Diferencia en días

  -- Validación
  criterios_match VARCHAR(100)[], -- RFC, MONTO, FECHA, etc
  confianza NUMERIC(3, 0) NOT NULL, -- 0-100

  -- Resultado
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE', -- AUTOMÁTICO, MANUAL, PENDIENTE, RECHAZADO
  reconciliado BOOLEAN DEFAULT FALSE,
  reconciliado_por UUID REFERENCES usuarios(id),
  reconciliado_en TIMESTAMP,

  -- Auditoría
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_reconciliaciones_empresa ON reconciliaciones(empresa_id);
CREATE INDEX idx_reconciliaciones_movimiento ON reconciliaciones(movimiento_bancario_id);
CREATE INDEX idx_reconciliaciones_compra ON reconciliaciones(compra_id);
CREATE INDEX idx_reconciliaciones_cobro ON reconciliaciones(cobro_id);
CREATE INDEX idx_reconciliaciones_estado ON reconciliaciones(estado);
CREATE INDEX idx_reconciliaciones_tipo ON reconciliaciones(tipo);
CREATE INDEX idx_reconciliaciones_confianza ON reconciliaciones(confianza);

-- Trigger: Actualizar timestamp
CREATE OR REPLACE FUNCTION actualizar_reconciliaciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_reconciliaciones_updated_at
BEFORE UPDATE ON reconciliaciones
FOR EACH ROW
EXECUTE FUNCTION actualizar_reconciliaciones_updated_at();

-- RLS Policies
ALTER TABLE reconciliaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresas pueden ver sus reconciliaciones" ON reconciliaciones
  FOR SELECT
  USING (empresa_id IN (
    SELECT empresa_id FROM empresa_usuarios
    WHERE usuario_id = auth.uid()
  ));

CREATE POLICY "Empresas pueden crear reconciliaciones" ON reconciliaciones
  FOR INSERT
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM empresa_usuarios
    WHERE usuario_id = auth.uid()
  ));
