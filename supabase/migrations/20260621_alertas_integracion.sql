-- ============================================================================
-- INTEGRACIÓN: Tabla de alertas global para todos los módulos
-- ============================================================================

CREATE TABLE IF NOT EXISTS alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id),

  -- Tipo de alerta
  tipo TEXT NOT NULL, -- 'ANOMALIA', 'STOCK_BAJO', 'SALDO_CRITICO', 'RECONCILIACION', 'DISCREPANCIA'
  severidad TEXT NOT NULL, -- 'INFO', 'ADVERTENCIA', 'CRÍTICO'

  -- Contenido
  descripcion TEXT NOT NULL,
  referencia_id UUID, -- referencia al movimiento, producto, etc

  -- Estado
  leida BOOLEAN DEFAULT false,
  fecha_creacion TIMESTAMP DEFAULT now(),
  fecha_lectura TIMESTAMP,

  -- Auditoría
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_alertas_empresa ON alertas(empresa_id);
CREATE INDEX idx_alertas_tipo ON alertas(tipo);
CREATE INDEX idx_alertas_severidad ON alertas(severidad);
CREATE INDEX idx_alertas_leida ON alertas(leida);

-- ============================================================================
-- MEJORAS A movimientos_financieros: campos para integración
-- ============================================================================

ALTER TABLE movimientos_financieros ADD COLUMN IF NOT EXISTS
  requiere_revision BOOLEAN DEFAULT false;

ALTER TABLE movimientos_financieros ADD COLUMN IF NOT EXISTS
  revisado_por UUID REFERENCES users(id);

ALTER TABLE movimientos_financieros ADD COLUMN IF NOT EXISTS
  fecha_revision TIMESTAMP;

ALTER TABLE movimientos_financieros ADD COLUMN IF NOT EXISTS
  notas_revision TEXT;

-- ============================================================================
-- TABLA DE CACHÉ para Dashboard (actualización rápida)
-- ============================================================================

CREATE TABLE IF NOT EXISTS dashboard_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) UNIQUE,

  -- KPIs
  gastos_totales DECIMAL(15,2),
  ingresos_totales DECIMAL(15,2),
  saldo_actual DECIMAL(15,2),

  -- Reconciliación
  movimientos_total INT,
  movimientos_pagados INT,
  porcentaje_reconciliacion DECIMAL(5,2),

  -- Alertas
  anomalias_criticas INT DEFAULT 0,
  stock_bajo_count INT DEFAULT 0,
  saldo_critico BOOLEAN DEFAULT false,

  -- Pólizas
  polizas_generadas INT,

  -- Proyección
  saldo_minimo_30_dias DECIMAL(15,2),
  dias_criticos_proximos INT,

  -- Control
  fecha_actualizacion TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_dashboard_cache_empresa ON dashboard_cache(empresa_id);

-- ============================================================================
-- VISTA: Movimientos integrados con contexto completo
-- ============================================================================

CREATE OR REPLACE VIEW movimientos_financieros_integrados AS
SELECT
  m.id,
  m.empresa_id,
  m.tipo_movimiento,
  m.monto,
  m.estado_pago,
  m.estado_registro,
  m.estado_contable,
  m.fecha_evento,
  m.es_reconciliado,
  m.requiere_revision,

  -- Origen del movimiento (trazabilidad)
  CASE
    WHEN m.gasto_id IS NOT NULL THEN 'GastoCheck'
    WHEN m.factura_id IS NOT NULL THEN 'CobraCheck'
    WHEN m.banco_movimiento_id IS NOT NULL THEN 'BancoCheck'
    ELSE 'Manual'
  END AS origen,

  -- Referencias
  m.gasto_id,
  m.factura_id,
  m.banco_movimiento_id,
  m.poliza_id,

  -- Reconciliación (estado)
  CASE
    WHEN m.estado_pago = 'PAGADO' AND m.banco_movimiento_id IS NOT NULL THEN 'Completa'
    WHEN m.estado_pago = 'PAGADO' THEN 'Parcial'
    WHEN m.estado_pago = 'PENDIENTE' AND m.banco_movimiento_id IS NULL THEN 'Pendiente'
    ELSE 'Desconocido'
  END AS estado_reconciliacion,

  -- Análisis (para CheckIA)
  m.categoria,
  m.concepto,

  -- Auditoría
  m.created_at,
  m.updated_at

FROM movimientos_financieros m;

-- ============================================================================
-- RLS: Políticas para alertas
-- ============================================================================

ALTER TABLE alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alertas: usuarios de empresa pueden leer"
  ON alertas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM empresa_usuarios
      WHERE empresa_usuarios.empresa_id = alertas.empresa_id
      AND empresa_usuarios.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Alertas: sistema puede insertar"
  ON alertas FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Alertas: usuarios pueden marcar como leída"
  ON alertas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM empresa_usuarios
      WHERE empresa_usuarios.empresa_id = alertas.empresa_id
      AND empresa_usuarios.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM empresa_usuarios
      WHERE empresa_usuarios.empresa_id = alertas.empresa_id
      AND empresa_usuarios.usuario_id = auth.uid()
    )
  );

-- ============================================================================
-- FUNCIÓN: Actualizar cache del dashboard automáticamente
-- ============================================================================

CREATE OR REPLACE FUNCTION actualizar_dashboard_cache()
RETURNS TRIGGER AS $$
DECLARE
  v_empresa_id UUID;
  v_gastos DECIMAL;
  v_ingresos DECIMAL;
  v_total_movimientos INT;
  v_pagados INT;
  v_porcentaje DECIMAL;
BEGIN
  v_empresa_id := NEW.empresa_id;

  -- Calcular KPIs
  SELECT
    COALESCE(SUM(CASE WHEN tipo_movimiento = 'GASTO' THEN ABS(monto) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo_movimiento = 'INGRESO' THEN monto ELSE 0 END), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE estado_pago = 'PAGADO')
  INTO v_gastos, v_ingresos, v_total_movimientos, v_pagados
  FROM movimientos_financieros
  WHERE empresa_id = v_empresa_id;

  v_porcentaje := CASE
    WHEN v_total_movimientos > 0 THEN ROUND((v_pagados::DECIMAL / v_total_movimientos) * 100, 2)
    ELSE 0
  END;

  -- Actualizar o insertar en cache
  INSERT INTO dashboard_cache (
    empresa_id,
    gastos_totales,
    ingresos_totales,
    saldo_actual,
    movimientos_total,
    movimientos_pagados,
    porcentaje_reconciliacion
  ) VALUES (
    v_empresa_id,
    v_gastos,
    v_ingresos,
    v_ingresos - v_gastos,
    v_total_movimientos,
    v_pagados,
    v_porcentaje
  )
  ON CONFLICT (empresa_id) DO UPDATE SET
    gastos_totales = v_gastos,
    ingresos_totales = v_ingresos,
    saldo_actual = v_ingresos - v_gastos,
    movimientos_total = v_total_movimientos,
    movimientos_pagados = v_pagados,
    porcentaje_reconciliacion = v_porcentaje,
    fecha_actualizacion = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: cuando se inserta/actualiza movimiento, actualizar cache
DROP TRIGGER IF EXISTS trigger_actualizar_cache ON movimientos_financieros;
CREATE TRIGGER trigger_actualizar_cache
  AFTER INSERT OR UPDATE ON movimientos_financieros
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_dashboard_cache();
