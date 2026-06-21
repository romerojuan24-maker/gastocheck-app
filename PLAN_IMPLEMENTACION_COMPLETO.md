# 🚀 PLAN IMPLEMENTACIÓN COMPLETO: Cierre Total del Flujo

**Objetivo: Todas las funciones operantes + integración contable 100%**  
**Timeline: Implementación total (código generado)**  
**Alcance: 5 Edge Functions + 8 API Routes + 3 Migrations + Sincronización real-time**

---

## 📋 COMPONENTES A IMPLEMENTAR

### **MÓDULO 1: SAT CFDI Integration (GastoCheck)**

#### Edge Function 1.1: Descargar CFDIs del SAT
```
Nombre: descargar-cfdi-sat
Propósito: Descargar CFDIs recibidos del SAT automáticamente
Entrada: empresa_id, período
Salida: Array de CFDIs descargados
Frecuencia: Diaria (cron)
```

#### Edge Function 1.2: Validar y Reconciliar CFDI
```
Nombre: validar-cfdi-compra
Propósito: Validar CFDI contra compra registrada + reconciliar
Entrada: cfdi, empresa_id
Salida: { estado: MATCH|NO_MATCH, compra_id, alertas }
Trigger: Automático cuando llega CFDI
```

#### Edge Function 1.3: Confirmar Compra
```
Nombre: confirmar-compra-cfdi
Propósito: Marcar compra como CONFIRMADA cuando CFDI válido
Entrada: compra_id, cfdi_uuid
Salida: { estado: CONFIRMADA, póliza_id }
Resultado: Póliza contable actualizada
```

---

### **MÓDULO 2: Auto-Reconciliación (CobraCheck + BancoCheck)**

#### Edge Function 2.1: Auto-Reconciliar Ingreso
```
Nombre: reconciliar-ingreso-banco
Propósito: Buscar movimiento en banco para cobro registrado
Entrada: cobro_id, monto, cliente_rfc, fecha
Salida: { movimiento_encontrado: true|false, movimiento_id }
Trigger: Automático cuando se registra cobro
```

#### Edge Function 2.2: Auto-Reconciliar Egreso
```
Nombre: reconciliar-egreso-banco
Propósito: Buscar movimiento en banco para compra registrada
Entrada: compra_id, monto, proveedor_rfc, fecha
Salida: { movimiento_encontrado: true|false, movimiento_id }
Trigger: Automático cuando se confirma compra
```

---

### **MÓDULO 3: Sincronización Contable**

#### Edge Function 3.1: Orquestador de Sincronización
```
Nombre: orquestador-sync-contable
Propósito: Coordinar actualizaciones entre módulos + contabilidad
Entrada: tipo_cambio (COMPRA|INGRESO|PAGO|RECONCILIACIÓN), datos
Salida: { póliza_actualizada, movimiento_actualizado, estado }
Trigger: Automático con cada cambio relevante
```

---

### **API ROUTES A IMPLEMENTAR**

```
POST /api/gastocheck/descargar-cfdi-sat
  → Dispara descarga manual de CFDIs

GET /api/gastocheck/cfdi-pendientes
  → Obtiene CFDIs sin validar

POST /api/gastocheck/validar-cfdi/{cfdi_id}
  → Valida manualmente un CFDI

GET /api/gastocheck/compras-confirmadas
  → Obtiene compras con CFDI validado

POST /api/cobracheck/reconciliar-ingreso/{cobro_id}
  → Busca movimiento en banco para cobro

GET /api/bancocheck/movimientos-no-reconciliados
  → Obtiene movimientos sin asignar a compra/cobro

POST /api/contabilidad/sincronizar
  → Fuerza sincronización manual

GET /api/contabilidad/estado-integracion
  → Estado de sincronización (qué está pendiente)
```

---

### **MIGRATIONS DATABASE**

```
1. Tabla: cfdi_recibidos
   - id, empresa_id, uuid, xml_content, monto, rfc_emisor, fecha_emision
   - compra_id (FK), estado (RECIBIDO|VALIDADO|RECHAZADO)
   - fecha_recepcion, validado_por, alertas

2. Tabla: reconciliaciones
   - id, empresa_id, movimiento_id, compra_id, cobro_id
   - tipo (EGRESO|INGRESO), monto, fecha, confianza (0-100)
   - estado (AUTOMÁTICO|MANUAL|PENDIENTE), quién, cuándo

3. Tabla: sincronizacion_contable
   - id, empresa_id, tipo_cambio (COMPRA|INGRESO|PAGO|RECONCILIACIÓN)
   - origen_id (compra_id|cobro_id), póliza_id
   - estado (SINCRONIZADO|FALLO|PENDIENTE), error_msg, intentos
   - fecha_sync, próxima_retry
```

---

## 🔄 FLUJOS COMPLETOS INTEGRADOS

### **FLUJO 1: Compra Completa (GastoCheck → SAT → Banco → Contabilidad)**

```
PASO 1: Operario registra compra
  POST /api/gastocheck/crear
  → INSERT gastos
  → TRIGGER: crear-póliza-automática
  → INSERT polizas
  → Resultado: Compra REGISTRADA

PASO 2: Sistema descarga CFDI del SAT (diario, automático)
  CRON: descargar-cfdi-sat
  → API SAT: obtener CFDIs recibidos
  → Para cada CFDI: validar-cfdi-compra
  → Si MATCH: confirmar-compra-cfdi
    → UPDATE gastos: estado = CONFIRMADA, cfdi_uuid
    → UPDATE polizas: validada_por_cfdi = true
    → INSERT sincronizacion_contable: CFDI_VALIDADO
  → Si NO MATCH: INSERT alerta + esperar validación manual

PASO 3: Sistema busca pago en banco (automático)
  TRIGGER: confirmar-compra-cfdi
  → reconciliar-egreso-banco (buscar movimiento)
  → Si encuentra: 
    → UPDATE gastos: movimiento_banco_id, estado = PAGADA
    → UPDATE sincronizacion_contable: PAGO_VALIDADO
    → UPDATE polizas: estado_pago = PAGADO
  → Si no encuentra: INSERT alerta "Esperando pago"

PASO 4: Contador cierra mes
  → GET /api/gastocheck/compras-confirmadas
  → Todas tienen CFDI validado ✅
  → Todas están reconciliadas con banco ✅
  → Todas tienen póliza contable ✅
  → Puede cerrar sin dudas
```

### **FLUJO 2: Ingreso Completo (CobraCheck → Banco → Contabilidad)**

```
PASO 1: Operario registra cobro
  POST /api/cobracheck/registrar-pago
  → INSERT cobros
  → TRIGGER: crear-póliza-automática
  → INSERT polizas
  → Automáticamente: reconciliar-ingreso-banco
    → Busca movimiento en banco (monto, cliente_rfc, ±2 días)
    → Si encuentra:
      → UPDATE cobros: movimiento_banco_id, estado = PAGADO
      → UPDATE polizas: estado = VALIDADA
      → INSERT sincronizacion_contable: COBRO_VALIDADO
    → Si no encuentra:
      → UPDATE cobros: estado = REGISTRADO (esperando pago)
      → INSERT alerta "Esperando pago en banco"

PASO 2: Cliente paga (banco recibe dinero)
  → Sistema detecta movimiento (BancoCheck descarga)
  → TRIGGER: buscar-cobro-relacionado
  → Si encuentra cobro registrado:
    → UPDATE cobros: movimiento_banco_id, estado = PAGADO
    → UPDATE polizas: estado = VALIDADA
    → INSERT sincronizacion_contable: COBRO_VALIDADO

PASO 3: Contador cierra mes
  → GET /api/cobracheck/ingresos-confirmados
  → Todos tienen movimiento en banco ✅
  → Todos tienen póliza contable ✅
  → Todos sincronizados ✅
```

### **FLUJO 3: Sincronización Contable (Real-time)**

```
CADA VEZ QUE OCURRE UN CAMBIO:

1. Compra registrada
   → Disparar: orquestador-sync-contable (COMPRA_REGISTRADA)
   → Actualizar: póliza, estado_registro, auditoría

2. CFDI validado
   → Disparar: orquestador-sync-contable (CFDI_VALIDADO)
   → Actualizar: póliza, estado_contable, movimiento_financiero

3. Cobro registrado
   → Disparar: orquestador-sync-contable (COBRO_REGISTRADO)
   → Actualizar: póliza, estado_registro, auditoría

4. Pago confirmado en banco
   → Disparar: orquestador-sync-contable (PAGO_VALIDADO)
   → Actualizar: estado_pago, polizas, estado_pago = PAGADO

5. Movimiento reconciliado
   → Disparar: orquestador-sync-contable (RECONCILIACION_VALIDADA)
   → Actualizar: estado_pago, movimiento_financiero, auditoría

RESULTADO: Contabilidad SIEMPRE sincronizada en tiempo real
```

---

## 📊 INTEGRACIONES NECESARIAS

### **Tabla: movimientos_financieros (La fuente de verdad)**

```
Campos nuevos necesarios:
- cfdi_recibido_id (FK → cfdi_recibidos) [para compras]
- movimiento_banco_id (FK → banco_movimientos) [para reconciliación]
- estado_contable (REGISTRADO|PÓLIZA_CREADA|CFDI_VALIDADO|PAGADO|RECONCILIADO)
- estado_pago (PENDIENTE|PARCIAL|PAGADO)
- validado_por_sat (true|false)
- validado_por_banco (true|false)
- reconciliacion_confianza (0-100)
- fecha_última_sync (timestamp)
- próxima_sync (timestamp)
- errores_sync (array de errores)
```

### **Tabla: polizas (Siempre sincronizada)**

```
Campos nuevos necesarios:
- cfdi_uuid [para auditoría SAT]
- validada_por_cfdi (true|false)
- validada_por_banco (true|false)
- estado_sincronizacion (SINCRONIZADA|FALLO|PENDIENTE)
- última_sync (timestamp)
- movimiento_banco_id (FK)
```

---

## 🎯 CHECKLIST IMPLEMENTACIÓN

### **BASES DE DATOS**
```
[ ] Crear tabla cfdi_recibidos
[ ] Crear tabla reconciliaciones
[ ] Crear tabla sincronizacion_contable
[ ] Agregar campos a movimientos_financieros
[ ] Agregar campos a polizas
[ ] Crear índices para búsquedas rápidas
```

### **EDGE FUNCTIONS**
```
[ ] descargar-cfdi-sat (descarga automática)
[ ] validar-cfdi-compra (validación y match)
[ ] confirmar-compra-cfdi (confirmación)
[ ] reconciliar-ingreso-banco (auto-search ingreso)
[ ] reconciliar-egreso-banco (auto-search egreso)
[ ] orquestador-sync-contable (coordinador central)
```

### **API ROUTES**
```
[ ] POST /api/gastocheck/descargar-cfdi-sat
[ ] GET /api/gastocheck/cfdi-pendientes
[ ] POST /api/gastocheck/validar-cfdi/{cfdi_id}
[ ] GET /api/gastocheck/compras-confirmadas
[ ] POST /api/cobracheck/reconciliar-ingreso/{cobro_id}
[ ] GET /api/bancocheck/movimientos-no-reconciliados
[ ] POST /api/contabilidad/sincronizar
[ ] GET /api/contabilidad/estado-integracion
```

### **TRIGGERS & AUTOMACIONES**
```
[ ] Trigger: cuando se registra compra → crear póliza + buscar CFDI
[ ] Trigger: cuando se registra cobro → crear póliza + buscar pago
[ ] Cron: diario descarga CFDIs del SAT
[ ] Cron: cada hora busca movimientos no reconciliados
[ ] Trigger: cuando se reconcilia movimiento → actualizar pólizas
[ ] Webhook: sincronización contable en tiempo real
```

### **TESTING**
```
[ ] Test: Compra completa (registro → CFDI → pago → reconciliación)
[ ] Test: Ingreso completo (registro → pago → reconciliación)
[ ] Test: Descarga SAT automática
[ ] Test: Validación de discrepancias (CFDI no match)
[ ] Test: Alertas de movimientos pendientes
[ ] Test: Sincronización contable en tiempo real
```

---

## 🚀 FASES EJECUCIÓN

### **FASE 1 (2-3 días): Infraestructura**
```
✅ Crear todas las tablas + campos
✅ Crear índices para búsquedas
✅ Preparar APIs base (scaffolding)
```

### **FASE 2 (3-4 días): Edge Functions**
```
✅ descargar-cfdi-sat
✅ validar-cfdi-compra
✅ confirmar-compra-cfdi
✅ reconciliar-ingreso-banco
✅ reconciliar-egreso-banco
✅ orquestador-sync-contable
```

### **FASE 3 (2-3 días): APIs + Triggers**
```
✅ Todas las rutas API
✅ Todos los triggers
✅ Crons automáticos
✅ Webhooks de sincronización
```

### **FASE 4 (1-2 días): Testing + Documentación**
```
✅ Tests automatizados
✅ Documentación técnica
✅ Documentación usuario
✅ Capacitación contadores
```

---

## ✅ RESULTADO FINAL

```
CUANDO ESTÉ COMPLETO:

✅ Compra registrada → automáticamente sincronizada en todo
✅ CFDI descargado → automáticamente validado
✅ Pago en banco → automáticamente reconciliado
✅ Ingreso registrado → automáticamente confirmado en banco
✅ TODO está en contabilidad en tiempo real
✅ Contador NUNCA tiene descuadres
✅ Auditoría SAT es automática
✅ Cero trabajo manual de reconciliación

CAPAZ DE:
✅ Cerrar mes en horas (no días)
✅ Detectar fraude/discrepancias automáticamente
✅ Responder auditoría SAT en minutos
✅ Tener caja SIEMPRE cuadrada
✅ Confiar en que TODO está correcto
```

---

## 💡 DEPENDENCIAS CRÍTICAS

```
1. Acceso API SAT (documentación + credenciales)
2. Definición exacta de "match" para CFDI vs Compra
3. Definición de tolerancia para búsquedas en banco (monto, fecha)
4. Definición de alertas (cuándo crear, cuándo ignorar)
5. Integración con sistema contable externo (si aplica)
6. Definición de "sincronización" (qué campos, qué frecuencia)
```

---

## 📝 ARCHIVOS A GENERAR

```
Migrations:
- /supabase/migrations/TIMESTAMP_crear-cfdi-recibidos.sql
- /supabase/migrations/TIMESTAMP_crear-reconciliaciones.sql
- /supabase/migrations/TIMESTAMP_crear-sincronizacion-contable.sql

Edge Functions:
- /supabase/functions/descargar-cfdi-sat/index.ts
- /supabase/functions/validar-cfdi-compra/index.ts
- /supabase/functions/confirmar-compra-cfdi/index.ts
- /supabase/functions/reconciliar-ingreso-banco/index.ts
- /supabase/functions/reconciliar-egreso-banco/index.ts
- /supabase/functions/orquestador-sync-contable/index.ts

API Routes:
- /apps/web/app/api/gastocheck/descargar-cfdi-sat.ts
- /apps/web/app/api/gastocheck/cfdi-pendientes.ts
- /apps/web/app/api/gastocheck/validar-cfdi/[id].ts
- /apps/web/app/api/gastocheck/compras-confirmadas.ts
- /apps/web/app/api/cobracheck/reconciliar-ingreso/[id].ts
- /apps/web/app/api/bancocheck/movimientos-no-reconciliados.ts
- /apps/web/app/api/contabilidad/sincronizar.ts
- /apps/web/app/api/contabilidad/estado-integracion.ts

Documentación:
- /docs/FLUJOS-CONTABLES-COMPLETOS.md
- /docs/API-CONTABILIDAD.md
- /docs/INTEGRACION-SAT.md
```

