-- Tabla: cfdi_recibidos
-- Propósito: Almacenar CFDIs descargados del SAT
-- Uso: Tracking de CFDIs recibidos y su validación contra compras

CREATE TABLE cfdi_recibidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id),

  -- Datos del CFDI
  uuid VARCHAR(36) NOT NULL UNIQUE,
  xml_content TEXT NOT NULL,
  monto NUMERIC(15, 2) NOT NULL,
  rfc_emisor VARCHAR(13) NOT NULL,
  nombre_emisor VARCHAR(255),
  fecha_emision TIMESTAMP NOT NULL,
  concepto TEXT,

  -- Relaciones
  compra_id UUID REFERENCES gastos(id),
  movimiento_bancario_id UUID REFERENCES movimientos_financieros(id),

  -- Estado
  estado VARCHAR(20) NOT NULL DEFAULT 'RECIBIDO', -- RECIBIDO, VALIDADO, NO_MATCH, RECHAZADO
  validado BOOLEAN DEFAULT FALSE,
  validado_por UUID REFERENCES usuarios(id),
  validado_en TIMESTAMP,

  -- Validación
  monto_coincide BOOLEAN,
  fecha_coincide BOOLEAN,
  rfc_coincide BOOLEAN,
  confianza_match NUMERIC(3, 0), -- 0-100

  -- Alertas
  alertas TEXT[], -- Array de alertas encontradas

  -- Auditoría
  descargado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_cfdi_empresa ON cfdi_recibidos(empresa_id);
CREATE INDEX idx_cfdi_uuid ON cfdi_recibidos(uuid);
CREATE INDEX idx_cfdi_rfc_emisor ON cfdi_recibidos(rfc_emisor);
CREATE INDEX idx_cfdi_compra ON cfdi_recibidos(compra_id);
CREATE INDEX idx_cfdi_estado ON cfdi_recibidos(estado);
CREATE INDEX idx_cfdi_validado ON cfdi_recibidos(validado);
CREATE INDEX idx_cfdi_fecha_emision ON cfdi_recibidos(fecha_emision);

-- Trigger: Actualizar timestamp de modificación
CREATE OR REPLACE FUNCTION actualizar_cfdi_recibidos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cfdi_recibidos_updated_at
BEFORE UPDATE ON cfdi_recibidos
FOR EACH ROW
EXECUTE FUNCTION actualizar_cfdi_recibidos_updated_at();

-- RLS Policies
ALTER TABLE cfdi_recibidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresas pueden ver sus CFDIs" ON cfdi_recibidos
  FOR SELECT
  USING (empresa_id IN (
    SELECT empresa_id FROM empresa_usuarios
    WHERE usuario_id = auth.uid()
  ));

CREATE POLICY "Empresas pueden crear CFDIs" ON cfdi_recibidos
  FOR INSERT
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM empresa_usuarios
    WHERE usuario_id = auth.uid()
  ));

CREATE POLICY "Empresas pueden actualizar CFDIs" ON cfdi_recibidos
  FOR UPDATE
  USING (empresa_id IN (
    SELECT empresa_id FROM empresa_usuarios
    WHERE usuario_id = auth.uid()
  ));
