# 📊 COBRACHECK: Visibilidad 360° + Reconciliación Triple (Factura ↔ Ingreso ↔ Banco)

**Objetivo:** Garantizar que TODOS los ingresos de la empresa estén incluidos y sin duplicados
**Estándar:** Triple reconciliación automática (SAT Facturas + CobraCheck + BancoCheck)
**Fecha:** 2026-06-21

---

## 🎯 PROBLEMA ACTUAL (Sin Visibilidad)

```
CONTADOR: "¿Hemos cobrado todas las facturas?"
RESPUESTA: "No sé... hay que revisar"

RESULTADO:
❌ Facturas sin cobrar pasan desapercibidas (pérdida de dinero)
❌ Dinero llegó pero no está registrado (discrepancia contable)
❌ Mismo ingreso registrado 2 veces (duplicado)
❌ Sin auditoría de qué se reconcilió y qué no
❌ Contador gasta horas buscando discrepancias
❌ SAT puede cuestionar si todos los ingresos están registrados
```

---

## 🔄 SOLUCIÓN: Triple Reconciliación Automática

### **TRES FUENTES DE VERDAD**

```
FUENTE 1: FACTURAS EMITIDAS
├─ CFDIs generados y timbrados
├─ Descargar del SAT (API)
├─ Campo: cfdi_emitido_uuid, fecha_emision, monto, cliente_rfc

FUENTE 2: INGRESOS REGISTRADOS (CobraCheck)
├─ Cobros que usuario registra manualmente
├─ Campo: monto, fecha_pago, cliente_rfc, cfdi_uuid (si existe)

FUENTE 3: MOVIMIENTOS BANCARIOS
├─ Dinero que realmente entró al banco
├─ Descargar de banco (API o manual)
├─ Campo: monto, fecha, concepto, banco

OBJETIVO: Las 3 fuentes deben coincidir
```

### **RECONCILIACIÓN AUTOMÁTICA**

```
PASO 1: Descargar CFDIs emitidos del SAT
  Factura_SAT {
    uuid: "ABC123...",
    monto: 5000,
    cliente_rfc: "XYZ123456ABC",
    fecha: 2026-06-21,
    estado: "VIGENTE"
  }

PASO 2: Buscar en CobraCheck (ingresos registrados)
  Ingreso_CobraCheck {
    monto: 5000,
    cliente_rfc: "XYZ123456ABC",
    fecha_pago: 2026-06-21,
    cfdi_uuid: "ABC123..." ← Opcional
  }
  
  ¿MATCH? Sí/No/Parcial

PASO 3: Buscar en BancoCheck (movimientos reales)
  Movimiento_Banco {
    monto: 5000,
    fecha: 2026-06-21,
    concepto: "Pago cliente XYZ"
  }
  
  ¿MATCH? Sí/No/Parcial

RESULTADO: Estado de cada factura
  ✅ COBRADA: Factura + Ingreso + Movimiento (coinciden)
  ⚠️ PENDIENTE: Factura sin ingreso registrado
  ⚠️ SIN_BANCARIO: Ingreso registrado pero sin movimiento en banco
  ⚠️ DUPLICADA: Mismo ingreso 2+ veces
  ❌ DESCUADRE: Montos no coinciden
```

---

## 📋 TABLAS Y CAMPOS NECESARIOS

### **Tabla 1: cfdi_emitidos (Facturas que EMITIMOS)**

```sql
CREATE TABLE cfdi_emitidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  
  -- CFDI
  uuid VARCHAR(36) NOT NULL UNIQUE,
  folio VARCHAR(50),
  serie VARCHAR(25),
  
  -- Cliente
  cliente_rfc VARCHAR(13) NOT NULL,
  cliente_nombre VARCHAR(255),
  
  -- Monto
  monto NUMERIC(15, 2) NOT NULL,
  
  -- Fechas
  fecha_emision TIMESTAMP NOT NULL,
  fecha_vigencia TIMESTAMP,
  
  -- XML
  xml_content TEXT,
  
  -- Estado de pago
  estado_cfdi VARCHAR(20) DEFAULT 'VIGENTE', -- VIGENTE, CANCELADA, RECHAZADA
  pagado BOOLEAN DEFAULT FALSE,
  
  -- Relaciones
  ingreso_cobracheck_id UUID REFERENCES cobros(id), -- Link automático
  movimiento_bancario_id UUID REFERENCES movimientos_financieros(id),
  
  -- Auditoría
  descargado_del_sat TIMESTAMP,
  reconciliado_en TIMESTAMP,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT cfdi_unico_por_empresa UNIQUE(empresa_id, uuid)
);

CREATE INDEX idx_cfdi_emitidos_empresa ON cfdi_emitidos(empresa_id);
CREATE INDEX idx_cfdi_emitidos_cliente_rfc ON cfdi_emitidos(cliente_rfc);
CREATE INDEX idx_cfdi_emitidos_fecha ON cfdi_emitidos(fecha_emision);
CREATE INDEX idx_cfdi_emitidos_pagado ON cfdi_emitidos(pagado);
CREATE INDEX idx_cfdi_emitidos_monto ON cfdi_emitidos(monto);
```

### **Tabla 2: cobros (Ingresos registrados en CobraCheck)**

```sql
ALTER TABLE cobros
ADD COLUMN IF NOT EXISTS cfdi_emitido_id UUID REFERENCES cfdi_emitidos(id),
ADD COLUMN IF NOT EXISTS movimiento_bancario_id UUID REFERENCES movimientos_financieros(id),
ADD COLUMN IF NOT EXISTS estado_reconciliacion VARCHAR(50) DEFAULT 'PENDIENTE', -- PENDIENTE, RECONCILIADO, DUPLICADO, DESCUADRE
ADD COLUMN IF NOT EXISTS es_duplicado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS duplicado_de UUID REFERENCES cobros(id), -- Si es duplicado, referencia al original
ADD COLUMN IF NOT EXISTS confianza_match NUMERIC(3, 0), -- 0-100
ADD COLUMN IF NOT EXISTS fecha_reconciliacion TIMESTAMP,
ADD COLUMN IF NOT EXISTS observaciones TEXT;
```

### **Tabla 3: reconciliacion_triple (Tracking de reconciliaciones)**

```sql
CREATE TABLE reconciliacion_triple (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  
  -- Las 3 fuentes
  cfdi_emitido_id UUID REFERENCES cfdi_emitidos(id),
  cobro_id UUID REFERENCES cobros(id),
  movimiento_bancario_id UUID REFERENCES movimientos_financieros(id),
  
  -- Datos
  monto_cfdi NUMERIC(15, 2),
  monto_cobro NUMERIC(15, 2),
  monto_bancario NUMERIC(15, 2),
  
  -- Estado
  tipo VARCHAR(50), -- COMPLETA, PARCIAL, INCOMPLETA, DUPLICADA
  estado VARCHAR(50), -- RECONCILIADO, PENDIENTE, ERROR
  
  -- Validación
  cfdi_ok BOOLEAN,
  cobro_ok BOOLEAN,
  bancario_ok BOOLEAN,
  
  -- Confianza
  confianza NUMERIC(3, 0), -- 0-100
  
  -- Auditoría
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reconciliado_por UUID REFERENCES usuarios(id),
  reconciliado_en TIMESTAMP,
  
  CONSTRAINT una_reconciliacion_por_cfdi UNIQUE(cfdi_emitido_id)
);

CREATE INDEX idx_reconciliacion_triple_empresa ON reconciliacion_triple(empresa_id);
CREATE INDEX idx_reconciliacion_triple_estado ON reconciliacion_triple(estado);
CREATE INDEX idx_reconciliacion_triple_tipo ON reconciliacion_triple(tipo);
```

---

## 🔍 DETECCIÓN DE DUPLICADOS (CRÍTICO)

```sql
-- Detectar ingresos duplicados
CREATE OR REPLACE FUNCTION detectar_duplicados()
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
    COUNT(*) as cantidad,
    ARRAY_AGG(c1.id) as ids_duplicados
  FROM cobros c1
  WHERE c1.es_duplicado = FALSE
  GROUP BY
    c1.empresa_id,
    c1.monto,
    c1.cliente_rfc,
    DATE(c1.fecha_pago)
  HAVING COUNT(*) > 1; -- Más de 1 = duplicado
END;
$$ LANGUAGE plpgsql;

-- Ejecutar automáticamente cada día
CREATE OR REPLACE FUNCTION marcar_duplicados()
RETURNS void AS $$
DECLARE
  v_registro RECORD;
  v_original_id UUID;
  v_contador INT := 0;
BEGIN
  FOR v_registro IN
    SELECT * FROM detectar_duplicados()
  LOOP
    -- Marcar el primero como original
    v_original_id := v_registro.ids_duplicados[1];
    
    -- Marcar los demás como duplicados
    FOR i IN 2..array_length(v_registro.ids_duplicados, 1)
    LOOP
      UPDATE cobros
      SET
        es_duplicado = TRUE,
        duplicado_de = v_original_id,
        estado_reconciliacion = 'DUPLICADO'
      WHERE id = v_registro.ids_duplicados[i];
      
      v_contador := v_contador + 1;
    END LOOP;
  END LOOP;
  
  -- Log
  INSERT INTO audit_log (evento, contexto, creado_en)
  VALUES ('duplicados_detectados', jsonb_build_object('cantidad', v_contador), CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- Trigger: cuando se inserta nuevo ingreso, chequear duplicado
CREATE OR REPLACE FUNCTION check_duplicado_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cobros c
    WHERE c.empresa_id = NEW.empresa_id
    AND c.monto = NEW.monto
    AND c.cliente_rfc = NEW.cliente_rfc
    AND DATE(c.fecha_pago) = DATE(NEW.fecha_pago)
    AND c.id != NEW.id
  ) THEN
    NEW.es_duplicado := TRUE;
    NEW.estado_reconciliacion := 'DUPLICADO';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_duplicado
BEFORE INSERT ON cobros
FOR EACH ROW
EXECUTE FUNCTION check_duplicado_on_insert();
```

---

## 🔗 EDGE FUNCTIONS (Reconciliación Automática)

### **Edge Function 1: Descargar CFDIs Emitidos del SAT**

```typescript
// /supabase/functions/descargar-cfdi-emitidos/index.ts

Deno.serve(async (req) => {
  const { empresa_id } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );

  // 1. Obtener RFC empresa + credenciales SAT
  const { data: empresa } = await supabase
    .from('empresas')
    .select('rfc, sat_username, sat_password')
    .eq('id', empresa_id)
    .single();

  // 2. Conectar a SAT y descargar CFDIs EMITIDOS
  const sat = new SAT({
    rfc: empresa.rfc,
    username: empresa.sat_username,
    password: empresa.sat_password,
  });

  const cfdisEmitidos = await sat.descargarCFDIsEmitidos({
    fechaInicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    fechaFin: new Date(),
    estado: 'VIGENTE',
  });

  // 3. Para cada CFDI: insertar en BD
  let insertados = 0;
  for (const cfdi of cfdisEmitidos) {
    const { error } = await supabase.from('cfdi_emitidos').insert({
      empresa_id,
      uuid: cfdi.uuid,
      folio: cfdi.folio,
      serie: cfdi.serie,
      cliente_rfc: cfdi.rfcReceptor,
      cliente_nombre: cfdi.nombreReceptor,
      monto: parseFloat(cfdi.total),
      fecha_emision: cfdi.fechaEmision,
      xml_content: cfdi.xmlContent,
      descargado_del_sat: new Date(),
    });

    if (!error) insertados++;
  }

  // 4. Disparar reconciliación automática
  await Deno.invoke('reconciliar-triple', { empresa_id });

  return new Response(JSON.stringify({ insertados }));
});
```

### **Edge Function 2: Reconciliar Triple (Factura ↔ Ingreso ↔ Banco)**

```typescript
// /supabase/functions/reconciliar-triple/index.ts

Deno.serve(async (req) => {
  const { empresa_id } = await req.json();

  const supabase = createClient(...);

  // 1. Obtener ALL CFDIs emitidos sin reconciliar
  const { data: cfdis } = await supabase
    .from('cfdi_emitidos')
    .select('*')
    .eq('empresa_id', empresa_id)
    .is('reconciliado_en', null); // Sin reconciliar

  let reconciliadas = 0;
  let errores = [];

  for (const cfdi of cfdis || []) {
    try {
      // 2. PASO 1: Buscar ingreso registrado (CobraCheck)
      const { data: cobro } = await supabase
        .from('cobros')
        .select('*')
        .eq('empresa_id', empresa_id)
        .eq('cliente_rfc', cfdi.cliente_rfc)
        .eq('monto', cfdi.monto)
        .gte('fecha_pago', new Date(cfdi.fecha_emision.getTime() - 2 * 24 * 60 * 60 * 1000))
        .lte('fecha_pago', new Date(cfdi.fecha_emision.getTime() + 30 * 24 * 60 * 60 * 1000))
        .single();

      // 3. PASO 2: Buscar movimiento bancario
      let movimiento = null;
      if (cobro) {
        const { data: mov } = await supabase
          .from('movimientos_financieros')
          .select('*')
          .eq('empresa_id', empresa_id)
          .eq('monto', cfdi.monto)
          .gte('fecha', new Date(cobro.fecha_pago.getTime() - 2 * 24 * 60 * 60 * 1000))
          .lte('fecha', new Date(cobro.fecha_pago.getTime() + 2 * 24 * 60 * 60 * 1000))
          .single();

        movimiento = mov;
      }

      // 4. Determinar estado
      let tipo = 'INCOMPLETA';
      let cfdi_ok = true;
      let cobro_ok = false;
      let bancario_ok = false;

      if (cobro && movimiento) {
        tipo = 'COMPLETA';
        cobro_ok = true;
        bancario_ok = true;
      } else if (cobro) {
        tipo = 'PARCIAL';
        cobro_ok = true;
      }

      const confianza = (cfdi_ok ? 33 : 0) + (cobro_ok ? 33 : 0) + (bancario_ok ? 34 : 0);

      // 5. Crear reconciliación
      await supabase.from('reconciliacion_triple').insert({
        empresa_id,
        cfdi_emitido_id: cfdi.id,
        cobro_id: cobro?.id,
        movimiento_bancario_id: movimiento?.id,
        monto_cfdi: cfdi.monto,
        monto_cobro: cobro?.monto,
        monto_bancario: movimiento?.monto,
        tipo,
        estado: 'RECONCILIADO',
        cfdi_ok,
        cobro_ok,
        bancario_ok,
        confianza,
      });

      // 6. Actualizar CFDI
      await supabase
        .from('cfdi_emitidos')
        .update({
          ingreso_cobracheck_id: cobro?.id,
          movimiento_bancario_id: movimiento?.id,
          pagado: movimiento ? true : false,
          reconciliado_en: new Date(),
        })
        .eq('id', cfdi.id);

      // 7. Actualizar cobro
      if (cobro) {
        await supabase
          .from('cobros')
          .update({
            cfdi_emitido_id: cfdi.id,
            movimiento_bancario_id: movimiento?.id,
            estado_reconciliacion: movimiento ? 'RECONCILIADO' : 'SIN_BANCARIO',
          })
          .eq('id', cobro.id);
      }

      reconciliadas++;
    } catch (error) {
      errores.push({ cfdi_id: cfdi.id, error: String(error) });
    }
  }

  return new Response(JSON.stringify({ reconciliadas, errores }));
});
```

---

## 🎨 DASHBOARD COBRACHECK (Visibilidad 360°)

```typescript
// components/CobraCheckDashboard.tsx

interface CobraCheckMetrics {
  totalFacturasEmitidas: number;
  totalCobrosRegistrados: number;
  totalMovimientosBancarios: number;
  
  reconciliacionesCompletas: number;
  reconciliacionesParciales: number;
  reconciliacionesIncompletas: number;
  
  porcentajeCobro: number;
  montoFacturado: number;
  montoCobrado: number;
  montoFaltante: number;
  
  duplicadosDetectados: number;
  descuadres: number;
}

export function CobraCheckDashboard() {
  const [metrics, setMetrics] = useState<CobraCheckMetrics | null>(null);
  const [filtros, setFiltros] = useState({
    periodo: 'mes',
    cliente: '',
    estado: 'todos', // todos, reconciliado, pendiente, duplicado, descuadre
  });

  useEffect(() => {
    cargarMetricas();
  }, [filtros]);

  async function cargarMetricas() {
    const res = await fetch('/api/cobracheck/metricas', {
      method: 'POST',
      body: JSON.stringify(filtros),
    });
    setMetrics(await res.json());
  }

  return (
    <div className="cobracheck-dashboard">
      <section className="metricas-principales">
        <MetricaCard
          titulo="Facturas Emitidas"
          valor={metrics?.totalFacturasEmitidas}
          color="azul"
        />
        <MetricaCard
          titulo="Cobros Registrados"
          valor={metrics?.totalCobrosRegistrados}
          color="verde"
        />
        <MetricaCard
          titulo="Ingresos Confirmados en Banco"
          valor={metrics?.totalMovimientosBancarios}
          color="verde-oscuro"
        />
      </section>

      <section className="reconciliacion-status">
        <h3>Estado de Reconciliación</h3>
        <ProgressBar
          label="Completa (3 fuentes match)"
          valor={metrics?.reconciliacionesCompletas}
          total={metrics?.totalFacturasEmitidas}
          color="verde"
        />
        <ProgressBar
          label="Parcial (2 de 3 fuentes)"
          valor={metrics?.reconciliacionesParciales}
          total={metrics?.totalFacturasEmitidas}
          color="amarilla"
        />
        <ProgressBar
          label="Incompleta (1 de 3 fuentes)"
          valor={metrics?.reconciliacionesIncompletas}
          total={metrics?.totalFacturasEmitidas}
          color="roja"
        />
      </section>

      <section className="analisis-cobranza">
        <h3>Análisis de Cobranza</h3>
        <div className="grid">
          <StatBox
            label="Monto Facturado"
            valor={`$${metrics?.montoFacturado.toLocaleString()}`}
          />
          <StatBox
            label="Monto Cobrado"
            valor={`$${metrics?.montoCobrado.toLocaleString()}`}
            highlight="positivo"
          />
          <StatBox
            label="Monto Faltante"
            valor={`$${metrics?.montoFaltante.toLocaleString()}`}
            highlight="negativo"
          />
          <StatBox
            label="% Cobranza"
            valor={`${metrics?.porcentajeCobro.toFixed(1)}%`}
            destacado={metrics?.porcentajeCobro > 80}
          />
        </div>
      </section>

      <section className="alertas-criticas">
        <h3>⚠️ Alertas</h3>
        {metrics?.duplicadosDetectados > 0 && (
          <Alert
            tipo="warning"
            titulo={`${metrics.duplicadosDetectados} ingresos duplicados`}
            accion="Ver duplicados"
            onClick={() => setFiltros({ ...filtros, estado: 'duplicado' })}
          />
        )}
        {metrics?.descuadres > 0 && (
          <Alert
            tipo="error"
            titulo={`${metrics.descuadres} descuadres de montos`}
            accion="Revisar descuadres"
            onClick={() => setFiltros({ ...filtros, estado: 'descuadre' })}
          />
        )}
      </section>

      <section className="tabla-detallada">
        <h3>Detalle de Facturas (Filtrable)</h3>
        <TablaReconciliacion
          datos={cfdisReconciliados}
          columnas={[
            { key: 'folio', label: 'Folio' },
            { key: 'cliente_nombre', label: 'Cliente' },
            { key: 'monto', label: 'Monto' },
            { key: 'fecha_emision', label: 'Fecha Emisión' },
            { key: 'estado_factura', label: 'Factura' },
            { key: 'estado_ingreso', label: 'Ingreso (CobraCheck)' },
            { key: 'estado_banco', label: 'Movimiento (BancoCheck)' },
            { key: 'estado_reconciliacion', label: 'Estado General' },
            { key: 'acciones', label: 'Acciones' },
          ]}
          filtrable
          exportable
        />
      </section>
    </div>
  );
}
```

---

## 📡 API ROUTES

### **GET /api/cobracheck/metricas**

```
Retorna:
- Total facturas emitidas
- Total cobros registrados
- Total movimientos bancarios
- Reconciliaciones: completas/parciales/incompletas
- % de cobranza
- Montos: facturado/cobrado/faltante
- Duplicados detectados
- Descuadres
```

### **GET /api/cobracheck/facturas**

```
Retorna: Lista de facturas con estado detallado
Filtros: cliente, periodo, estado_reconciliacion
Columnas:
- Folio + UUID CFDI
- Cliente (RFC + nombre)
- Monto
- Fecha emisión
- ✅/⚠️/❌ Ingreso registrado
- ✅/⚠️/❌ Movimiento en banco
- Estado general (RECONCILIADA|PENDIENTE|DUPLICADA|DESCUADRE)
```

### **GET /api/cobracheck/duplicados**

```
Retorna: Ingresos/facturas duplicadas
Para cada duplicado:
- IDs duplicados
- Monto
- Cliente
- Fecha
- Acción: Marcar como duplicado, Consolidar, Eliminar
```

### **GET /api/cobracheck/discrepancias**

```
Retorna: Descuadres (montos no coinciden)
Tipos:
- CFDI $5000, Ingreso registrado $5000, Banco $4800
- CFDI $5000, Ingreso registrado $5100, Banco $5100
```

### **POST /api/cobracheck/reconciliar-manual**

```
Vincular manualmente:
- Factura ↔ Ingreso
- Ingreso ↔ Movimiento banco
```

---

## 🔐 SEGURIDAD

```
✅ Solo ver facturas de propia empresa (RLS)
✅ Solo contar/categorizar, no eliminar facturas
✅ Auditoría de quién reconcilió qué y cuándo
✅ Encriptación de datos sensibles (RFC)
✅ Validación de duplicados automática
✅ Detección de anomalías (ej: 10 ingresos del mismo cliente el mismo día)
```

---

## 📈 RESULTADO: VISIBILIDAD TOTAL

```
CONTADOR ANTES:
❌ "¿Cobros totales?" → Revisar manualmente
❌ "¿Todas las facturas se cobraron?" → Horas de trabajo
❌ "¿Hay duplicados?" → Esperar auditoria
❌ "¿Qué no coincide?" → No sé

CONTADOR DESPUÉS (CobraCheck + SAT + Banco):
✅ "Facturas emitidas: $100,000"
✅ "Cobros registrados: $95,000"
✅ "Confirmado en banco: $93,000"
✅ "Estado: 95 reconciliadas, 3 pendientes, 2 duplicadas"
✅ Facturas pendientes listadas con cliente y monto
✅ Duplicados detectados automáticamente
✅ Descuadres visibles al instante
✅ Todo auditable para SAT
```

