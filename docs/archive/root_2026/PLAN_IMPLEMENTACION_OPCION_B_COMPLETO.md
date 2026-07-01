# 🚀 PLAN IMPLEMENTACIÓN OPCIÓN B - FLUJO COMPLETO (3 Semanas)

**Para:** Daniel (Desarrollador)  
**Objetivo:** Implementar Flujo de Efectivo Integrado (Opción B)  
**Tiempo Total:** 3 semanas (15 días hábiles)  
**Costo:** $8,000  
**Fecha de Inicio:** Mañana  

---

## 📋 RESUMEN EJECUTIVO

```
OPCIÓN B incluye:
✅ Proyección de caja 30 días
✅ Alertas de riesgo
✅ Cobranza prioritaria
✅ Planeador semanal tiempo real (drag & drop)
✅ Análisis CCC
✅ Escenarios (what-if)
✅ Dashboard unificado
✅ Reportes automáticos

ENTREGABLE FINAL:
- 8 tablas nuevas
- 6 edge functions
- 4 API routes
- 3 componentes React principales
- 15+ triggers y funciones PL/pgSQL
- Dashboard integrado
```

---

## 📅 PLAN SEMANAL DETALLADO

### **SEMANA 1: BASE DE DATOS + EDGE FUNCTIONS**

#### **DÍA 1-2: Crear Tablas Base**

```sql
-- TABLA 1: plan_pagos_semanal
CREATE TABLE plan_pagos_semanal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  
  -- Período
  semana_inicio DATE NOT NULL,
  semana_fin DATE NOT NULL,
  
  -- Estado
  estado VARCHAR(20) DEFAULT 'ACTIVA', -- ACTIVA, COMPLETADA, CANCELADA
  
  -- Caja
  caja_inicial NUMERIC(15,2) NOT NULL,
  caja_actual NUMERIC(15,2) NOT NULL,
  caja_proyectada NUMERIC(15,2),
  
  -- Metadata
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_por VARCHAR(100),
  
  -- Auditoría
  total_pagos_esperado NUMERIC(15,2),
  total_ingresos_esperado NUMERIC(15,2),
  
  CONSTRAINT validar_periodo CHECK (semana_fin > semana_inicio)
);

-- Índices
CREATE INDEX idx_plan_pagos_empresa ON plan_pagos_semanal(empresa_id);
CREATE INDEX idx_plan_pagos_estado ON plan_pagos_semanal(estado);
CREATE INDEX idx_plan_pagos_periodo ON plan_pagos_semanal(semana_inicio, semana_fin);

-- RLS
ALTER TABLE plan_pagos_semanal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresas ven sus planes" ON plan_pagos_semanal
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "Empresas crean sus planes" ON plan_pagos_semanal
  FOR INSERT WITH CHECK (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "Empresas actualizan sus planes" ON plan_pagos_semanal
  FOR UPDATE USING (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));

---

-- TABLA 2: pago_semanal
CREATE TABLE pago_semanal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plan_pagos_semanal(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  
  -- Descripción
  descripcion TEXT NOT NULL,
  monto NUMERIC(15,2) NOT NULL,
  
  -- Clasificación
  tipo VARCHAR(50) NOT NULL, -- NÓMINA, PROVEEDOR, SERVICIO, OTRO, IMPUESTO
  urgencia VARCHAR(20) NOT NULL, -- INDISPENSABLE, URGENTE, NORMAL, OPCIONAL
  color_codigo VARCHAR(20), -- ROJO, NARANJA, VERDE, GRIS
  
  -- Vencimiento
  fecha_vencimiento DATE NOT NULL,
  dias_de_vencimiento INT, -- Calculado: fecha_vencimiento - hoy
  
  -- Estado
  estado VARCHAR(20) DEFAULT 'PENDIENTE', -- PENDIENTE, PROGRAMADO, ARRASTRADO, PAGADO, CANCELADO
  
  -- Programación
  dia_programado INT, -- 0=lunes, 1=martes, etc
  
  -- Control
  caja_permite BOOLEAN DEFAULT FALSE, -- ¿Hay flujo para pagar esto?
  puede_aplazarse BOOLEAN DEFAULT TRUE,
  
  -- Auditoría
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  pagado_en TIMESTAMP,
  pagado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  
  CONSTRAINT validar_monto CHECK (monto > 0)
);

-- Índices
CREATE INDEX idx_pago_plan ON pago_semanal(plan_id);
CREATE INDEX idx_pago_empresa ON pago_semanal(empresa_id);
CREATE INDEX idx_pago_estado ON pago_semanal(estado);
CREATE INDEX idx_pago_urgencia ON pago_semanal(urgencia);
CREATE INDEX idx_pago_vencimiento ON pago_semanal(fecha_vencimiento);
CREATE INDEX idx_pago_dia ON pago_semanal(dia_programado);

-- RLS
ALTER TABLE pago_semanal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresas ven sus pagos" ON pago_semanal
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));

---

-- TABLA 3: ingreso_semanal_esperado
CREATE TABLE ingreso_semanal_esperado (
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
  riesgo_no_pago BOOLEAN DEFAULT FALSE, -- Basado en histórico
  historial_retrasos INT, -- Cuántas veces se atrasó
  
  -- Auditoría
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT validar_monto CHECK (monto > 0)
);

-- Índices
CREATE INDEX idx_ingreso_plan ON ingreso_semanal_esperado(plan_id);
CREATE INDEX idx_ingreso_empresa ON ingreso_semanal_esperado(empresa_id);
CREATE INDEX idx_ingreso_fecha ON ingreso_semanal_esperado(fecha_promesa);
CREATE INDEX idx_ingreso_cliente ON ingreso_semanal_esperado(cliente_nombre);
CREATE INDEX idx_ingreso_riesgo ON ingreso_semanal_esperado(riesgo_no_pago);

-- RLS
ALTER TABLE ingreso_semanal_esperado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresas ven sus ingresos" ON ingreso_semanal_esperado
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));

---

-- TABLA 4: movimiento_tiempo_real
CREATE TABLE movimiento_tiempo_real (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES plan_pagos_semanal(id) ON DELETE SET NULL,
  
  -- Evento
  tipo_evento VARCHAR(50) NOT NULL, -- INGRESO, EGRESO, ARRASTRE, ADELANTO, CANCELACIÓN
  descripcion TEXT NOT NULL,
  monto NUMERIC(15,2) NOT NULL,
  
  -- Caja
  caja_antes NUMERIC(15,2) NOT NULL,
  caja_después NUMERIC(15,2) NOT NULL,
  
  -- Auditoría
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT validar_coherencia CHECK (caja_después = caja_antes + monto OR caja_después = caja_antes - monto)
);

-- Índices
CREATE INDEX idx_movimiento_empresa ON movimiento_tiempo_real(empresa_id);
CREATE INDEX idx_movimiento_plan ON movimiento_tiempo_real(plan_id);
CREATE INDEX idx_movimiento_timestamp ON movimiento_tiempo_real(timestamp DESC);
CREATE INDEX idx_movimiento_tipo ON movimiento_tiempo_real(tipo_evento);

-- RLS
ALTER TABLE movimiento_tiempo_real ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresas ven su historial" ON movimiento_tiempo_real
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));

---

-- TABLA 5: alerta_flujo_semanal
CREATE TABLE alerta_flujo_semanal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plan_pagos_semanal(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  
  -- Alerta
  tipo_alerta VARCHAR(50) NOT NULL, -- CRÍTICA, ALTA, MEDIA, BAJA
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  
  -- Acción recomendada
  accion_recomendada TEXT,
  
  -- Estado
  resuelta BOOLEAN DEFAULT FALSE,
  resuelta_en TIMESTAMP,
  
  -- Auditoría
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_alerta_plan ON alerta_flujo_semanal(plan_id);
CREATE INDEX idx_alerta_empresa ON alerta_flujo_semanal(empresa_id);
CREATE INDEX idx_alerta_tipo ON alerta_flujo_semanal(tipo_alerta);
CREATE INDEX idx_alerta_resuelta ON alerta_flujo_semanal(resuelta);

-- RLS
ALTER TABLE alerta_flujo_semanal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresas ven sus alertas" ON alerta_flujo_semanal
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));

---

-- TABLA 6: proyeccion_flujo_30dias
CREATE TABLE proyeccion_flujo_30dias (
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
  riesgo_nivel VARCHAR(20), -- BAJO, MEDIO, ALTO, CRÍTICO
  dias_criticos INT[], -- Qué días caja es negativa
  
  -- Auditoría
  calculado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  proxima_actualizacion TIMESTAMP
);

-- RLS
ALTER TABLE proyeccion_flujo_30dias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresas ven su proyección" ON proyeccion_flujo_30dias
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));

---

-- TABLA 7: scoring_cliente_cobranza
CREATE TABLE scoring_cliente_cobranza (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_rfc VARCHAR(13) NOT NULL,
  cliente_nombre VARCHAR(255),
  
  -- Scoring
  puntaje_riesgo INT, -- 0-100 (100 = máximo riesgo)
  historial_retrasos INT,
  promedio_dias_retraso NUMERIC(5,2),
  pagos_a_tiempo INT,
  pagos_atrasados INT,
  
  -- Comportamiento
  puntualidad_nivel VARCHAR(20), -- EXCELENTE, BUENO, NORMAL, MALO, PÉSIMO
  
  -- Recomendación
  prioridad_cobranza VARCHAR(20), -- URGENTE, ALTA, NORMAL, BAJA
  
  -- Auditoría
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_scoring_empresa ON scoring_cliente_cobranza(empresa_id);
CREATE INDEX idx_scoring_cliente ON scoring_cliente_cobranza(cliente_rfc);
CREATE INDEX idx_scoring_puntaje ON scoring_cliente_cobranza(puntaje_riesgo DESC);
CREATE INDEX idx_scoring_prioridad ON scoring_cliente_cobranza(prioridad_cobranza);

-- RLS
ALTER TABLE scoring_cliente_cobranza ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresas ven su scoring" ON scoring_cliente_cobranza
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));

---

-- TABLA 8: escenario_what_if
CREATE TABLE escenario_what_if (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plan_pagos_semanal(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  
  -- Escenario
  nombre_escenario VARCHAR(255) NOT NULL,
  descripcion TEXT,
  
  -- Cambios
  cliente_perdido_id UUID REFERENCES cobros(id),
  cliente_perdido_monto NUMERIC(15,2),
  gastos_adicionales NUMERIC(15,2),
  ingresos_adicionales NUMERIC(15,2),
  
  -- Resultado
  caja_proyectada_original NUMERIC(15,2),
  caja_proyectada_escenario NUMERIC(15,2),
  diferencia NUMERIC(15,2),
  es_viable BOOLEAN,
  
  -- Auditoría
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  creado_por UUID REFERENCES usuarios(id)
);

-- RLS
ALTER TABLE escenario_what_if ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresas ven sus escenarios" ON escenario_what_if
  FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = auth.uid()));
```

**TIEMPO:** 4 horas
**CHECKLIST:**
- [ ] Crear 8 tablas
- [ ] Crear 20+ índices
- [ ] Activar RLS en todas
- [ ] Crear 10+ policies
- [ ] Verificar integridad referencial

---

#### **DÍA 3-4: Funciones PL/pgSQL + Triggers**

```sql
-- FUNCIÓN 1: Calcular urgencia automática
CREATE OR REPLACE FUNCTION calcular_urgencia_pago()
RETURNS TRIGGER AS $$
BEGIN
  NEW.dias_de_vencimiento := NEW.fecha_vencimiento - CURRENT_DATE;
  
  IF NEW.tipo = 'NÓMINA' THEN
    NEW.urgencia := 'INDISPENSABLE';
    NEW.color_codigo := 'ROJO';
  ELSIF NEW.dias_de_vencimiento <= 0 THEN
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

CREATE TRIGGER tr_calcular_urgencia
BEFORE INSERT OR UPDATE ON pago_semanal
FOR EACH ROW
EXECUTE FUNCTION calcular_urgencia_pago();

---

-- FUNCIÓN 2: Validar caja permite pagar
CREATE OR REPLACE FUNCTION validar_caja_permite()
RETURNS TRIGGER AS $$
DECLARE
  v_caja_actual NUMERIC;
  v_total_pagos_restantes NUMERIC;
BEGIN
  -- Obtener caja actual del plan
  SELECT caja_actual INTO v_caja_actual
  FROM plan_pagos_semanal
  WHERE id = NEW.plan_id;
  
  -- Obtener total de pagos programados hasta ese día
  SELECT COALESCE(SUM(monto), 0) INTO v_total_pagos_restantes
  FROM pago_semanal
  WHERE plan_id = NEW.plan_id
    AND estado IN ('PROGRAMADO', 'PENDIENTE')
    AND dia_programado <= NEW.dia_programado
    AND id != NEW.id;
  
  -- ¿Hay caja?
  NEW.caja_permite := (v_caja_actual >= (v_total_pagos_restantes + NEW.monto));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_validar_caja
BEFORE INSERT OR UPDATE ON pago_semanal
FOR EACH ROW
EXECUTE FUNCTION validar_caja_permite();

---

-- FUNCIÓN 3: Generar alertas automáticas
CREATE OR REPLACE FUNCTION generar_alertas_flujo()
RETURNS TRIGGER AS $$
DECLARE
  v_nómina_existe BOOLEAN;
  v_nómina_caja_permite BOOLEAN;
  v_clientes_sin_confirmar INT;
  v_pagos_sin_flujo INT;
BEGIN
  DELETE FROM alerta_flujo_semanal WHERE plan_id = NEW.id;
  
  -- ALERTA 1: ¿Nómina está cubierta?
  SELECT COUNT(*) INTO v_nómina_existe
  FROM pago_semanal
  WHERE plan_id = NEW.id
    AND tipo = 'NÓMINA';
  
  IF v_nómina_existe = 0 THEN
    INSERT INTO alerta_flujo_semanal (plan_id, empresa_id, tipo_alerta, titulo, descripcion, accion_recomendada)
    VALUES (NEW.id, NEW.empresa_id, 'CRÍTICA', 'Nómina no programada', 'No hay nómina para esta semana', 'Programa nómina en el día correspondiente');
  END IF;
  
  SELECT caja_permite INTO v_nómina_caja_permite
  FROM pago_semanal
  WHERE plan_id = NEW.id AND tipo = 'NÓMINA'
  LIMIT 1;
  
  IF v_nómina_caja_permite = FALSE THEN
    INSERT INTO alerta_flujo_semanal (plan_id, empresa_id, tipo_alerta, titulo, descripcion, accion_recomendada)
    VALUES (NEW.id, NEW.empresa_id, 'CRÍTICA', 'Nómina no cubierta', 'No hay flujo suficiente para pagar nómina', 'Cobra a clientes urgente o atrasa otros pagos');
  END IF;
  
  -- ALERTA 2: ¿Clientes sin confirmar?
  SELECT COUNT(*) INTO v_clientes_sin_confirmar
  FROM ingreso_semanal_esperado
  WHERE plan_id = NEW.id
    AND confirmado_por_cliente = FALSE;
  
  IF v_clientes_sin_confirmar > 0 THEN
    INSERT INTO alerta_flujo_semanal (plan_id, empresa_id, tipo_alerta, titulo, descripcion, accion_recomendada)
    VALUES (NEW.id, NEW.empresa_id, 'ALTA', v_clientes_sin_confirmar || ' clientes sin confirmar', 'Hay ' || v_clientes_sin_confirmar || ' clientes que aún no confirmaron su pago', 'Llama para confirmar estas promesas de pago');
  END IF;
  
  -- ALERTA 3: ¿Pagos sin flujo?
  SELECT COUNT(*) INTO v_pagos_sin_flujo
  FROM pago_semanal
  WHERE plan_id = NEW.id
    AND caja_permite = FALSE;
  
  IF v_pagos_sin_flujo > 0 THEN
    INSERT INTO alerta_flujo_semanal (plan_id, empresa_id, tipo_alerta, titulo, descripcion, accion_recomendada)
    VALUES (NEW.id, NEW.empresa_id, 'ALTA', v_pagos_sin_flujo || ' pagos sin flujo', 'Hay ' || v_pagos_sin_flujo || ' pagos que no puedes hacer esta semana', 'Arrastra estos pagos a próxima semana o atrasa otros');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_generar_alertas
AFTER INSERT OR UPDATE ON plan_pagos_semanal
FOR EACH ROW
EXECUTE FUNCTION generar_alertas_flujo();

---

-- FUNCIÓN 4: Registrar movimiento en tiempo real
CREATE OR REPLACE FUNCTION registrar_movimiento()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO movimiento_tiempo_real (
    empresa_id, plan_id, tipo_evento, descripcion,
    monto, caja_antes, caja_después, usuario_id
  ) VALUES (
    NEW.empresa_id, NEW.id, 'ACTUALIZACIÓN', 'Caja actualizada',
    NEW.caja_actual - COALESCE(OLD.caja_actual, NEW.caja_actual),
    COALESCE(OLD.caja_actual, NEW.caja_actual),
    NEW.caja_actual,
    auth.uid()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_registrar_movimiento
AFTER UPDATE ON plan_pagos_semanal
FOR EACH ROW
EXECUTE FUNCTION registrar_movimiento();

---

-- FUNCIÓN 5: Calcular proyección 30 días
CREATE OR REPLACE FUNCTION calcular_proyeccion_30dias()
RETURNS TRIGGER AS $$
DECLARE
  v_ingresos NUMERIC;
  v_egresos NUMERIC;
  v_caja_fin NUMERIC;
BEGIN
  SELECT COALESCE(SUM(monto), 0) INTO v_ingresos
  FROM ingreso_semanal_esperado
  WHERE empresa_id = NEW.empresa_id
    AND fecha_promesa BETWEEN CURRENT_DATE AND CURRENT_DATE + 30;
  
  SELECT COALESCE(SUM(monto), 0) INTO v_egresos
  FROM pago_semanal
  WHERE empresa_id = NEW.empresa_id
    AND fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30;
  
  v_caja_fin := NEW.caja_actual + v_ingresos - v_egresos;
  
  INSERT INTO proyeccion_flujo_30dias (
    empresa_id, fecha_inicio, fecha_fin,
    caja_inicio, ingresos_esperados, egresos_esperados, caja_fin,
    riesgo_nivel
  ) VALUES (
    NEW.empresa_id, CURRENT_DATE, CURRENT_DATE + 30,
    NEW.caja_actual, v_ingresos, v_egresos, v_caja_fin,
    CASE 
      WHEN v_caja_fin < 0 THEN 'CRÍTICO'
      WHEN v_caja_fin < NEW.caja_actual * 0.3 THEN 'ALTO'
      WHEN v_caja_fin < NEW.caja_actual * 0.5 THEN 'MEDIO'
      ELSE 'BAJO'
    END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_calcular_proyeccion
AFTER INSERT OR UPDATE ON plan_pagos_semanal
FOR EACH ROW
EXECUTE FUNCTION calcular_proyeccion_30dias();

---

-- FUNCIÓN 6: Scoring automático de cliente
CREATE OR REPLACE FUNCTION calcular_scoring_cliente()
RETURNS TRIGGER AS $$
DECLARE
  v_pagos_a_tiempo INT;
  v_pagos_atrasados INT;
  v_promedio_retraso NUMERIC;
  v_puntaje INT;
BEGIN
  SELECT 
    COUNT(CASE WHEN DATE(fecha_pago) <= DATE(fecha_vencimiento) THEN 1 END),
    COUNT(CASE WHEN DATE(fecha_pago) > DATE(fecha_vencimiento) THEN 1 END),
    AVG(EXTRACT(DAY FROM (fecha_pago - fecha_vencimiento)))
  INTO v_pagos_a_tiempo, v_pagos_atrasados, v_promedio_retraso
  FROM cobros
  WHERE cliente_rfc = NEW.cliente_rfc
    AND empresa_id = NEW.empresa_id;
  
  v_puntaje := CASE
    WHEN v_pagos_atrasados = 0 THEN 10
    WHEN v_pagos_atrasados = 1 THEN 30
    WHEN v_promedio_retraso < 5 THEN 40
    WHEN v_promedio_retraso < 15 THEN 60
    WHEN v_promedio_retraso < 30 THEN 80
    ELSE 100
  END;
  
  INSERT INTO scoring_cliente_cobranza (
    empresa_id, cliente_rfc, cliente_nombre,
    puntaje_riesgo, historial_retrasos, promedio_dias_retraso,
    pagos_a_tiempo, pagos_atrasados, puntualidad_nivel,
    prioridad_cobranza
  ) VALUES (
    NEW.empresa_id, NEW.cliente_rfc, NEW.cliente_nombre,
    v_puntaje, v_pagos_atrasados, v_promedio_retraso,
    v_pagos_a_tiempo, v_pagos_atrasados,
    CASE
      WHEN v_puntaje <= 20 THEN 'EXCELENTE'
      WHEN v_puntaje <= 40 THEN 'BUENO'
      WHEN v_puntaje <= 60 THEN 'NORMAL'
      WHEN v_puntaje <= 80 THEN 'MALO'
      ELSE 'PÉSIMO'
    END,
    CASE
      WHEN v_puntaje >= 80 THEN 'URGENTE'
      WHEN v_puntaje >= 60 THEN 'ALTA'
      WHEN v_puntaje >= 40 THEN 'NORMAL'
      ELSE 'BAJA'
    END
  )
  ON CONFLICT (cliente_rfc) DO UPDATE SET
    puntaje_riesgo = v_puntaje,
    historial_retrasos = v_pagos_atrasados,
    promedio_dias_retraso = v_promedio_retraso,
    pagos_a_tiempo = v_pagos_a_tiempo,
    pagos_atrasados = v_pagos_atrasados;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**TIEMPO:** 6 horas
**CHECKLIST:**
- [ ] Crear 6 funciones PL/pgSQL
- [ ] Crear 6 triggers
- [ ] Testear cada función
- [ ] Verificar cascadas

---

#### **DÍA 5: Edge Functions (Deno/TypeScript)**

```typescript
// edge-function-1: crear-plan-semanal
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

serve(async (req) => {
  const { empresa_id, caja_inicial } = await req.json()

  // Obtener primer día del lunes próximo
  const hoy = new Date()
  const diferencia = hoy.getDay() === 0 ? 1 : 8 - hoy.getDay()
  const semana_inicio = new Date(hoy.getTime() + diferencia * 24 * 60 * 60 * 1000)
  const semana_fin = new Date(semana_inicio.getTime() + 6 * 24 * 60 * 60 * 1000)

  const { data, error } = await supabase
    .from('plan_pagos_semanal')
    .insert({
      empresa_id,
      semana_inicio: semana_inicio.toISOString().split('T')[0],
      semana_fin: semana_fin.toISOString().split('T')[0],
      caja_inicial,
      caja_actual: caja_inicial,
      estado: 'ACTIVA'
    })
    .select()
    .single()

  return new Response(JSON.stringify(data), { status: 201 })
})

---

// edge-function-2: actualizar-flujo-semanal (CRÍTICO: Tiempo Real)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

serve(async (req) => {
  const { empresa_id, plan_id, evento_tipo, monto, descripcion } = await req.json()

  // 1. Obtener plan actual
  const { data: plan } = await supabase
    .from('plan_pagos_semanal')
    .select('caja_actual')
    .eq('id', plan_id)
    .single()

  // 2. Calcular nueva caja
  let caja_nueva = plan.caja_actual
  if (evento_tipo === 'INGRESO') {
    caja_nueva += monto
    
    // Marcar ingreso como recibido
    await supabase
      .from('ingreso_semanal_esperado')
      .update({ recibido: true, recibido_en: new Date() })
      .eq('plan_id', plan_id)
      .like('descripcion', `%${descripcion}%`)
  } else if (evento_tipo === 'EGRESO') {
    caja_nueva -= monto
  }

  // 3. Actualizar plan
  await supabase
    .from('plan_pagos_semanal')
    .update({
      caja_actual: caja_nueva,
      actualizado_en: new Date(),
      actualizado_por: 'SISTEMA'
    })
    .eq('id', plan_id)

  // 4. Registrar movimiento
  await supabase
    .from('movimiento_tiempo_real')
    .insert({
      empresa_id,
      plan_id,
      tipo_evento: evento_tipo,
      descripcion,
      monto: evento_tipo === 'EGRESO' ? -monto : monto,
      caja_antes: plan.caja_actual,
      caja_después: caja_nueva
    })

  // 5. Recalcular validaciones de pagos
  const { data: pagos } = await supabase
    .from('pago_semanal')
    .select('id, monto')
    .eq('plan_id', plan_id)
    .eq('estado', 'PENDIENTE')

  let caja_acumulada = caja_nueva
  for (const pago of pagos) {
    const puede_pagar = caja_acumulada >= pago.monto
    
    await supabase
      .from('pago_semanal')
      .update({ caja_permite: puede_pagar })
      .eq('id', pago.id)
    
    if (puede_pagar) {
      caja_acumulada -= pago.monto
    }
  }

  return new Response(JSON.stringify({
    success: true,
    caja_nueva,
    evento: descripcion
  }), { status: 200 })
})

---

// edge-function-3: generar-alertas-inteligentes
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { plan_id, empresa_id } = await req.json()

  // Llamar a función PL/pgSQL que ya genera alertas
  const { error } = await supabase.rpc('generar_alertas_flujo', {
    p_plan_id: plan_id,
    p_empresa_id: empresa_id
  })

  return new Response(JSON.stringify({ alertas_generadas: true }), { status: 200 })
})

---

// edge-function-4: arrastrar-pago
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { pago_id, dia_nuevo } = await req.json()

  const { data } = await supabase
    .from('pago_semanal')
    .update({
      dia_programado: dia_nuevo,
      estado: 'ARRASTRADO'
    })
    .eq('id', pago_id)
    .select()
    .single()

  return new Response(JSON.stringify({
    pago_arrastrado: data.descripcion,
    nuevo_dia: dia_nuevo
  }), { status: 200 })
})

---

// edge-function-5: calcular-escenarios-what-if
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { 
    plan_id, 
    cliente_perdido_monto = 0,
    gastos_adicionales = 0,
    ingresos_adicionales = 0
  } = await req.json()

  // Obtener caja actual
  const { data: plan } = await supabase
    .from('plan_pagos_semanal')
    .select('caja_actual, caja_proyectada')
    .eq('id', plan_id)
    .single()

  // Calcular escenario
  const caja_escenario = plan.caja_proyectada 
    - cliente_perdido_monto 
    + ingresos_adicionales 
    - gastos_adicionales

  return new Response(JSON.stringify({
    caja_original: plan.caja_proyectada,
    caja_escenario: caja_escenario,
    diferencia: caja_escenario - plan.caja_proyectada,
    viable: caja_escenario > 0
  }), { status: 200 })
})

---

// edge-function-6: calcular-scoring-cobranza (Background Job)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  // Recalcular scoring de TODOS los clientes
  const { data: clientes } = await supabase
    .from('cobros')
    .select('DISTINCT cliente_rfc, empresa_id')

  for (const cliente of clientes) {
    await supabase.rpc('calcular_scoring_cliente', {
      p_cliente_rfc: cliente.cliente_rfc,
      p_empresa_id: cliente.empresa_id
    })
  }

  return new Response(JSON.stringify({
    clientes_procesados: clientes.length
  }), { status: 200 })
})
```

**TIEMPO:** 8 horas
**CHECKLIST:**
- [ ] Crear 6 edge functions
- [ ] Testear endpoints
- [ ] Documentar payloads
- [ ] Implementar WebSocket para tiempo real

---

### **SEMANA 2: COMPONENTES REACT + DASHBOARD**

#### **DÍA 6-7: Componente React: PlaneadorSemanal**

```typescript
// components/PlaneadorSemanal.tsx
import React, { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { formatCurrency, formatDate, nombreDia } from '@/lib/utils'

export const PlaneadorSemanal = ({ empresaId }: { empresaId: string }) => {
  const [plan, setPlan] = useState(null)
  const [pagos, setPagos] = useState([])
  const [ingresos, setIngresos] = useState([])
  const [alertas, setAlertas] = useState([])
  const [loading, setLoading] = useState(true)

  // SUBSCRIPCIÓN A TIEMPO REAL (WebSocket)
  useRealtimeSubscription(`flujo:${empresaId}`, (payload) => {
    if (payload.event === 'FLUJO_ACTUALIZADO') {
      setPlan(prev => ({
        ...prev,
        caja_actual: payload.caja_actual,
        actualizado_en: new Date()
      }))
      toast.success(`${payload.evento}: Caja ahora ${formatCurrency(payload.caja_actual)}`)
      recalcularGrafico()
    }
  })

  // CARGAR DATOS INICIALES
  useEffect(() => {
    cargarPlan()
  }, [])

  const cargarPlan = async () => {
    const { data: plan } = await supabase
      .from('plan_pagos_semanal')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('estado', 'ACTIVA')
      .single()

    const { data: pagos } = await supabase
      .from('pago_semanal')
      .select('*')
      .eq('plan_id', plan.id)

    const { data: ingresos } = await supabase
      .from('ingreso_semanal_esperado')
      .select('*')
      .eq('plan_id', plan.id)

    const { data: alertas } = await supabase
      .from('alerta_flujo_semanal')
      .select('*')
      .eq('plan_id', plan.id)

    setPlan(plan)
    setPagos(pagos)
    setIngresos(ingresos)
    setAlertas(alertas)
    setLoading(false)
  }

  // DRAG & DROP
  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result

    if (!destination) return

    // Solo permitir drag entre días
    if (source.droppableId === destination.droppableId) return

    const pago = pagos.find(p => p.id === draggableId)
    const diaNuevo = parseInt(destination.droppableId.split('-')[1])

    // Validar flujo
    const { data: validacion } = await supabase.functions.invoke('arrastrar-pago', {
      body: { pago_id: pago.id, dia_nuevo: diaNuevo }
    })

    if (validacion.error) {
      toast.error(validacion.error)
      return
    }

    // Actualizar UI
    setPagos(pagos.map(p => 
      p.id === pago.id ? { ...p, dia_programado: diaNuevo } : p
    ))

    toast.success(`${pago.descripcion} movido a ${nombreDia(diaNuevo)}`)
  }

  // COMPONENTES
  const DiaPago = ({ dia, index }) => {
    const pagosDia = pagos.filter(p => p.dia_programado === index)
    const ingresosDia = ingresos.filter(i => 
      Math.floor((new Date(i.fecha_promesa).getDay() - 1 + 7) % 7) === index
    )

    return (
      <div className="columna-dia">
        <h3>{dia} {formatDate(obtenerFecha(index))}</h3>

        {/* INGRESOS */}
        <div className="seccion-ingresos">
          {ingresosDia.map(ingreso => (
            <div key={ingreso.id} className={`ingreso-card ${ingreso.recibido ? 'recibido' : 'esperado'}`}>
              <div className="monto">⬆️ {formatCurrency(ingreso.monto)}</div>
              <div className="cliente">{ingreso.cliente_nombre}</div>
              <div className="estado">
                {ingreso.recibido ? (
                  <span className="badge recibido">✅ Recibido</span>
                ) : ingreso.confirmado_por_cliente ? (
                  <span className="badge confirmado">⏳ Confirmado</span>
                ) : (
                  <span className="badge sin-confirmar">❓ Sin confirmar</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* PAGOS (Droppable) */}
        <Droppable droppableId={`dia-${index}`}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`seccion-pagos ${snapshot.isDraggingOver ? 'highlight' : ''}`}
            >
              {pagosDia.map((pago, idx) => (
                <Draggable key={pago.id} draggableId={pago.id} index={idx}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`pago-card ${pago.color_codigo} ${
                        !pago.caja_permite ? 'disabled' : ''
                      } ${snapshot.isDragging ? 'dragging' : ''}`}
                    >
                      <div className="descripcion">{pago.descripcion}</div>
                      <div className="monto">⬇️ {formatCurrency(pago.monto)}</div>
                      <div className="estado">
                        {pago.estado === 'PAGADO' ? (
                          <span className="badge pagado">✅ Pagado</span>
                        ) : !pago.caja_permite ? (
                          <span className="badge error">❌ Sin flujo</span>
                        ) : (
                          <span className="badge pending">⏳ Pendiente</span>
                        )}
                      </div>
                      {!pago.caja_permite && (
                        <div className="tooltip">
                          No hay flujo suficiente para pagar esto
                        </div>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    )
  }

  if (loading) return <div>Cargando...</div>

  return (
    <div className="planeador-semanal">
      {/* HEADER CON CAJA */}
      <div className="header-caja">
        <div className="caja-info">
          <h2>Planeador Semanal</h2>
          <div className="row">
            <div className="stat">
              <div className="label">Caja Actual</div>
              <div className="valor">{formatCurrency(plan.caja_actual)}</div>
              <div className="actualizado">Actualizado: {formatDate(plan.actualizado_en)}</div>
            </div>
            <div className="stat">
              <div className="label">Proyectada (Fin Semana)</div>
              <div className="valor">{formatCurrency(plan.caja_proyectada)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ALERTAS */}
      {alertas.length > 0 && (
        <div className="seccion-alertas">
          {alertas.map(alerta => (
            <div key={alerta.id} className={`alerta alerta-${alerta.tipo_alerta}`}>
              <div className="titulo">{alerta.titulo}</div>
              <div className="descripcion">{alerta.descripcion}</div>
              {alerta.accion_recomendada && (
                <div className="accion">💡 {alerta.accion_recomendada}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* PLANEADOR DÍA A DÍA */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="planeador-dias">
          {['MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'].map((dia, idx) => (
            <DiaPago key={idx} dia={dia} index={idx} />
          ))}
        </div>
      </DragDropContext>

      {/* GRÁFICO DE FLUJO */}
      <div className="grafico-flujo">
        <GraficoFlujoSemanal plan={plan} pagos={pagos} />
      </div>
    </div>
  )
}
```

**TIEMPO:** 10 horas
**CHECKLIST:**
- [ ] Crear componente PlaneadorSemanal
- [ ] Implementar Drag & Drop (react-beautiful-dnd)
- [ ] Conectar a Supabase
- [ ] Subscripción WebSocket
- [ ] Estilos CSS

---

#### **DÍA 8-9: Dashboard + Otros Componentes**

```typescript
// pages/flujo-efectivo.tsx
import React from 'react'
import { PlaneadorSemanal } from '@/components/PlaneadorSemanal'
import { AlertasResumen } from '@/components/AlertasResumen'
import { GraficoFlujo30Dias } from '@/components/GraficoFlujo30Dias'
import { SimuladorEscenarios } from '@/components/SimuladorEscenarios'
import { CobranzaPrioritaria } from '@/components/CobranzaPrioritaria'

export default function FlujoEfectivo() {
  return (
    <div className="dashboard-flujo">
      <header>
        <h1>💰 Flujo de Efectivo Integrado</h1>
        <p>Control semanal actualizado en tiempo real</p>
      </header>

      <main>
        {/* SECCIÓN 1: Planeador Semanal (Principal) */}
        <section className="seccion-principal">
          <PlaneadorSemanal />
        </section>

        {/* SECCIÓN 2: Alertas (Sidebar) */}
        <section className="seccion-alertas-sidebar">
          <AlertasResumen />
        </section>

        {/* SECCIÓN 3: Proyección 30 días */}
        <section className="seccion-proyeccion">
          <h2>Proyección Próximos 30 Días</h2>
          <GraficoFlujo30Dias />
        </section>

        {/* SECCIÓN 4: Cobranza Prioritaria */}
        <section className="seccion-cobranza">
          <h2>Cobranza Prioritaria (Scoring)</h2>
          <CobranzaPrioritaria />
        </section>

        {/* SECCIÓN 5: Simulador de Escenarios */}
        <section className="seccion-escenarios">
          <h2>¿Qué Si...?</h2>
          <SimuladorEscenarios />
        </section>
      </main>
    </div>
  )
}
```

**TIEMPO:** 10 horas
**CHECKLIST:**
- [ ] Crear 4 componentes React secundarios
- [ ] Gráficos con Recharts
- [ ] Página principal
- [ ] Routing

---

### **SEMANA 3: TESTING + GO LIVE**

#### **DÍ 10-12: Testing**

```typescript
// __tests__/PlaneadorSemanal.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { PlaneadorSemanal } from '@/components/PlaneadorSemanal'

describe('PlaneadorSemanal', () => {
  it('carga el plan semanal correctamente', async () => {
    render(<PlaneadorSemanal empresaId="test-123" />)
    // Assertions...
  })

  it('arrastra pago entre días', async () => {
    // Test drag & drop
  })

  it('valida flujo cuando arrastra', async () => {
    // Test validación
  })

  it('actualiza en tiempo real cuando entra dinero', async () => {
    // Test WebSocket
  })

  it('genera alertas automáticas', async () => {
    // Test alertas
  })

  it('calcula scoring de cobranza', async () => {
    // Test scoring
  })
})
```

**TIEMPO:** 6 horas
**CHECKLIST:**
- [ ] Unit tests (React components)
- [ ] Integration tests (Edge Functions)
- [ ] E2E tests (flujo completo)
- [ ] Performance tests

---

#### **DÍA 13-14: Documentación + Deployment**

```markdown
# Documentación: Opción B - Flujo Completo

## Tablas Creadas (8)
1. plan_pagos_semanal
2. pago_semanal
3. ingreso_semanal_esperado
4. movimiento_tiempo_real
5. alerta_flujo_semanal
6. proyeccion_flujo_30dias
7. scoring_cliente_cobranza
8. escenario_what_if

## Edge Functions (6)
1. crear-plan-semanal
2. actualizar-flujo-semanal
3. generar-alertas-inteligentes
4. arrastrar-pago
5. calcular-escenarios-what-if
6. calcular-scoring-cobranza

## Componentes React (7)
1. PlaneadorSemanal (principal)
2. AlertasResumen
3. GraficoFlujo30Dias
4. SimuladorEscenarios
5. CobranzaPrioritaria
6. GraficoFlujoSemanal
7. DiaPago

## API Routes (2)
1. GET /api/flujo/plan-semanal
2. POST /api/flujo/scenario-what-if

## Variables de Entorno
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
```

**TIEMPO:** 4 horas
**CHECKLIST:**
- [ ] Documentación completa
- [ ] README actualizado
- [ ] Deploy a producción
- [ ] Monitoring

---

#### **DÍA 15: Buffer + Ajustes Finales**

**TIEMPO:** 4 horas
**CHECKLIST:**
- [ ] Pruebas finales
- [ ] Bugs encontrados → Fix
- [ ] Performance tweaks
- [ ] Capacitación al usuario

---

## 📊 RESUMEN DEL PROYECTO

```
SEMANA 1:
- Base de datos: 8 tablas, 20+ índices, 10+ policies
- Funciones: 6 PL/pgSQL + 6 triggers
- Edge Functions: 6 endpoints de Deno
Tiempo: 18 horas

SEMANA 2:
- React: 7 componentes (PlaneadorSemanal + 6 secundarios)
- Dashboard: Página principal integrada
- Integración: WebSocket tiempo real
Tiempo: 20 horas

SEMANA 3:
- Testing: Unit + Integration + E2E
- Documentación: Completa
- Deployment: Go live
Tiempo: 14 horas

TOTAL: 52 horas dev (~3 semanas @ 40h/semana)
```

---

## 🎯 VALIDACIÓN FINAL

```
✅ Proyección de caja 30 días
✅ Planeador semanal con drag & drop
✅ Alertas inteligentes en tiempo real
✅ Cobranza prioritaria (scoring)
✅ Simulador escenarios (what-if)
✅ Actualización automática (WebSocket)
✅ Auditoría de cambios (movimientos_tiempo_real)
✅ Nómina protegida (indispensable)
✅ Dashboard unificado
✅ Reportes automáticos

READY FOR PRODUCTION ✅
```

---

## 📞 CONTACTO CON PREGUNTAS

Si Daniel tiene preguntas:
1. Revisar este documento (sección "Plan Semanal Detallado")
2. Revisar FLUJO_EFECTIVO_INTEGRACION_COMPLETA.md
3. Revisar PLANEADOR_SEMANAL_PAGOS_FLUJO_REAL.md

Documentación es 100% detallada.

