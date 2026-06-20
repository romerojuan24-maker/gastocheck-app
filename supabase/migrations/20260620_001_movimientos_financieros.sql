-- Tabla central: movimientos_financieros
-- Fecha: 2026-06-20
-- Propósito: Integración de todos los módulos (GastoCheck, CobraCheck, BancoCheck, etc.)
-- CRÍTICO: Esta tabla NO se modifica después de hoy. Extensible pero no refactorizable.

CREATE TABLE IF NOT EXISTS movimientos_financieros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- SECUENCIA POR EMPRESA
  numero_movimiento BIGINT,

  -- TIPO Y CATEGORÍA
  tipo_movimiento VARCHAR(20) NOT NULL,        -- GASTO, INGRESO, PAGO_PENDIENTE, REEMBOLSO
  subtipo VARCHAR(50),                         -- COMPRA_LOCAL, TRANSFERENCIA, DEPOSITO_CLIENTE, etc.
  categoria VARCHAR(50),                       -- Auto-categorizado

  -- MONTO
  monto DECIMAL(15,2) NOT NULL,                -- Positivo o negativo
  moneda VARCHAR(3) DEFAULT 'MXN',

  -- PARTES INVOLUCRADAS
  rfc_otra_parte VARCHAR(13),                  -- RFC proveedor/cliente
  nombre_otra_parte VARCHAR(255),
  cuenta_bancaria_otra_parte VARCHAR(50),

  -- FECHAS
  fecha_evento DATE NOT NULL,                  -- Cuándo sucedió
  fecha_registro TIMESTAMP DEFAULT now(),      -- Cuándo se registró
  fecha_pago DATE,                             -- Cuándo se pagó
  fecha_vencimiento DATE,                      -- Vencimiento (si es FACTURA)

  -- DESCRIPCIÓN
  concepto VARCHAR(255),
  descripcion TEXT,

  -- ESTADO DEL CICLO DE DINERO (4 dimensiones)
  estado_registro VARCHAR(20) DEFAULT 'REGISTRADO',    -- BORRADOR, REGISTRADO, CANCELADO
  estado_pago VARCHAR(20) DEFAULT 'PENDIENTE',         -- PENDIENTE, PAGADO, PARCIAL, VENCIDO
  estado_impuesto VARCHAR(20) DEFAULT 'PENDIENTE',     -- PENDIENTE, FACTURADO, DEVUELTO
  estado_contable VARCHAR(20) DEFAULT 'PENDIENTE_PÓLIZA',  -- PENDIENTE_PÓLIZA, PÓLIZA_CREADA, ENVIADO_SAT

  -- REFERENCIAS CRUZADAS (Corazón del sistema integral)
  gasto_id UUID REFERENCES gastos(id) SET NULL,
  factura_id UUID REFERENCES facturas(id) SET NULL,
  pago_id UUID REFERENCES pagos(id) SET NULL,
  banco_movimiento_id UUID REFERENCES banco_movimientos(id) SET NULL,
  cfdi_id UUID REFERENCES cfdi_importados(id) SET NULL,
  poliza_id UUID REFERENCES polizas(id) SET NULL,

  -- RECONCILIACIÓN
  es_reconciliado BOOLEAN DEFAULT false,
  fecha_reconciliacion TIMESTAMP,
  reconciliado_con UUID REFERENCES movimientos_financieros(id) SET NULL,

  -- AUDITORÍA
  creado_por UUID REFERENCES usuarios(id),
  creado_en TIMESTAMP DEFAULT now(),
  modificado_por UUID REFERENCES usuarios(id),
  modificado_en TIMESTAMP DEFAULT now(),

  -- FLAGS
  es_duplicado BOOLEAN DEFAULT false,
  requiere_revision BOOLEAN DEFAULT false,     -- Si OCR/parsing tiene baja confianza
  trazabilidad_completa BOOLEAN DEFAULT false, -- Si tenemos gasto + pago + banco

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- ÍNDICES CRÍTICOS PARA PERFORMANCE
CREATE INDEX idx_mov_empresa ON movimientos_financieros(empresa_id);
CREATE INDEX idx_mov_tipo ON movimientos_financieros(tipo_movimiento);
CREATE INDEX idx_mov_estado_pago ON movimientos_financieros(estado_pago);
CREATE INDEX idx_mov_fecha ON movimientos_financieros(fecha_evento);
CREATE INDEX idx_mov_rfc ON movimientos_financieros(rfc_otra_parte);
CREATE INDEX idx_mov_gasto_id ON movimientos_financieros(gasto_id);
CREATE INDEX idx_mov_factura_id ON movimientos_financieros(factura_id);
CREATE INDEX idx_mov_banco_id ON movimientos_financieros(banco_movimiento_id);
CREATE UNIQUE INDEX idx_mov_numero ON movimientos_financieros(empresa_id, numero_movimiento) WHERE numero_movimiento IS NOT NULL;

-- RLS: CRÍTICO PARA MULTI-TENANT
ALTER TABLE movimientos_financieros ENABLE ROW LEVEL SECURITY;

CREATE POLICY mov_by_empresa ON movimientos_financieros
  FOR ALL USING (
    empresa_id IN (
      SELECT empresa_id FROM empresa_usuarios
      WHERE usuario_id = auth.uid()
    )
  );

-- TRIGGER: Auto-update updated_at
CREATE TRIGGER update_movimientos_financieros_updated_at
  BEFORE UPDATE ON movimientos_financieros
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- EXTENSIONES A TABLAS EXISTENTES
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS movimiento_id UUID REFERENCES movimientos_financieros(id) SET NULL;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS origen VARCHAR(20) DEFAULT 'OCR';
CREATE INDEX IF NOT EXISTS idx_gastos_movimiento ON gastos(movimiento_id);

ALTER TABLE facturas ADD COLUMN IF NOT EXISTS movimiento_id UUID REFERENCES movimientos_financieros(id) SET NULL;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS uuid_cfdi VARCHAR(36) UNIQUE;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS origen VARCHAR(20) DEFAULT 'MANUAL';
CREATE INDEX IF NOT EXISTS idx_facturas_movimiento ON facturas(movimiento_id);

ALTER TABLE pagos ADD COLUMN IF NOT EXISTS movimiento_id UUID REFERENCES movimientos_financieros(id) SET NULL;
CREATE INDEX IF NOT EXISTS idx_pagos_movimiento ON pagos(movimiento_id);

-- SUCCESS MESSAGE
SELECT 'Arquitectura integral creada exitosamente' AS status;
