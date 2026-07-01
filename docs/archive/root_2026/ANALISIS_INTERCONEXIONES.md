# 📊 ANÁLISIS DE INTERCONEXIONES ENTRE MÓDULOS

**Fecha:** 2026-06-21 | **Objetivo:** Mapear flujo de datos entre todos los módulos

---

## 🔄 FLUJO DE DATOS INTEGRADO

```
OPERARIOS (MÓVIL)
├─ GastoCheck: Captura gasto
│  └─ OUTPUT: {gasto_id, monto, fecha, categoria, proveedor}
│
├─ CobraCheck: Registra cliente + factura + pago
│  ├─ OUTPUT: {cliente_id, factura_id, monto, fecha_vencimiento}
│  └─ OUTPUT: {pago_id, monto, fecha_pago}
│
└─ Inventarios: Registra entrada/salida
   └─ OUTPUT: {producto_id, cantidad, tipo, stock_nuevo}

         ↓↓↓ MÁQUINA CENTRAL ↓↓↓

TABLA CENTRAL: movimientos_financieros
├─ GastoCheck INSERT: {
│  │ tipo_movimiento: 'GASTO'
│  │ monto: negativo (egreso)
│  │ estado_pago: PENDIENTE
│  │ gasto_id: referencia
│  │ fecha: de captura
│  └─ OUTPUT PARA: CobraCheck, BancoCheck, FlujoCheck, CheckIA
│
├─ CobraCheck INSERT: {
│  │ tipo_movimiento: 'INGRESO'
│  │ monto: positivo
│  │ estado_pago: PENDIENTE (hasta pagarse)
│  │ factura_id: referencia
│  │ fecha: de cobro
│  └─ OUTPUT PARA: BancoCheck, FlujoCheck, CheckIA
│
└─ BancoCheck UPDATE: {
   │ tipo_movimiento: GASTO o INGRESO
   │ estado_pago: PAGADO ← CLAVE: reconciliado
   │ banco_movimiento_id: referencia
   │ es_reconciliado: true
   └─ OUTPUT PARA: FlujoCheck (proyección), Dashboard (caja cuadrada)

         ↓↓↓ CÁLCULOS AUTOMÁTICOS ↓↓↓

PÓLIZAS (Automático):
├─ Cuando INSERT movimiento:
│  └─ CREATE póliza {débito, crédito}
├─ CONSUME: movimientos_financieros
└─ PRODUCE: polizas (para contabilidad)

         ↓↓↓ ANÁLISIS & PROYECCIONES ↓↓↓

FlujoCheck:
├─ CONSUME: movimientos_financieros (últimos 30 días)
├─ CALCULA: promedio gasto diario
├─ LEE: facturas pendientes (ingresos futuros)
├─ PROYECTA: 30 días adelante
└─ DETECTA: alertas de saldo bajo

CheckIA:
├─ CONSUME: movimientos_financieros (últimos 90 gastos)
├─ ANALIZA: anomalías (z-score)
├─ AGRUPA: por categoría (clustering)
├─ DETECTA: fraude, patrones inusuales
└─ ALERTAS: severidad MEDIA/ALTA/CRÍTICA

Dashboard Consolidado:
├─ CONSUME:
│  ├─ movimientos_financieros (saldos)
│  ├─ polizas (contabilidad)
│  ├─ facturas pendientes (cobranza)
│  ├─ banco_movimientos (reconciliación)
│  └─ inventario_productos (stock)
├─ CALCULA:
│  ├─ KPIs totales
│  ├─ % reconciliación
│  ├─ Caja esperada vs real
│  └─ Alertas globales
└─ MUESTRA: Vista integral 360°

Inventarios:
├─ INDEPENDIENTE en BD (tabla separada)
├─ PERO: registra cambios en movimientos_financieros si hay compra
├─ CONSUME: órdenes automáticas (cuando stock < mínimo)
└─ PRODUCE: alertas para supervisor
```

---

## 📈 MATRIZ DE INTERCONEXIONES

```
              │ GastoCheck │ CobraCheck │ BancoCheck │ FlujoCheck │ CheckIA │ Inventarios
──────────────┼────────────┼────────────┼────────────┼────────────┼─────────┼─────────────
GastoCheck    │     -      │     ✅     │     ✅     │     ✅     │    ✅   │     ✅
CobraCheck    │     ✅     │     -      │     ✅     │     ✅     │    ✅   │     ✅
BancoCheck    │     ✅     │     ✅     │     -      │     ✅     │    ✅   │     -
FlujoCheck    │     ✅     │     ✅     │     ✅     │     -      │    -    │     -
CheckIA       │     ✅     │     ✅     │     -      │     -      │    -    │     -
Inventarios   │     ✅     │     -      │     -      │     ✅     │    -    │     -
```

---

## 🔗 CONSUMO & PRODUCCIÓN DETALLADO

### **1. GastoCheck**

**PRODUCE:**
```javascript
movimientos_financieros {
  id,
  empresa_id,
  tipo_movimiento: 'GASTO',
  monto: -XXX,
  fecha_evento: fecha_captura,
  estado_pago: 'PENDIENTE',
  estado_registro: 'CAPTURADO',
  estado_contable: 'PENDIENTE',
  gasto_id: referencia,
  categoria,
  concepto,
  proveedor
}
// INMEDIATAMENTE: CREATE póliza automática
```

**LO USAN:**
- ✅ **CobraCheck:** Busca si hay pago correspondiente (monto + fecha)
- ✅ **BancoCheck:** Busca reconciliación (egreso bancario ↔ gasto)
- ✅ **FlujoCheck:** Calcula promedio gasto diario
- ✅ **CheckIA:** Detecta anomalías (z-score vs promedio)
- ✅ **Dashboard:** KPI "Gastos totales" + alertas

---

### **2. CobraCheck**

**PRODUCE:**
```javascript
movimientos_financieros {
  id,
  empresa_id,
  tipo_movimiento: 'INGRESO',
  monto: +XXX,
  fecha_evento: fecha_cobro,
  estado_pago: 'PENDIENTE' → 'PAGADO' (cuando se registra pago)
  estado_registro: 'REGISTRADO',
  estado_contable: 'PENDIENTE',
  factura_id: referencia,
  cliente_id: referencia,
  monto_adeudado
}
// INMEDIATAMENTE: CREATE póliza automática
```

**LO USAN:**
- ✅ **GastoCheck:** Ve si hay ingresos en el dashboard
- ✅ **BancoCheck:** Busca reconciliación (ingreso bancario ↔ pago)
- ✅ **FlujoCheck:** Usa facturas pendientes como ingresos futuros
- ✅ **CheckIA:** Detecta anomalías en ingresos
- ✅ **Dashboard:** KPI "Ingresos totales" + cobranza pending

---

### **3. BancoCheck**

**CONSUME:**
```javascript
// Lee movimientos_financieros para reconciliar:
gastos_pendientes = SELECT FROM movimientos_financieros
  WHERE estado_pago = 'PENDIENTE' AND tipo = 'GASTO'

pagos_pendientes = SELECT FROM movimientos_financieros
  WHERE estado_pago = 'PENDIENTE' AND tipo = 'INGRESO'

// Lee banco_movimientos
banco_movimientos = SELECT FROM banco_movimientos
  WHERE fecha BETWEEN hoy-7 AND hoy
```

**PRODUCE:**
```javascript
// UPDATE movimientos_financieros cuando detecta match:
UPDATE movimientos_financieros SET
  estado_pago = 'PAGADO',
  banco_movimiento_id = XXX,
  es_reconciliado = true,
  fecha_reconciliacion = hoy
WHERE id = matched_movimiento_id

// TAMBIÉN produce: INSERT banco_movimientos (si Plaid lo trae)
// TAMBIÉN detecta: alertas de discrepancias
```

**LO USAN:**
- ✅ **FlujoCheck:** Usa estado_pago = PAGADO para proyección
- ✅ **Dashboard:** "Caja cuadra 100%" se calcula con movimientos PAGADOS
- ✅ **CheckIA:** Detecta discrepancias (gasto registrado pero no en banco)
- ✅ **GastoCheck/CobraCheck:** VEN que fue reconciliado

---

### **4. FlujoCheck**

**CONSUME:**
```javascript
// Últimos 30 días de gastos
SELECT SUM(monto) FROM movimientos_financieros
WHERE tipo = 'GASTO' AND fecha > hoy-30

// Facturas pendientes (ingresos futuros)
SELECT * FROM movimientos_financieros
WHERE tipo = 'INGRESO' AND estado_pago = 'PENDIENTE'
  AND fecha_evento <= hoy+30

// Saldo actual
SELECT SUM(monto) FROM movimientos_financieros
WHERE (tipo = 'GASTO' OR tipo = 'INGRESO')
```

**PRODUCE:**
```javascript
// Proyección con alertas:
{
  dia: 1-30,
  saldo_proyectado: XXX,
  es_bajo: saldo < 10k,
  es_critico: saldo < 5k,
  alertas: [...],
  recomendaciones: [...]
}
```

**LO USAN:**
- ✅ **Dashboard:** Muestra "Saldo mínimo próximos 30 días"
- ✅ **Contador:** Toma decisiones sobre cobros/gastos
- ✅ **Inventarios:** Sabe si hay presupuesto para órdenes

---

### **5. CheckIA**

**CONSUME:**
```javascript
// Últimos 90 gastos
SELECT * FROM movimientos_financieros
WHERE tipo = 'GASTO' ORDER BY fecha DESC LIMIT 90

// Calcula estadísticas
promedio = AVG(monto)
desv_est = STDDEV(monto)

// Agrupa por categoría
SELECT categoria, SUM(monto), AVG(monto)
GROUP BY categoria
```

**PRODUCE:**
```javascript
// Anomalías detectadas:
{
  anomalia: {
    id,
    monto,
    z_score: XXX,
    severity: 'MEDIA|ALTA|CRÍTICA',
    razon: 'texto explicativo',
    accion: 'qué hacer'
  },
  clustering: [
    { categoria, promedio, total, desviacion }
  ],
  patrones: [
    { tipo, descripcion, accion }
  ]
}
```

**LO USAN:**
- ✅ **Dashboard:** Muestra "X anomalías detectadas"
- ✅ **Supervisor:** Revisa gastos sospechosos
- ✅ **Auditoría:** Detecta fraude interno

---

### **6. Inventarios**

**CONSUME:**
```javascript
// Cuando registra entrada/salida
movimiento = {
  producto_id,
  cantidad,
  tipo: 'ENTRADA|SALIDA'
}

// Lee stock actual
SELECT stock_actual, stock_minimo, stock_maximo
FROM inventario_productos WHERE id = producto_id
```

**PRODUCE:**
```javascript
// UPDATE stock:
UPDATE inventario_productos SET
  stock_actual = stock_nuevo,
  fecha_ultima_actualizacion = hoy
WHERE id = producto_id

// INSERT movimiento (auditoría):
INSERT INTO inventario_movimientos {
  producto_id,
  tipo,
  cantidad,
  stock_anterior,
  stock_nuevo,
  nota
}

// POSIBLEMENTE INSERT movimientos_financieros si hay COMPRA:
// (cuando supervisor crea orden)
INSERT INTO movimientos_financieros {
  tipo_movimiento: 'GASTO',
  concepto: 'Compra inventario: ' + producto,
  monto: -cantidad * precio_unitario
}
```

**LO USAN:**
- ✅ **Dashboard:** Muestra stock crítico como alerta global
- ✅ **FlujoCheck:** Si se genera orden, afecta proyección (menos caja)
- ✅ **CheckIA:** Detecta patrones de consumo anormal

---

## 🚨 GAPS DE INTEGRACIÓN ACTUAL

### **Gap 1: GastoCheck → Inventarios**
```
❌ PROBLEMA: Cuando se registra un gasto de "Compra de Aceite",
            no actualiza automáticamente el stock

✅ SOLUCIÓN: 
1. Gasto con categoría "Compra" → detecta automático
2. Busca producto en inventarios por nombre
3. Actualiza stock automáticamente
4. Crea movimiento en inventario_movimientos
```

### **Gap 2: BancoCheck → FlujoCheck**
```
❌ PROBLEMA: Si banco llega dinero INESPERADO, proyección no se actualiza

✅ SOLUCIÓN:
1. Cuando BancoCheck detecta reconciliación
2. Actualiza movimientos_financieros a PAGADO
3. FlujoCheck lee estado_pago = PAGADO
4. Proyección se recalcula automáticamente
```

### **Gap 3: Inventarios → Presupuesto**
```
❌ PROBLEMA: Órdenes automáticas de inventarios no afectan FlujoCheck

✅ SOLUCIÓN:
1. Cuando Inventarios genera orden (stock bajo)
2. INSERT movimientos_financieros {tipo: GASTO, concepto: 'Orden inventario'}
3. FlujoCheck automáticamente ve menos caja disponible
4. Dashboard alerta "Orden automática generada, caja -$5000"
```

### **Gap 4: CheckIA → Alertas en Módulos**
```
❌ PROBLEMA: CheckIA detecta anomalía pero no avisa a operarios

✅ SOLUCIÓN:
1. Anomalía CRÍTICA detectada
2. INSERT alertas tabla (nuevo registro)
3. Notificación al supervisor por email/SMS
4. Dashboard muestra badge rojo
5. GastoCheck/CobraCheck muestran "⚠️ Revisar gasto XXX"
```

---

## 📊 MEJORAS PROPUESTAS

### **1. Tabla de ALERTAS Global**
```sql
CREATE TABLE alertas (
  id UUID PRIMARY KEY,
  empresa_id UUID,
  tipo TEXT, -- 'ANOMALIA', 'STOCK_BAJO', 'SALDO_CRITICO', 'RECONCILIACION'
  severidad TEXT, -- 'INFO', 'ADVERTENCIA', 'CRÍTICO'
  descripcion TEXT,
  referencia_id UUID, -- referencia al movimiento/producto/etc
  leida BOOLEAN DEFAULT false,
  fecha_creacion TIMESTAMP,
  fecha_lectura TIMESTAMP
);
```

### **2. Webhooks entre módulos**
```typescript
// Cuando GastoCheck inserta movimiento:
POST /webhooks/gasto-creado → Ejecuta:
  - CheckIA: detecta anomalías
  - BancoCheck: intenta reconciliar
  - FlujoCheck: recalcula proyección
  - Dashboard: actualiza KPIs

// Cuando BancoCheck reconcilia:
POST /webhooks/movimiento-reconciliado → Ejecuta:
  - FlujoCheck: recalcula proyección
  - Dashboard: actualiza "Caja cuadra %"
  - CheckIA: revisa discrepancias resueltas

// Cuando Inventarios stock cae:
POST /webhooks/stock-bajo → Ejecuta:
  - Genera orden automática
  - INSERT movimientos_financieros (GASTO)
  - FlujoCheck: recalcula proyección
  - Dashboard: muestra alerta
```

### **3. Vista Consolidada (movimientos_financieros_view)**
```sql
SELECT
  m.id,
  m.tipo_movimiento,
  m.monto,
  m.estado_pago,
  
  -- Detalles de origen
  CASE 
    WHEN m.gasto_id IS NOT NULL THEN 'GastoCheck'
    WHEN m.factura_id IS NOT NULL THEN 'CobraCheck'
    WHEN m.banco_movimiento_id IS NOT NULL THEN 'BancoCheck'
  END AS origen,
  
  -- Trazabilidad
  m.gasto_id,
  m.factura_id,
  m.banco_movimiento_id,
  
  -- Reconciliación
  m.es_reconciliado,
  m.poliza_id,
  
  -- Proyección
  m.fecha_evento,
  
  -- Análisis
  CASE 
    WHEN m.monto > (SELECT AVG(monto) * 2.5) THEN 'ANOMALÍA'
    ELSE 'OK'
  END AS estado_ia

FROM movimientos_financieros m
WHERE m.empresa_id = $1;
```

---

## 🔄 FLUJO COMPLETO INTEGRADO (EJEMPLO REAL)

```
DÍA 1:
┌─────────────────────────────────────────────────────────────┐
│ Operario A abre GastoCheck                                  │
│ Captura: Foto factura aceite                                │
│ Sistema: OCR extrae → $500                                  │
│ INSERT movimientos_financieros {                            │
│   tipo: GASTO, monto: -500, estado_pago: PENDIENTE         │
│ }                                                            │
│ CREATE póliza automática {débito: GASTOS, crédito: CAJA}   │
└─────────────────────────────────────────────────────────────┘
         ↓ SIMULTÁNEAMENTE:
┌─────────────────────────────────────────────────────────────┐
│ CheckIA lee movimiento nuevo                                │
│ Calcula z-score: 0.5 (normal)                              │
│ Resultado: ✅ OK                                            │
│                                                              │
│ FlujoCheck recalcula promedio                               │
│ Promedio gasto: $400 → $450                                │
│ Proyección día 15: $95,000 → $94,500                      │
│                                                              │
│ Dashboard actualiza                                          │
│ Gastos hoy: $500                                            │
│ Caja esperada: $100,000                                    │
└─────────────────────────────────────────────────────────────┘

DÍA 3:
┌─────────────────────────────────────────────────────────────┐
│ Operario B abre GastoCheck                                  │
│ Captura: Foto factura $50,000 (!!)                         │
│ Sistema: OCR extrae → $50,000                              │
│ INSERT movimientos_financieros {                            │
│   tipo: GASTO, monto: -50000, estado_pago: PENDIENTE      │
│ }                                                            │
│ CREATE póliza automática                                   │
└─────────────────────────────────────────────────────────────┘
         ↓ SIMULTÁNEAMENTE:
┌─────────────────────────────────────────────────────────────┐
│ CheckIA DETECTA ANOMALÍA                                    │
│ z-score: 4.2 (CRÍTICO!)                                    │
│ Razón: 50x el promedio diario                              │
│ Severidad: CRÍTICA 🚨                                      │
│ INSERT alertas {tipo: ANOMALIA, severidad: CRÍTICO}       │
│ → Notifica supervisor por email                            │
│ → Dashboard muestra badge rojo                              │
│                                                              │
│ FlujoCheck recalcula                                        │
│ Proyección día 15: $94,500 → $44,500 (⚠️ BAJO!)          │
│ Detecta: Día 15 es CRÍTICO (saldo < $5k)                  │
│ → Alerta automática: "Presupuesto en riesgo"              │
│                                                              │
│ Dashboard actualiza                                          │
│ Gastos hoy: $50,500                                        │
│ ⚠️ CheckIA: 1 anomalía crítica                            │
│ ⚠️ FlujoCheck: Saldo crítico día 15                       │
│ Recomendación: "Validar gasto de $50,000"                 │
└─────────────────────────────────────────────────────────────┘

DÍA 4 (Supervisor revisa):
┌─────────────────────────────────────────────────────────────┐
│ Supervisor entra en Dashboard                               │
│ Ve:                                                          │
│ ✅ 50 gastos capturados (GastoCheck)                       │
│ ✅ 30 pagos registrados (CobraCheck)                       │
│ ⚠️ 1 anomalía crítica: Gasto $50,000                      │
│ ⚠️ Saldo crítico proyectado para día 15                   │
│ ✅ Caja hoy: $97,000 (actualizado)                        │
│ ✅ 50 pólizas generadas automáticamente                    │
│                                                              │
│ Supervisor clica en anomalía                                │
│ CheckIA muestra: "Razón: 100x el promedio"                │
│ Supervisor valida: "Sí, fue compra de equipamiento"       │
│ → UPDATE movimientos_financieros {revisado: true}         │
│ → Dashboard actualiza: "Anomalía validada ✅"             │
└─────────────────────────────────────────────────────────────┘

DÍA 10 (Banco sincroniza):
┌─────────────────────────────────────────────────────────────┐
│ BancoCheck sincroniza con Plaid                             │
│ Movimientos detectados:                                     │
│ 1. Egreso $500 (fecha: 1/6)  ← Coincide con gasto         │
│ 2. Egreso $50,000 (fecha: 3/6) ← Coincide con gasto       │
│ 3. Ingreso $10,000 (fecha: 5/6) ← Coincide con pago       │
│                                                              │
│ Sistema RECONCILIA automáticamente:                         │
│ UPDATE movimientos_financieros {                            │
│   banco_movimiento_id = XXX,                               │
│   estado_pago = PAGADO,                                    │
│   es_reconciliado = true                                   │
│ } WHERE id IN (...)                                        │
│                                                              │
│ Dashboard actualiza:                                        │
│ Reconciliación: 80 de 80 movimientos PAGADOS ✅            │
│ "CAJA CUADRA 100%"                                        │
│                                                              │
│ FlujoCheck recalcula                                        │
│ Nueva proyección día 15: $44,500 + $10,000 ingreso        │
│ = $54,500 (ya NO es crítico)                              │
│ → Alerta removida automáticamente                          │
│                                                              │
│ CheckIA re-evalúa                                          │
│ Gasto $50,000 ahora tiene estado_pago = PAGADO           │
│ "Validado: gasto realmente fue pagado"                    │
│ → Confianza aumenta de 50% a 95%                          │
└─────────────────────────────────────────────────────────────┘

RESULTADO:
✅ Operarios capturaron datos
✅ Sistema procesó automáticamente
✅ Pólizas generadas
✅ Anomalías detectadas y validadas
✅ Proyección calculada
✅ Banco reconciliado
✅ Caja cuadra 100%
✅ Contador ve TODO integrado en 1 dashboard
⏱️ Tiempo total: < 30 segundos (automático)
```

---

## ✅ CONCLUSIÓN

**La interconexión DEBE ser:**

1. **Síncrona para lecturas:** FlujoCheck lee movimientos_financieros al instante
2. **Asíncrona para triggers:** CheckIA se ejecuta en background cuando hay nuevo movimiento
3. **Webhooks para cascadas:** BancoCheck → FlujoCheck → Dashboard se actualiza en cadena
4. **Tabla central única:** movimientos_financieros es fuente de verdad única
5. **Alertas integradas:** Una anomalía en CheckIA genera alerta global vista en Dashboard
6. **Trazabilidad completa:** Cada movimiento sabe su origen (GastoCheck/CobraCheck/BancoCheck)

**Objetivo final:** Un contador ve UNA pantalla y entiende TODO lo que pasó en la empresa.
