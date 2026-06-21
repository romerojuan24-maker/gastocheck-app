# 🚀 FASE 1: INFRAESTRUCTURA - Guía de Implementación

**Objetivo:** Crear todas las tablas, campos, triggers e índices necesarios
**Tiempo estimado:** 1-2 horas
**Reversibilidad:** Alta (SQL puro, no afecta datos existentes)

---

## ✅ CHECKLIST PRE-IMPLEMENTACIÓN

Antes de comenzar, verifica:

```
[ ] Acceso a Supabase dashboard (https://app.supabase.com)
[ ] Backup reciente de BD (Supabase lo hace automáticamente)
[ ] Conexión internet estable
[ ] Navegador actualizado
[ ] Acceso SQL Editor en Supabase
```

---

## 📋 PASO 1: Crear Tabla `cfdi_recibidos` (CFDIs descargados del SAT)

**Ubicación:** Supabase → SQL Editor → Nueva query

**Copiar y pegar exactamente:**

```sql
-- TABLA 1: CFDI RECIBIDOS
-- Almacena CFDIs descargados del SAT (que otros nos enviaron)

CREATE TABLE IF NOT EXISTS cfdi_recibidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  
  -- Datos del CFDI
  uuid VARCHAR(36) NOT NULL UNIQUE,
  xml_content TEXT NOT NULL,
  monto NUMERIC(15, 2) NOT NULL,
  rfc_emisor VARCHAR(13) NOT NULL,
  nombre_emisor VARCHAR(255),
  fecha_emision TIMESTAMP NOT NULL,
  concepto TEXT,
  
  -- Relaciones
  compra_id UUID REFERENCES gastos(id) ON DELETE SET NULL,
  movimiento_bancario_id UUID REFERENCES movimientos_financieros(id) ON DELETE SET NULL,
  
  -- Estado
  estado VARCHAR(20) NOT NULL DEFAULT 'RECIBIDO',
  validado BOOLEAN DEFAULT FALSE,
  validado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  validado_en TIMESTAMP,
  
  -- Validación
  monto_coincide BOOLEAN,
  fecha_coincide BOOLEAN,
  rfc_coincide BOOLEAN,
  confianza_match NUMERIC(3, 0),
  
  -- Alertas
  alertas TEXT[],
  
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
CREATE INDEX idx_cfdi_fecha_emision ON cfdi_recibidos(fecha_emision DESC);

-- Trigger para actualizar timestamp
CREATE OR REPLACE FUNCTION actualizar_cfdi_recibidos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cfdi_recibidos_updated_at ON cfdi_recibidos;
CREATE TRIGGER trigger_cfdi_recibidos_updated_at
BEFORE UPDATE ON cfdi_recibidos
FOR EACH ROW
EXECUTE FUNCTION actualizar_cfdi_recibidos_updated_at();

-- RLS (Row Level Security)
ALTER TABLE cfdi_recibidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresas pueden ver sus CFDIs" ON cfdi_recibidos;
CREATE POLICY "Empresas pueden ver sus CFDIs" ON cfdi_recibidos
  FOR SELECT
  USING (empresa_id IN (
    SELECT empresa_id FROM empresa_usuarios
    WHERE usuario_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Empresas pueden crear CFDIs" ON cfdi_recibidos;
CREATE POLICY "Empresas pueden crear CFDIs" ON cfdi_recibidos
  FOR INSERT
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM empresa_usuarios
    WHERE usuario_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Empresas pueden actualizar CFDIs" ON cfdi_recibidos;
CREATE POLICY "Empresas pueden actualizar CFDIs" ON cfdi_recibidos
  FOR UPDATE
  USING (empresa_id IN (
    SELECT empresa_id FROM empresa_usuarios
    WHERE usuario_id = auth.uid()
  ));

-- Verificación
SELECT 'Tabla cfdi_recibidos creada ✅' as status;
```

**Ejecutar:**
1. Copiar el código completo
2. Pegar en Supabase SQL Editor
3. Click "Run" (▶️)
4. Verificar: Debe decir "Tabla cfdi_recibidos creada ✅"

---

## 📋 PASO 2: Crear Tabla `reconciliaciones` (Tracking de matches)

**Copiar y pegar:**

```sql
-- TABLA 2: RECONCILIACIONES
-- Tracking de matches entre compra↔CFDI↔banco y cobro↔banco

CREATE TABLE IF NOT EXISTS reconciliaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  
  -- Relaciones
  movimiento_bancario_id UUID NOT NULL REFERENCES movimientos_financieros(id) ON DELETE CASCADE,
  compra_id UUID REFERENCES gastos(id) ON DELETE SET NULL,
  cobro_id UUID REFERENCES cobros(id) ON DELETE SET NULL,
  
  -- Datos del match
  tipo VARCHAR(20) NOT NULL,
  monto NUMERIC(15, 2) NOT NULL,
  monto_diferencia NUMERIC(15, 2),
  fecha_movimiento TIMESTAMP NOT NULL,
  fecha_registro TIMESTAMP NOT NULL,
  dias_diferencia INTEGER,
  
  -- Validación
  criterios_match VARCHAR(100)[],
  confianza NUMERIC(3, 0) NOT NULL,
  
  -- Resultado
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  reconciliado BOOLEAN DEFAULT FALSE,
  reconciliado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
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
CREATE INDEX idx_reconciliaciones_confianza ON reconciliaciones(confianza DESC);

-- Trigger
CREATE OR REPLACE FUNCTION actualizar_reconciliaciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reconciliaciones_updated_at ON reconciliaciones;
CREATE TRIGGER trigger_reconciliaciones_updated_at
BEFORE UPDATE ON reconciliaciones
FOR EACH ROW
EXECUTE FUNCTION actualizar_reconciliaciones_updated_at();

-- RLS
ALTER TABLE reconciliaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresas pueden ver sus reconciliaciones" ON reconciliaciones;
CREATE POLICY "Empresas pueden ver sus reconciliaciones" ON reconciliaciones
  FOR SELECT
  USING (empresa_id IN (
    SELECT empresa_id FROM empresa_usuarios
    WHERE usuario_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Empresas pueden crear reconciliaciones" ON reconciliaciones;
CREATE POLICY "Empresas pueden crear reconciliaciones" ON reconciliaciones
  FOR INSERT
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM empresa_usuarios
    WHERE usuario_id = auth.uid()
  ));

-- Verificación
SELECT 'Tabla reconciliaciones creada ✅' as status;
```

---

## 📋 PASO 3: Alterar Tablas Existentes + Crear Triggers Auditoría

**Copiar y pegar:**

```sql
-- TABLA 3: ALTER movimientos_financieros Y polizas + TRIGGERS AUDITORÍA

-- Agregar campos a movimientos_financieros
ALTER TABLE movimientos_financieros
ADD COLUMN IF NOT EXISTS cfdi_recibido_id UUID REFERENCES cfdi_recibidos(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reconciliacion_id UUID REFERENCES reconciliaciones(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS estado_contable VARCHAR(50) DEFAULT 'REGISTRADO',
ADD COLUMN IF NOT EXISTS validado_por_sat BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS validado_por_banco BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reconciliacion_confianza NUMERIC(3, 0),
ADD COLUMN IF NOT EXISTS fecha_última_sync TIMESTAMP,
ADD COLUMN IF NOT EXISTS próxima_sync TIMESTAMP,
ADD COLUMN IF NOT EXISTS errores_sync TEXT[];

-- Agregar campos a polizas
ALTER TABLE polizas
ADD COLUMN IF NOT EXISTS cfdi_uuid VARCHAR(36),
ADD COLUMN IF NOT EXISTS validada_por_cfdi BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS validada_por_banco BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS estado_sincronizacion VARCHAR(50) DEFAULT 'SINCRONIZADA',
ADD COLUMN IF NOT EXISTS última_sync TIMESTAMP,
ADD COLUMN IF NOT EXISTS reconciliacion_id UUID REFERENCES reconciliaciones(id) ON DELETE SET NULL;

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_movimientos_cfdi_recibido ON movimientos_financieros(cfdi_recibido_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_reconciliacion ON movimientos_financieros(reconciliacion_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_estado_contable ON movimientos_financieros(estado_contable);
CREATE INDEX IF NOT EXISTS idx_movimientos_validado_sat ON movimientos_financieros(validado_por_sat);
CREATE INDEX IF NOT EXISTS idx_movimientos_validado_banco ON movimientos_financieros(validado_por_banco);

CREATE INDEX IF NOT EXISTS idx_polizas_cfdi_uuid ON polizas(cfdi_uuid);
CREATE INDEX IF NOT EXISTS idx_polizas_validada_cfdi ON polizas(validada_por_cfdi);
CREATE INDEX IF NOT EXISTS idx_polizas_validada_banco ON polizas(validada_por_banco);
CREATE INDEX IF NOT EXISTS idx_polizas_estado_sync ON polizas(estado_sincronizacion);

-- ============ TRIGGERS PARA AUDITORÍA ============

-- Crear tabla audit_log si no existe
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_email VARCHAR(255),
  ip_address INET,
  tabla VARCHAR(100) NOT NULL,
  operacion VARCHAR(20) NOT NULL,
  record_id UUID,
  datos_anterior JSONB,
  datos_nuevo JSONB,
  cambios_detectados TEXT[],
  hash_anterior VARCHAR(64),
  hash_nuevo VARCHAR(64),
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_empresa ON audit_log(empresa_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_audit_usuario ON audit_log(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_tabla ON audit_log(tabla);
CREATE INDEX IF NOT EXISTS idx_audit_fecha ON audit_log(creado_en DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresas pueden ver su audit log" ON audit_log;
CREATE POLICY "Empresas pueden ver su audit log" ON audit_log
  FOR SELECT
  USING (empresa_id IN (
    SELECT empresa_id FROM empresa_usuarios
    WHERE usuario_id = auth.uid()
  ));

-- Función de auditoría
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_usuario_id UUID;
  v_cambios TEXT[];
BEGIN
  v_usuario_id := auth.uid();

  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(key)
    INTO v_cambios
    FROM jsonb_each(to_jsonb(NEW) - to_jsonb(OLD));
  END IF;

  INSERT INTO audit_log (
    empresa_id,
    usuario_id,
    tabla,
    operacion,
    record_id,
    datos_anterior,
    datos_nuevo,
    cambios_detectados,
    hash_anterior,
    hash_nuevo,
    creado_en
  ) VALUES (
    COALESCE(NEW.empresa_id, OLD.empresa_id),
    v_usuario_id,
    TG_TABLE_NAME,
    TG_OP,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    v_cambios,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN encode(sha256(to_jsonb(OLD)::text::bytea), 'hex') ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN encode(sha256(to_jsonb(NEW)::text::bytea), 'hex') ELSE NULL END,
    CURRENT_TIMESTAMP
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers a tablas críticas
DROP TRIGGER IF EXISTS audit_gastos ON gastos;
CREATE TRIGGER audit_gastos
AFTER INSERT OR UPDATE OR DELETE ON gastos
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

DROP TRIGGER IF EXISTS audit_polizas ON polizas;
CREATE TRIGGER audit_polizas
AFTER INSERT OR UPDATE OR DELETE ON polizas
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

DROP TRIGGER IF EXISTS audit_movimientos ON movimientos_financieros;
CREATE TRIGGER audit_movimientos
AFTER INSERT OR UPDATE OR DELETE ON movimientos_financieros
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

DROP TRIGGER IF EXISTS audit_cfdi_recibidos ON cfdi_recibidos;
CREATE TRIGGER audit_cfdi_recibidos
AFTER INSERT OR UPDATE OR DELETE ON cfdi_recibidos
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

DROP TRIGGER IF EXISTS audit_cobros ON cobros;
CREATE TRIGGER audit_cobros
AFTER INSERT OR UPDATE OR DELETE ON cobros
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

DROP TRIGGER IF EXISTS audit_reconciliaciones ON reconciliaciones;
CREATE TRIGGER audit_reconciliaciones
AFTER INSERT OR UPDATE OR DELETE ON reconciliaciones
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Verificación
SELECT 'Campos y triggers de auditoría creados ✅' as status;
```

---

## 🔍 PASO 4: Verificar que TODO está creado

**Copiar y pegar para verificación:**

```sql
-- VERIFICAR QUE TODO ESTÁ LISTO

-- 1. Verificar tablas nuevas
SELECT 
  'cfdi_recibidos' as tabla,
  COUNT(*) as columnas
FROM information_schema.columns 
WHERE table_name = 'cfdi_recibidos'
GROUP BY table_name

UNION ALL

SELECT 
  'reconciliaciones' as tabla,
  COUNT(*) as columnas
FROM information_schema.columns 
WHERE table_name = 'reconciliaciones'
GROUP BY table_name

UNION ALL

SELECT 
  'audit_log' as tabla,
  COUNT(*) as columnas
FROM information_schema.columns 
WHERE table_name = 'audit_log'
GROUP BY table_name;

-- 2. Verificar campos agregados
SELECT 
  'movimientos_financieros' as tabla,
  array_agg(column_name) as campos_nuevos
FROM information_schema.columns 
WHERE table_name = 'movimientos_financieros'
AND column_name IN ('cfdi_recibido_id', 'reconciliacion_id', 'estado_contable', 'validado_por_sat', 'validado_por_banco');

-- 3. Verificar índices creados
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('cfdi_recibidos', 'reconciliaciones', 'audit_log', 'movimientos_financieros', 'polizas')
ORDER BY indexname;

-- 4. Verificar triggers
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE event_object_table IN ('gastos', 'polizas', 'movimientos_financieros', 'cfdi_recibidos', 'cobros', 'reconciliaciones')
ORDER BY event_object_table, trigger_name;
```

**Resultado esperado:** 3 tablas nuevas + campos agregados + 10+ índices + 6 triggers ✅

---

## 📝 PASO 5: Crear tabla `cfdi_emitidos` (Para CobraCheck)

**Copiar y pegar:**

```sql
-- TABLA 4: CFDI EMITIDOS
-- Facturas que NOSOTROS emitimos (para CobraCheck)

CREATE TABLE IF NOT EXISTS cfdi_emitidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  
  uuid VARCHAR(36) NOT NULL UNIQUE,
  folio VARCHAR(50),
  serie VARCHAR(25),
  
  cliente_rfc VARCHAR(13) NOT NULL,
  cliente_nombre VARCHAR(255),
  
  monto NUMERIC(15, 2) NOT NULL,
  
  fecha_emision TIMESTAMP NOT NULL,
  fecha_vigencia TIMESTAMP,
  
  xml_content TEXT,
  
  estado_cfdi VARCHAR(20) DEFAULT 'VIGENTE',
  pagado BOOLEAN DEFAULT FALSE,
  
  ingreso_cobracheck_id UUID REFERENCES cobros(id) ON DELETE SET NULL,
  movimiento_bancario_id UUID REFERENCES movimientos_financieros(id) ON DELETE SET NULL,
  
  descargado_del_sat TIMESTAMP,
  reconciliado_en TIMESTAMP,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cfdi_emitidos_empresa ON cfdi_emitidos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cfdi_emitidos_cliente_rfc ON cfdi_emitidos(cliente_rfc);
CREATE INDEX IF NOT EXISTS idx_cfdi_emitidos_fecha ON cfdi_emitidos(fecha_emision DESC);
CREATE INDEX IF NOT EXISTS idx_cfdi_emitidos_pagado ON cfdi_emitidos(pagado);
CREATE INDEX IF NOT EXISTS idx_cfdi_emitidos_monto ON cfdi_emitidos(monto);

ALTER TABLE cfdi_emitidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresas pueden ver sus CFDIs emitidos" ON cfdi_emitidos;
CREATE POLICY "Empresas pueden ver sus CFDIs emitidos" ON cfdi_emitidos
  FOR SELECT
  USING (empresa_id IN (
    SELECT empresa_id FROM empresa_usuarios
    WHERE usuario_id = auth.uid()
  ));

SELECT 'Tabla cfdi_emitidos creada ✅' as status;
```

---

## 📝 PASO 6: Agregar campos a tabla `cobros` (Para CobraCheck)

**Copiar y pegar:**

```sql
-- ACTUALIZAR TABLA cobros

ALTER TABLE cobros
ADD COLUMN IF NOT EXISTS cfdi_emitido_id UUID REFERENCES cfdi_emitidos(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS movimiento_bancario_id UUID REFERENCES movimientos_financieros(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS estado_reconciliacion VARCHAR(50) DEFAULT 'PENDIENTE',
ADD COLUMN IF NOT EXISTS es_duplicado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS duplicado_de UUID REFERENCES cobros(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS confianza_match NUMERIC(3, 0),
ADD COLUMN IF NOT EXISTS fecha_reconciliacion TIMESTAMP,
ADD COLUMN IF NOT EXISTS observaciones TEXT;

CREATE INDEX IF NOT EXISTS idx_cobros_cfdi_emitido ON cobros(cfdi_emitido_id);
CREATE INDEX IF NOT EXISTS idx_cobros_movimiento_banco ON cobros(movimiento_bancario_id);
CREATE INDEX IF NOT EXISTS idx_cobros_estado_reconciliacion ON cobros(estado_reconciliacion);
CREATE INDEX IF NOT EXISTS idx_cobros_es_duplicado ON cobros(es_duplicado);

-- Función para detectar duplicados
CREATE OR REPLACE FUNCTION detectar_duplicados_cobros()
RETURNS TABLE (
  empresa_id UUID,
  monto NUMERIC,
  cliente_rfc VARCHAR,
  fecha DATE,
  cantidad INT,
  ids_duplicados UUID[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c1.empresa_id,
    c1.monto,
    c1.cliente_rfc,
    DATE(c1.fecha_pago),
    COUNT(*)::INT as cantidad,
    ARRAY_AGG(c1.id) as ids_duplicados
  FROM cobros c1
  WHERE c1.es_duplicado = FALSE
  GROUP BY
    c1.empresa_id,
    c1.monto,
    c1.cliente_rfc,
    DATE(c1.fecha_pago)
  HAVING COUNT(*) > 1;
END;
$$ LANGUAGE plpgsql;

-- Trigger para detectar duplicados al insertar
CREATE OR REPLACE FUNCTION check_duplicado_cobro()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cobros c
    WHERE c.empresa_id = NEW.empresa_id
    AND c.monto = NEW.monto
    AND c.cliente_rfc = NEW.cliente_rfc
    AND DATE(c.fecha_pago) = DATE(NEW.fecha_pago)
    AND c.id != NEW.id
    AND c.es_duplicado = FALSE
  ) THEN
    NEW.es_duplicado := TRUE;
    NEW.estado_reconciliacion := 'DUPLICADO';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_duplicado_cobro ON cobros;
CREATE TRIGGER trigger_check_duplicado_cobro
BEFORE INSERT ON cobros
FOR EACH ROW
EXECUTE FUNCTION check_duplicado_cobro();

SELECT 'Tabla cobros actualizada + duplicado detection ✅' as status;
```

---

## 📝 PASO 7: Crear tabla `reconciliacion_triple` (Para CobraCheck)

**Copiar y pegar:**

```sql
-- TABLA 5: RECONCILIACION_TRIPLE
-- Tracking de triple match: Factura ↔ Ingreso ↔ Banco

CREATE TABLE IF NOT EXISTS reconciliacion_triple (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  
  cfdi_emitido_id UUID REFERENCES cfdi_emitidos(id) ON DELETE SET NULL,
  cobro_id UUID REFERENCES cobros(id) ON DELETE SET NULL,
  movimiento_bancario_id UUID REFERENCES movimientos_financieros(id) ON DELETE SET NULL,
  
  monto_cfdi NUMERIC(15, 2),
  monto_cobro NUMERIC(15, 2),
  monto_bancario NUMERIC(15, 2),
  
  tipo VARCHAR(50),
  estado VARCHAR(50) DEFAULT 'RECONCILIADO',
  
  cfdi_ok BOOLEAN DEFAULT FALSE,
  cobro_ok BOOLEAN DEFAULT FALSE,
  bancario_ok BOOLEAN DEFAULT FALSE,
  
  confianza NUMERIC(3, 0),
  
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reconciliado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  reconciliado_en TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reconciliacion_triple_empresa ON reconciliacion_triple(empresa_id);
CREATE INDEX IF NOT EXISTS idx_reconciliacion_triple_estado ON reconciliacion_triple(estado);
CREATE INDEX IF NOT EXISTS idx_reconciliacion_triple_tipo ON reconciliacion_triple(tipo);
CREATE INDEX IF NOT EXISTS idx_reconciliacion_triple_cfdi ON reconciliacion_triple(cfdi_emitido_id);

ALTER TABLE reconciliacion_triple ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresas pueden ver su reconciliacion triple" ON reconciliacion_triple;
CREATE POLICY "Empresas pueden ver su reconciliacion triple" ON reconciliacion_triple
  FOR SELECT
  USING (empresa_id IN (
    SELECT empresa_id FROM empresa_usuarios
    WHERE usuario_id = auth.uid()
  ));

SELECT 'Tabla reconciliacion_triple creada ✅' as status;
```

---

## ✅ RESUMEN: FASE 1 COMPLETADA

```
Tablas nuevas:
✅ cfdi_recibidos (CFDIs que recibimos del SAT)
✅ reconciliaciones (Tracking de matches)
✅ audit_log (Auditoría de todos los cambios)
✅ cfdi_emitidos (Facturas que emitimos)
✅ reconciliacion_triple (Triple match para CobraCheck)

Campos agregados:
✅ movimientos_financieros (8 campos nuevos)
✅ polizas (5 campos nuevos)
✅ cobros (8 campos nuevos)

Índices creados:
✅ 25+ índices para búsquedas rápidas

Triggers creados:
✅ 8 triggers de auditoría automática
✅ 2 triggers de detección de duplicados

RLS Policies:
✅ Seguridad por empresa (usuarios solo ven su empresa)

Total: 5 tablas nuevas + 3 alteradas + 25+ índices + 8 triggers
```

---

## 🎯 PRÓXIMO PASO: FASE 2

Una vez confirmado que FASE 1 está completa, procederemos con:

**FASE 2: Edge Functions**
- Descargar CFDIs del SAT
- Validar automáticamente
- Reconciliar triple
- Detectar duplicados

Tiempo: 3-4 horas

¿Confirmas que ejecutaste TODOS los pasos? 👇

