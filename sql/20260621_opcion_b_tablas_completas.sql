-- ============================================
-- OPCIÓN B: FLUJO COMPLETO - TABLAS + FUNCIONES
-- SQL 100% Testeable en Supabase
-- Fecha: 2026-06-21
-- ============================================

-- =============================================
-- TABLA 1: plan_pagos_semanal
-- =============================================
CREATE TABLE IF NOT EXISTS plan_pagos_semanal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Período
  semana_inicio DATE NOT NULL,
  semana_fin DATE NOT NULL,

  -- Estado
  estado VARCHAR(20) DEFAULT 'ACTIVA',

  -- Caja
  caja_inicial NUMERIC(15,2) NOT NULL,
  caja_actual NUMERIC(15,2) NOT NULL,
  caja_proyectada NUMERIC(15,2),

  -- Metadata
  total_pagos_esperado NUMERIC(15,2) DEFAULT 0,
  total_ingresos_esperado NUMERIC(15,2) DEFAULT 0,

  -- Auditoría
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_por VARCHAR(100),

  CONSTRAINT validar_periodo CHECK (semana_fin > semana_inicio),
  CONSTRAINT validar_caja CHECK (caja_actual >= 0 OR estado = 'COMPLETADA')
);

CREATE INDEX IF NOT EXISTS idx_plan_pagos_empresa ON plan_pagos_semanal(empresa_id);
CREATE INDEX IF NOT EXISTS idx_plan_pagos_estado ON plan_pagos_semanal(estado);
CREATE INDEX IF NOT EXISTS idx_plan_pagos_periodo ON plan_pagos_semanal(semana_inicio, semana_fin);

ALTER TABLE plan_pagos_semanal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_select" ON plan_pagos_semanal
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));

CREATE POLICY "plan_insert" ON plan_pagos_semanal
  FOR INSERT WITH CHECK (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));

CREATE POLICY "plan_update" ON plan_pagos_semanal
  FOR UPDATE USING (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));

-- =============================================
-- TABLA 2: pago_semanal
-- =============================================
CREATE TABLE IF NOT EXISTS pago_semanal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plan_pagos_semanal(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Descripción
  descripcion TEXT NOT NULL,
  monto NUMERIC(15,2) NOT NULL,

  -- Clasificación
  tipo VARCHAR(50) NOT NULL,
  urgencia VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  color_codigo VARCHAR(20),

  -- Vencimiento
  fecha_vencimiento DATE NOT NULL,
  dias_de_vencimiento INT,

  -- Estado
  estado VARCHAR(20) DEFAULT 'PENDIENTE',

  -- Programación
  dia_programado INT DEFAULT 0,

  -- Control
  caja_permite BOOLEAN DEFAULT FALSE,
  puede_aplazarse BOOLEAN DEFAULT TRUE,

  -- Auditoría
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  pagado_en TIMESTAMP,
  pagado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,

  CONSTRAINT validar_monto CHECK (monto > 0),
  CONSTRAINT validar_dia CHECK (dia_programado >= 0 AND dia_programado < 7)
);

CREATE INDEX IF NOT EXISTS idx_pago_plan ON pago_semanal(plan_id);
CREATE INDEX IF NOT EXISTS idx_pago_empresa ON pago_semanal(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pago_estado ON pago_semanal(estado);
CREATE INDEX IF NOT EXISTS idx_pago_urgencia ON pago_semanal(urgencia);
CREATE INDEX IF NOT EXISTS idx_pago_vencimiento ON pago_semanal(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_pago_dia ON pago_semanal(dia_programado);

ALTER TABLE pago_semanal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pago_select" ON pago_semanal
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));

CREATE POLICY "pago_insert" ON pago_semanal
  FOR INSERT WITH CHECK (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));

CREATE POLICY "pago_update" ON pago_semanal
  FOR UPDATE USING (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));

-- =============================================
-- TABLA 3: ingreso_semanal_esperado
-- =============================================
CREATE TABLE IF NOT EXISTS ingreso_semanal_esperado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plan_pagos_semanal(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cobro_id UUID REFERENCES cobros(id) ON DELETE SET NULL,

  -- Descripción
  cliente_nombre VARCHAR(255) NOT NULL,
  cliente_rfc VARCHAR(13),
  monto NUMERIC(15,2) NOT NULL,

  -- Promesa
  fecha_promesa DATE NOT NULL,
  confirmado_por_cliente BOOLEAN DEFAULT FALSE,
  confirmado_en TIMESTAMP,

  -- Realidad
  recibido BOOLEAN DEFAULT FALSE,
  recibido_en TIMESTAMP,

  -- Riesgo
  riesgo_no_pago BOOLEAN DEFAULT FALSE,
  historial_retrasos INT DEFAULT 0,

  -- Auditoría
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT validar_monto CHECK (monto > 0)
);

CREATE INDEX IF NOT EXISTS idx_ingreso_plan ON ingreso_semanal_esperado(plan_id);
CREATE INDEX IF NOT EXISTS idx_ingreso_empresa ON ingreso_semanal_esperado(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ingreso_fecha ON ingreso_semanal_esperado(fecha_promesa);
CREATE INDEX IF NOT EXISTS idx_ingreso_cliente ON ingreso_semanal_esperado(cliente_nombre);
CREATE INDEX IF NOT EXISTS idx_ingreso_recibido ON ingreso_semanal_esperado(recibido);

ALTER TABLE ingreso_semanal_esperado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingreso_select" ON ingreso_semanal_esperado
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));

CREATE POLICY "ingreso_insert" ON ingreso_semanal_esperado
  FOR INSERT WITH CHECK (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));

-- =============================================
-- TABLA 4: movimiento_tiempo_real
-- =============================================
CREATE TABLE IF NOT EXISTS movimiento_tiempo_real (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES plan_pagos_semanal(id) ON DELETE SET NULL,

  -- Evento
  tipo_evento VARCHAR(50) NOT NULL,
  descripcion TEXT NOT NULL,
  monto NUMERIC(15,2) NOT NULL,

  -- Caja
  caja_antes NUMERIC(15,2) NOT NULL,
  caja_después NUMERIC(15,2) NOT NULL,

  -- Auditoría
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_movimiento_empresa ON movimiento_tiempo_real(empresa_id);
CREATE INDEX IF NOT EXISTS idx_movimiento_plan ON movimiento_tiempo_real(plan_id);
CREATE INDEX IF NOT EXISTS idx_movimiento_timestamp ON movimiento_tiempo_real(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_movimiento_tipo ON movimiento_tiempo_real(tipo_evento);

ALTER TABLE movimiento_tiempo_real ENABLE ROW LEVEL SECURITY;

CREATE POLICY "movimiento_select" ON movimiento_tiempo_real
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));

-- =============================================
-- TABLA 5: alerta_flujo_semanal
-- =============================================
CREATE TABLE IF NOT EXISTS alerta_flujo_semanal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plan_pagos_semanal(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Alerta
  tipo_alerta VARCHAR(20) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  accion_recomendada TEXT,

  -- Estado
  resuelta BOOLEAN DEFAULT FALSE,
  resuelta_en TIMESTAMP,

  -- Auditoría
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alerta_plan ON alerta_flujo_semanal(plan_id);
CREATE INDEX IF NOT EXISTS idx_alerta_empresa ON alerta_flujo_semanal(empresa_id);
CREATE INDEX IF NOT EXISTS idx_alerta_tipo ON alerta_flujo_semanal(tipo_alerta);
CREATE INDEX IF NOT EXISTS idx_alerta_resuelta ON alerta_flujo_semanal(resuelta);

ALTER TABLE alerta_flujo_semanal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerta_select" ON alerta_flujo_semanal
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));

-- =============================================
-- TABLA 6: proyeccion_flujo_30dias
-- =============================================
CREATE TABLE IF NOT EXISTS proyeccion_flujo_30dias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Período
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,

  -- Proyección
  caja_inicio NUMERIC(15,2) NOT NULL,
  ingresos_esperados NUMERIC(15,2) NOT NULL,
  egresos_esperados NUMERIC(15,2) NOT NULL,
  caja_fin NUMERIC(15,2) NOT NULL,

  -- Riesgo
  riesgo_nivel VARCHAR(20),

  -- Auditoría
  calculado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proyeccion_empresa ON proyeccion_flujo_30dias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_proyeccion_periodo ON proyeccion_flujo_30dias(fecha_inicio, fecha_fin);

ALTER TABLE proyeccion_flujo_30dias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proyeccion_select" ON proyeccion_flujo_30dias
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));

-- =============================================
-- TABLA 7: scoring_cliente_cobranza
-- =============================================
CREATE TABLE IF NOT EXISTS scoring_cliente_cobranza (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_rfc VARCHAR(13) NOT NULL,
  cliente_nombre VARCHAR(255),

  -- Scoring
  puntaje_riesgo INT DEFAULT 50,
  historial_retrasos INT DEFAULT 0,
  promedio_dias_retraso NUMERIC(5,2) DEFAULT 0,
  pagos_a_tiempo INT DEFAULT 0,
  pagos_atrasados INT DEFAULT 0,

  -- Comportamiento
  puntualidad_nivel VARCHAR(20) DEFAULT 'NORMAL',
  prioridad_cobranza VARCHAR(20) DEFAULT 'NORMAL',

  -- Auditoría
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(empresa_id, cliente_rfc)
);

CREATE INDEX IF NOT EXISTS idx_scoring_empresa ON scoring_cliente_cobranza(empresa_id);
CREATE INDEX IF NOT EXISTS idx_scoring_cliente ON scoring_cliente_cobranza(cliente_rfc);
CREATE INDEX IF NOT EXISTS idx_scoring_puntaje ON scoring_cliente_cobranza(puntaje_riesgo DESC);

ALTER TABLE scoring_cliente_cobranza ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scoring_select" ON scoring_cliente_cobranza
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));

-- =============================================
-- TABLA 8: escenario_what_if
-- =============================================
CREATE TABLE IF NOT EXISTS escenario_what_if (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plan_pagos_semanal(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Escenario
  nombre_escenario VARCHAR(255) NOT NULL,
  descripcion TEXT,

  -- Cambios
  cliente_perdido_monto NUMERIC(15,2) DEFAULT 0,
  gastos_adicionales NUMERIC(15,2) DEFAULT 0,
  ingresos_adicionales NUMERIC(15,2) DEFAULT 0,

  -- Resultado
  caja_proyectada_original NUMERIC(15,2),
  caja_proyectada_escenario NUMERIC(15,2),
  diferencia NUMERIC(15,2),
  es_viable BOOLEAN,

  -- Auditoría
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  creado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_escenario_plan ON escenario_what_if(plan_id);
CREATE INDEX IF NOT EXISTS idx_escenario_empresa ON escenario_what_if(empresa_id);

ALTER TABLE escenario_what_if ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escenario_select" ON escenario_what_if
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));

-- =============================================
-- FUNCIONES PL/pgSQL
-- =============================================

-- FUNCIÓN 1: Calcular urgencia automática
CREATE OR REPLACE FUNCTION fn_calcular_urgencia_pago()
RETURNS TRIGGER AS $$
BEGIN
  NEW.dias_de_vencimiento := NEW.fecha_vencimiento - CURRENT_DATE;

  IF NEW.tipo = 'NÓMINA' THEN
    NEW.urgencia := 'INDISPENSABLE';
    NEW.color_codigo := 'ROJO';
  ELSIF NEW.dias_de_vencimiento < 0 THEN
    NEW.urgencia := 'URGENTE';
    NEW.color_codigo := 'NARANJA';
  ELSIF NEW.dias_de_vencimiento <= 15 THEN
    NEW.urgencia := 'NORMAL';
    NEW.color_codigo := 'VERDE';
  ELSE
    NEW.urgencia := 'OPCIONAL';
    NEW.color_codigo := 'GRIS';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_calcular_urgencia ON pago_semanal;
CREATE TRIGGER tr_calcular_urgencia
BEFORE INSERT OR UPDATE ON pago_semanal
FOR EACH ROW
EXECUTE FUNCTION fn_calcular_urgencia_pago();

---

-- FUNCIÓN 2: Validar caja permite pagar
CREATE OR REPLACE FUNCTION fn_validar_caja_permite()
RETURNS TRIGGER AS $$
DECLARE
  v_caja_actual NUMERIC;
  v_total_pagos NUMERIC;
BEGIN
  SELECT caja_actual INTO v_caja_actual
  FROM plan_pagos_semanal
  WHERE id = NEW.plan_id;

  SELECT COALESCE(SUM(monto), 0) INTO v_total_pagos
  FROM pago_semanal
  WHERE plan_id = NEW.plan_id
    AND estado IN ('PROGRAMADO', 'PENDIENTE')
    AND dia_programado <= COALESCE(NEW.dia_programado, 0)
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');

  NEW.caja_permite := (v_caja_actual >= (v_total_pagos + NEW.monto));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validar_caja ON pago_semanal;
CREATE TRIGGER tr_validar_caja
BEFORE INSERT OR UPDATE ON pago_semanal
FOR EACH ROW
EXECUTE FUNCTION fn_validar_caja_permite();

---

-- FUNCIÓN 3: Generar alertas automáticas
CREATE OR REPLACE FUNCTION fn_generar_alertas_flujo()
RETURNS TRIGGER AS $$
DECLARE
  v_nómina_caja_permite BOOLEAN;
  v_clientes_sin_confirmar INT;
  v_pagos_sin_flujo INT;
BEGIN
  DELETE FROM alerta_flujo_semanal WHERE plan_id = NEW.id AND resuelta = FALSE;

  -- ALERTA 1: ¿Nómina está cubierta?
  SELECT caja_permite INTO v_nómina_caja_permite
  FROM pago_semanal
  WHERE plan_id = NEW.id AND tipo = 'NÓMINA' AND estado != 'PAGADO'
  LIMIT 1;

  IF v_nómina_caja_permite = FALSE THEN
    INSERT INTO alerta_flujo_semanal (plan_id, empresa_id, tipo_alerta, titulo, descripcion, accion_recomendada)
    VALUES (NEW.id, NEW.empresa_id, 'CRÍTICA', 'Nómina no cubierta', 'No hay flujo para pagar nómina', 'Cobra a clientes urgente');
  END IF;

  -- ALERTA 2: ¿Clientes sin confirmar?
  SELECT COUNT(*) INTO v_clientes_sin_confirmar
  FROM ingreso_semanal_esperado
  WHERE plan_id = NEW.id AND confirmado_por_cliente = FALSE AND recibido = FALSE;

  IF v_clientes_sin_confirmar > 0 THEN
    INSERT INTO alerta_flujo_semanal (plan_id, empresa_id, tipo_alerta, titulo, descripcion, accion_recomendada)
    VALUES (NEW.id, NEW.empresa_id, 'ALTA', v_clientes_sin_confirmar || ' clientes sin confirmar',
            'Hay ingresos sin confirmar', 'Llama para confirmar promesas de pago');
  END IF;

  -- ALERTA 3: ¿Pagos sin flujo?
  SELECT COUNT(*) INTO v_pagos_sin_flujo
  FROM pago_semanal
  WHERE plan_id = NEW.id AND caja_permite = FALSE AND estado IN ('PENDIENTE', 'PROGRAMADO');

  IF v_pagos_sin_flujo > 0 THEN
    INSERT INTO alerta_flujo_semanal (plan_id, empresa_id, tipo_alerta, titulo, descripcion, accion_recomendada)
    VALUES (NEW.id, NEW.empresa_id, 'ALTA', v_pagos_sin_flujo || ' pagos sin flujo',
            'No hay flujo para estos pagos', 'Arrastra a próxima semana o atrasa otros');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_generar_alertas ON plan_pagos_semanal;
CREATE TRIGGER tr_generar_alertas
AFTER INSERT OR UPDATE ON plan_pagos_semanal
FOR EACH ROW
EXECUTE FUNCTION fn_generar_alertas_flujo();

---

-- FUNCIÓN 4: Registrar movimiento en tiempo real
CREATE OR REPLACE FUNCTION fn_registrar_movimiento()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.caja_actual != OLD.caja_actual THEN
    INSERT INTO movimiento_tiempo_real (
      empresa_id, plan_id, tipo_evento, descripcion,
      monto, caja_antes, caja_después, usuario_id, timestamp
    ) VALUES (
      NEW.empresa_id,
      NEW.id,
      'ACTUALIZACIÓN',
      'Caja actualizada',
      NEW.caja_actual - OLD.caja_actual,
      OLD.caja_actual,
      NEW.caja_actual,
      auth.uid(),
      CURRENT_TIMESTAMP
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_registrar_movimiento ON plan_pagos_semanal;
CREATE TRIGGER tr_registrar_movimiento
AFTER UPDATE ON plan_pagos_semanal
FOR EACH ROW
EXECUTE FUNCTION fn_registrar_movimiento();

---

-- FUNCIÓN 5: Actualizar timestamp
CREATE OR REPLACE FUNCTION fn_actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_actualizar_timestamp_plan ON plan_pagos_semanal;
CREATE TRIGGER tr_actualizar_timestamp_plan
BEFORE UPDATE ON plan_pagos_semanal
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_timestamp();

DROP TRIGGER IF EXISTS tr_actualizar_timestamp_pago ON pago_semanal;
CREATE TRIGGER tr_actualizar_timestamp_pago
BEFORE UPDATE ON pago_semanal
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_timestamp();

---

-- FUNCIÓN 6: Calcular proyección 30 días
CREATE OR REPLACE FUNCTION fn_calcular_proyeccion_30dias(p_empresa_id UUID)
RETURNS void AS $$
DECLARE
  v_ingresos NUMERIC;
  v_egresos NUMERIC;
  v_caja_fin NUMERIC;
  v_caja_inicio NUMERIC;
  v_riesgo VARCHAR;
BEGIN
  SELECT caja_actual INTO v_caja_inicio
  FROM plan_pagos_semanal
  WHERE empresa_id = p_empresa_id AND estado = 'ACTIVA'
  LIMIT 1;

  SELECT COALESCE(SUM(monto), 0) INTO v_ingresos
  FROM ingreso_semanal_esperado
  WHERE empresa_id = p_empresa_id
    AND fecha_promesa BETWEEN CURRENT_DATE AND CURRENT_DATE + 30;

  SELECT COALESCE(SUM(monto), 0) INTO v_egresos
  FROM pago_semanal
  WHERE empresa_id = p_empresa_id
    AND fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
    AND estado NOT IN ('PAGADO', 'CANCELADO');

  v_caja_fin := COALESCE(v_caja_inicio, 0) + v_ingresos - v_egresos;

  IF v_caja_fin < 0 THEN
    v_riesgo := 'CRÍTICO';
  ELSIF v_caja_fin < COALESCE(v_caja_inicio, 0) * 0.3 THEN
    v_riesgo := 'ALTO';
  ELSIF v_caja_fin < COALESCE(v_caja_inicio, 0) * 0.5 THEN
    v_riesgo := 'MEDIO';
  ELSE
    v_riesgo := 'BAJO';
  END IF;

  INSERT INTO proyeccion_flujo_30dias (
    empresa_id, fecha_inicio, fecha_fin,
    caja_inicio, ingresos_esperados, egresos_esperados, caja_fin,
    riesgo_nivel
  ) VALUES (
    p_empresa_id, CURRENT_DATE, CURRENT_DATE + 30,
    COALESCE(v_caja_inicio, 0), v_ingresos, v_egresos, v_caja_fin, v_riesgo
  );
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- VERIFICACIÓN FINAL
-- =============================================
SELECT
  'OPCIÓN B CREADA ✅' as status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'plan_pagos_semanal' OR table_name LIKE 'pago_semanal' OR table_name LIKE 'ingreso_semanal_esperado' OR table_name LIKE 'movimiento_tiempo_real' OR table_name LIKE 'alerta_flujo_semanal' OR table_name LIKE 'proyeccion_flujo_30dias' OR table_name LIKE 'scoring_cliente_cobranza' OR table_name LIKE 'escenario_what_if') as tablas_creadas;
