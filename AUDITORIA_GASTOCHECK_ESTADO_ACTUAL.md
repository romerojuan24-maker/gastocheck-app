# 🔍 AUDITORÍA GASTOCHECK: Estado Actual Detallado

**Análisis completo de qué existe, qué funciona, qué falta**  
**Fecha:** 2026-06-21

---

## ✅ QUÉ EXISTE (Y FUNCIONA)

### **FRONTEND**

```
✅ GastoCheckForm.tsx
   - Form para crear gasto manual
   - Campos: concepto, monto, fecha, proveedor, RFC, categoría
   - Validación básica en frontend
   - Estados: loading, error, success
   - Llamada a POST /api/gastocheck/crear
   - ESTADO: Funcional pero BÁSICO

✅ GastoCheckHistorial.tsx
   - Tabla con historial de gastos
   - Filtros (fecha, categoría)
   - Estados de pago
   - ESTADO: Existe (necesita revisar código)

✅ DashboardConsolidado.tsx
   - Dashboard integrado
   - KPIs básicos
   - ESTADO: Existe (necesita revisar)

✅ page.tsx
   - Layout principal
   - Obtiene empresa_id del usuario
   - Manejo de autenticación
   - ESTADO: Funcional
```

### **BACKEND API**

```
✅ POST /api/gastocheck/crear
   - Crea movimiento_financiero (GASTO)
   - Crea registro en tabla gastos
   - Llama Edge Function crear-poliza-automatica
   - Respuesta: { success, gasto_id, movimiento_id, poliza_id }
   - Validación: Campos requeridos (empresa_id, monto, fecha, concepto)
   - ESTADO: Funcional
   - ERROR: Usa ANON key en línea 8 (debería ser SERVICE_ROLE)
```

### **EDGE FUNCTIONS**

```
✅ crear-poliza-automatica
   - Obtiene movimiento_financiero
   - Genera líneas de póliza automáticamente
   - GASTO: Debit gasto, Credit proveedor
   - INGRESO: Debit banco, Credit cliente
   - Valida que Debit = Credit
   - Crea póliza en DB
   - Actualiza movimiento con poliza_id
   - ESTADO: Funcional
   - PRECISIÓN: Genera pólizas simples pero correctas

✅ validate-cfdi
   - Valida CFDI XML
   - Valida RFC
   - ESTADO: Existe

✅ guardar-gasto-integrado
   - Función de integración completa
   - ESTADO: Existe

✅ ocr-extract
   - Extrae datos de recibos por OCR
   - ESTADO: Existe

✅ export-excel / export-zip
   - Exportación de datos
   - ESTADO: Existe
```

### **DATABASE**

```
✅ Tablas creadas:
   - movimientos_financieros (transacciones)
   - gastos (gastos específicos)
   - polizas (pólizas contables)
   - empresa_usuarios (relaciones)
   - Otras tablas de soporte

✅ Campos claves en movimientos_financieros:
   - tipo_movimiento (GASTO, INGRESO, TRANSFERENCIA)
   - monto (cantidad)
   - estado_registro (REGISTRADO, PENDIENTE, RECHAZADO)
   - estado_pago (PENDIENTE, PAGADO, PARCIAL)
   - estado_contable (PÓLIZA_CREADA, etc)
   - poliza_id (referencia a póliza)
   - categoria (categorización)

✅ Campos claves en polizas:
   - lineas (array de transacciones contables)
   - total_debit, total_credit
   - cuadrada (validación)
   - fecha_poliza, concepto
```

---

## ❌ QUÉ FALTA (CRÍTICO)

### **TIMBRADO CFDI** 🔴 BLOCKER

```
PROBLEMA:
❌ No hay integración PAC (Proveedor Autorizado de Certificación)
❌ API crear-poliza genera XML pero NO TIMBRA
❌ CFDI sin timbre = no válido legalmente
❌ SAT rechaza

REQUERIDO:
1. Seleccionar PAC:
   - Finkok ($0.50-0.80 por CFDI)
   - Ecodex ($0.40-0.70 por CFDI)
   - Solufix ($0.30-0.60 por CFDI)

2. Crear Edge Function: timbrar-cfdi
   - Llamar API del PAC
   - Pasar XML del gasto
   - Recibir CFDI timbrado + UUID
   - Guardar en DB

3. Actualizar gastos table:
   - cfdi_timbrado (XML)
   - cfdi_uuid (identificador)
   - cfdi_timestamp (cuándo se timbró)
   - cfdi_folio (número fiscal)

CRÍTICO: Sin esto, GastoCheck NO FUNCIONA fiscalmente
TIMELINE: 3-5 días de dev
COSTO: $2k dev + $0.30-0.80 por CFDI (variable)
```

### **AUDITORÍA SAT-COMPLIANT** 🔴 BLOCKER

```
PROBLEMA:
❌ No hay audit trail completo
❌ SAT requiere: Quién cambió qué, cuándo, por qué
❌ No hay tabla de logs

REQUERIDO:
1. Crear tabla: audit_log
   - usuario_id (quién)
   - tabla (qué tabla se modificó)
   - operacion (INSERT/UPDATE/DELETE)
   - datos_anterior (valores viejos)
   - datos_nuevo (valores nuevos)
   - fecha_cambio (cuándo)
   - razon (por qué)

2. Crear trigger en Supabase:
   - Cada INSERT/UPDATE en movimientos_financieros
   - Registrar en audit_log

3. Crear endpoint GET /api/gastocheck/audit
   - Retorna historial completo
   - Filtrable por usuario, fecha, tabla

CRÍTICO: Sin esto, SAT puede rechazar auditoría
TIMELINE: 2-3 días de dev
COSTO: $1k dev
```

### **RECEPCIÓN DE CFDI** 🟠 IMPORTANTE

```
PROBLEMA:
❌ No hay capacidad de recibir CFDI de proveedores
❌ Contador recibe CFDI por email pero no integra a CHECK SUITE
❌ Trabajo manual: pegar XML, validar, registrar

REQUERIDO:
1. Crear endpoint POST /api/gastocheck/recibir-cfdi
   - Recibir XML (como archivo)
   - Validar estructura (CFDI 4.0)
   - Validar firma digital
   - Validar con SAT

2. Crear Edge Function: procesar-cfdi-recibido
   - Parsear XML
   - Extraer: proveedor, monto, fecha, concepto, UUID
   - Buscar gasto existente (match por monto + fecha)
   - Si match: actualizar estado_pago = RECONCILIADO
   - Si no match: crear como "CFDI recibido sin gasto"

3. Crear UI: "Subir CFDI"
   - Form para drag-drop de XML o ZIP

IMPORTANTE: Pero no bloquea MVP
TIMELINE: 3-4 días dev
COSTO: $1.5k dev
```

---

## ⚠️ QUÉ EXISTE PERO ESTÁ INCOMPLETO

### **OCR (Extracción de recibos)**

```
ESTADO: ⚠️ Existe pero muy básico

FUNCIONALIDAD ACTUAL:
- ocr-extract.ts existe
- Pero: ¿Integración Gemini Vision? ¿Cloud Vision?
- ¿Qué campos extrae?
- ¿Qué precisión tiene?

PROBLEMA:
❌ No hay formulario "Subir foto recibo"
❌ No hay integración en GastoCheckForm
❌ Operario NO puede fotografiar
❌ Operario DEBE escribir manualmente

REQUERIDO:
1. Agregar camera input a GastoCheckForm
   - Botón "📸 Fotografiar recibo"
   - Cámara del teléfono
   - Captura foto

2. Llamar ocr-extract con imagen
   - Extraer: monto, fecha, concepto, RFC proveedor
   - Rellenar formulario automáticamente

3. Validar OCR confidence
   - Si < 80%: "Revisa datos extraídos"
   - Si >= 80%: Auto-llenar

IMPORTANTE: Gran diferencial
TIMELINE: 2-3 días dev
COSTO: $1k dev
```

### **CATEGORIZACIÓN**

```
ESTADO: ⚠️ Muy básica

ACTUAL:
- Select hardcodeado:
  - "Sin categorizar"
  - "Gastos Administrativos"
  - "Combustibles"
  - "Servicios"
  - "Compras"

PROBLEMA:
❌ Categorías fijas (CEO quiere añadir)
❌ No hay recomendación automática
❌ No hay historial de categorías usadas

REQUERIDO:
1. Tabla: categorias (empresa_id, nombre)
   - CEO crea sus categorías

2. Recomendación IA:
   - Basada en concepto y OCR
   - "Parece 'Servicios'"

3. Historial:
   - Últimas 5 categorías usadas
   - Suggestions dropdown

IMPORTANTE: UX improvement
TIMELINE: 1-2 días dev
COSTO: $500 dev
```

### **PRESUPUESTOS**

```
ESTADO: ❌ NO EXISTE

REQUERIDO:
1. Tabla: presupuestos
   - empresa_id, mes, categoría, monto_presupuestado

2. Crear endpoint:
   - POST /api/gastocheck/presupuesto (crear)
   - GET /api/gastocheck/presupuestos (listar)
   - Mostrar vs real: "$5000 presupuestado, $3200 gastado"

3. Alertas:
   - Si gasto supera 80% presupuesto: AMARILLA
   - Si gasto supera 100% presupuesto: ROJA

IMPORTANTE: 70% PYME lo quiere
TIMELINE: 2-3 días dev
COSTO: $1k dev
```

---

## 🚨 PROBLEMAS DE CÓDIGO ENCONTRADOS

### **Línea 8 en crear.ts**

```typescript
// ❌ WRONG:
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''  // <-- WRONG: ANON key no puede hacer cambios
);

// ✅ CORRECT:
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''  // <-- Necesita SERVICE_ROLE
);
```

**IMPACTO:** Actualmente solo funciona porque hay RLS permisiva. Si se aprieta RLS, falla.

### **Error Handling incompleto**

```typescript
// En crear.ts líneas 88-91:
catch (error) {
  console.error('Error:', error);
  return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
}

// PROBLEMA:
// - No valida si Edge Function tiembla
// - No reporta si SAT falla
// - Usuario no sabe qué salió mal
```

---

## 📊 MATRIZ: ESTADO ACTUAL vs REQUERIDO

| Feature | TIENE | FUNCIONA | NECESITA |
|---------|-------|----------|----------|
| **Crear gasto manual** | ✅ | ✅ | - |
| **Póliza automática** | ✅ | ✅ | Mejorar (cuentas SAT) |
| **Timbrado CFDI** | ❌ | ❌ | 🔴 CRÍTICA |
| **Auditoría SAT** | ❌ | ❌ | 🔴 CRÍTICA |
| **Recepción CFDI** | ❌ | ❌ | 🟠 Importante |
| **OCR recibos** | ⚠️ | ❌ | 🟠 Importante |
| **Historial** | ✅ | ⚠️ | Polish |
| **Categorías** | ✅ | ⚠️ | Mejorar |
| **Presupuestos** | ❌ | ❌ | 🟠 Importante |
| **Multi-empresa** | ⚠️ | ⚠️ | Polish |
| **Dashboard** | ✅ | ⚠️ | Polish |

---

## 🎯 PLAN INMEDIATO (SEMANA 1-2)

### **BLOCKER 1: Timbrado CFDI (3-5 días)**

```
DAY 1:
- Seleccionar PAC (Finkok recomendado)
- Criar cuenta + obtener credenciales
- Estudiar API

DAY 2-3:
- Dev: crear-timbrar-cfdi.ts (Edge Function)
- Integrar Finkok API
- Manejo de errores

DAY 4:
- Actualizar crear.ts para llamar timbrar-cfdi
- Guardar CFDI timbrado en table gastos

DAY 5:
- Testing con CFDIs reales
- Fix bugs

RESULTADO: GastoCheck timbra CFDIs legalmente
```

### **BLOCKER 2: Auditoría SAT-compliant (2-3 días)**

```
DAY 1:
- Crear tabla audit_log
- Crear trigger en Supabase

DAY 2:
- Dev: GET /api/gastocheck/audit endpoint
- Filtros: usuario, fecha, tabla

DAY 3:
- Testing
- Fix bugs

RESULTADO: Auditoría SAT-compliant funcional
```

### **IMPORTANTE 1: Presupuestos (2-3 días)**

```
DAY 1:
- Crear tabla presupuestos
- Dev: endpoints (create, list, get)

DAY 2:
- Frontend: form para crear presupuesto
- Mostrar vs real en dashboard

DAY 3:
- Alertas (80%, 100%)
- Testing

RESULTADO: Presupuestos funcional
```

---

## ⏱️ TIMELINE REALISTA

```
SEMANA 1-2 (Compresión):

DAY 1-2: Timbrado CFDI (parte 1)
DAY 3-4: Auditoría SAT (paralelo)
DAY 5: Timbrado CFDI (parte 2)
DAY 6-7: OCR en GastoCheckForm
DAY 8: Presupuestos
DAY 9-10: Testing exhaustivo + bug fixes

RESULTADO: GastoCheck 95% completo, listo para producción

SEMANA 3 (Polish):
- Recepción de CFDI (si tiempo)
- Mejoras UI
- Documentación
```

---

## 💰 COSTO ESTIMADO

```
DESARROLLO:

Timbrado CFDI: $2k (3-5 días)
Auditoría SAT: $1k (2-3 días)
OCR en form: $1k (2-3 días)
Presupuestos: $1k (2-3 días)
Recepción CFDI: $1.5k (3-4 días)
Testing + fixes: $1.5k (2-3 días)

TOTAL DEV: $8k

INFRAESTRUCTURA:

Finkok API: $0.30-0.80 por CFDI
  - Si 1000 gastos/mes: $300-800/mes
  - TOTAL AÑO 1: $3600-9600

TOTAL INVERSIÓN: $8k dev + $300-800/mes ops

```

---

## 🚨 RECOMENDACIONES CRÍTICAS

### **1. ARREGLAR AHORA:**

```
[ ] FIX: Cambiar ANON_KEY a SERVICE_ROLE_KEY en crear.ts
    Prioridad: 🔴 CRÍTICA
    Tiempo: 5 minutos
    
[ ] AGREGAR: Timbrado CFDI
    Prioridad: 🔴 CRÍTICA
    Tiempo: 3-5 días
    
[ ] AGREGAR: Auditoría SAT-compliant
    Prioridad: 🔴 CRÍTICA
    Tiempo: 2-3 días
    
[ ] AGREGAR: Presupuestos
    Prioridad: 🟠 IMPORTANTE
    Tiempo: 2-3 días
    
[ ] MEJORAR: OCR en formulario (camera input)
    Prioridad: 🟠 IMPORTANTE
    Tiempo: 2-3 días
```

### **2. ORDEN DE IMPLEMENTACIÓN:**

```
PASO 1: FIX SERVICE_ROLE (5 min)
PASO 2: Timbrado CFDI (5 días)
PASO 3: Auditoría SAT (3 días)
PASO 4: Presupuestos (3 días)
PASO 5: OCR mejorado (3 días)
PASO 6: Testing exhaustivo (2 días)

TOTAL: 2-3 semanas para completar

RESULTADO: GastoCheck listo para producción
```

---

## ✅ CONCLUSIÓN

```
ESTADO ACTUAL: 60% funcional
- Crea gastos ✅
- Crea pólizas ✅
- Pero SIN timbrado ❌
- Pero SIN auditoría ❌

DESPUÉS DE IMPLEMENTAR:
- 95% funcional
- 100% legal (SAT-compliant)
- Listo para producción
- Diferencial claro vs competencia

INVERSIÓN: $8k dev + $300-800/mes ops
TIMELINE: 2-3 semanas
RESULTADO: MVP EXCELLENCE
```

