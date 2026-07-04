# ✅ CHECKLIST PENDIENTES — Módulos Desarrollo (Estado Actual)

**Propósito**: Tracking exhaustivo de qué falta diseñar para CADA módulo  
**Responsable**: Yo (diseño/arquitectura), Daniel (código)  
**Actualizado**: 2026-07-04 (esta sesión)  
**Nota**: Columna "STATUS" = lo que FALTA completar AQUÍ (diseño/arquitectura)

---

## 📦 GASTOCHECKK — OTA 132 (PRODUCCIÓN — NO TOCO)

```
🟢 MÓDULO ESTABLE — Todo completado en otro chat
├─ Código: ✅ Listo (OTA 132)
├─ Testing: ✅ Completado
├─ Producción: ✅ Activo
└─ ACCIÓN AQUÍ: NINGUNA (gestión en otro chat)
```

**FALTA (en otro chat, no aquí)**:
- Integración bancaria automática (es tema BancoCheck)
- Multi-moneda
- Integraciones Stripe/nómina
- Alertas mejoradas

---

## 🐍 COBRACHECK — Diseño → Código (Daniel iniciando)

### STATUS ACTUAL

```
DISEÑO:      ✅ 100% COMPLETADO
├─ Arquitec:  ✅ CobraCheck_Architecture.md
├─ Tablas:    ✅ cobra_* schema definido
├─ Flujos:    ✅ Rutas → Depósitos → Reportes
├─ RLS:       ✅ Roles + policies
└─ Integ:     ✅ Google Maps, WhatsApp

CÓDIGO:      🟡 30% INICIADO (Daniel)
├─ Backend:   🟡 API endpoints (partial)
├─ Mobile:    🟡 Rutas UI (partial)
├─ Web:       🟡 Dashboard (partial)
└─ Testing:   🔴 No iniciado
```

### PENDIENTES QUE FALTAN AQUÍ (Yo)

```
❌ ARQUITECTURA DETALLES:
□ Algoritmo RUTA OPTIMIZADA
  ├─ Integración Google Maps API endpoints
  ├─ Parámetros optimización (distancia/tiempo/ventanas)
  ├─ Fallback si Maps fails
  └─ Costo Maps API + presupuesto

□ MATCHING AUTOMÁTICO (depósitos → cobros)
  ├─ Algoritmo matching (qué reglas?)
  ├─ Manejo ambigüedades (múltiples cobros, 1 depósito)
  ├─ Audit trail matching
  └─ RLS policies para cobrador no vea otros depósitos

□ CICLO CIERRE DIARIO
  ├─ Workflow transición estado cobros
  ├─ Reportes que genera (PDF? Excel?)
  ├─ Envío automático a supervisor
  ├─ Archival histórico
  └─ Audit trail

□ INTEGRACIÓN COBROS ↔ GASTOCHECKK
  ├─ Tabla de relación cobro_gastocheck?
  ├─ Flujo: Cobrador ve sus cobros en GastoCheck?
  ├─ Depósitos generan pólizas en GastoCheck?
  └─ RLS aislamiento

□ MOTIVOS NO PAGO (extensión)
  ├─ Catálogo estándar (cuáles?)
  ├─ Custom por empresa
  ├─ Impacto en próxima ronda
  ├─ Reportes por motivo
  └─ Seguimiento

❌ VALIDACIÓN + ERRORES:
□ Validaciones (qué datos son obligatorios?)
□ Manejo GPS sin conexión
□ Reintentos manuales
□ Resolución conflictos
□ Recovery workflow

❌ DOCUMENTACIÓN:
□ API endpoints (swagger)
□ Algoritmos detalles técnicos
□ Data model completo
□ Testing plan (qué probar?)
□ Deployment checklist
```

### PUEDO HACER PARALELO (AHORA)

```
✅ CREAR DOCUMENTOS:
□ COBRACHECK_RUTA_OPTIMIZACION.md
  ├─ Especificación algoritmo
  ├─ Integración Google Maps
  ├─ Costos + presupuesto
  └─ Fallback strategies

□ COBRACHECK_MATCHING_DEPOSITOS.md
  ├─ Reglas matching
  ├─ Casos edge
  ├─ Audit trail
  └─ Ejemplos

□ COBRACHECK_CIERRE_DIARIO.md
  ├─ Workflow transiciones
  ├─ Reportes formato
  ├─ Archival strategy
  └─ SLA (cuándo se cierra?)

TIEMPO: 8-10 horas
```

**BLOQUEANTE**: Necesito confirmación Juan si:
- ¿Google Maps mandatory o optional?
- ¿Matching automático o manual?
- ¿Qué campos reportes diarios?

---

## 💳 FACTURACHECK — Diseño Aprobado → Código (Daniel)

### STATUS ACTUAL

```
DISEÑO:      ✅ 95% COMPLETADO
├─ Arquitect: ✅ FACTURACHECK_ARQUITECTURA_COMPLETA.md
├─ PAC:       🟡 Facturama recomendado (awaiting contrato)
├─ Contables: ✅ CONTPAQi/Siigo/Alegra
├─ Distrib:   ✅ Email/WhatsApp configurable
└─ Integ:     ✅ Webhook receivers

CÓDIGO:      🔴 0% (Daniel awaiting decisiones)
```

### PENDIENTES QUE FALTAN AQUÍ (Yo)

```
❌ ESPECIFICACIÓN TECNICA:
□ SWAGGER / OpenAPI spec
  ├─ Todos endpoints FacturaCheck
  ├─ CFDI generation flow
  ├─ Status tracking
  ├─ Error handling
  └─ Rate limits

□ WEBHOOK IMPLEMENTATION DETALLES
  ├─ HMAC-SHA256 validation
  ├─ Retry policy (exponential backoff?)
  ├─ Idempotency deduplication (cómo?)
  ├─ Logging detalle
  └─ Fallback si webhook fails

□ FACTURAMA vs ALTERNATIVAS DECISIÓN
  ├─ Si Juan elige otro PAC → adapter pattern
  ├─ Interface común todos PACs
  ├─ Testing múltiples PACs
  └─ Failover si PAC falla

□ OCR INVOICE RECOGNITION
  ├─ Qué campos extraer (RFC, monto, fecha)
  ├─ Validación qué tan strict?
  ├─ Manual override workflow
  ├─ Training modelo si IA?
  └─ Fallback texto manual

□ CONFIGURACION POR EMPRESA
  ├─ RFC empresa (auto-poblado?)
  ├─ Regimen fiscal
  ├─ Razón social
  ├─ Certificado digital (.cer, .key)
  ├─ Credenciales PAC
  └─ Preferences (email template, etc)

□ DISTRIBUCION CONFIGURABLE DETALLES
  ├─ Template emails personalizados
  ├─ WhatsApp message format
  ├─ SMS opcional
  ├─ Timing (envío immediato? batch diario?)
  ├─ A/B testing capability?
  └─ Delivery status tracking

❌ INTEGRACION BANCOCHECK:
□ Cuando FacturaCheck genera CFDI:
  ├─ ¿Auto-genera póliza en BancoCheck?
  ├─ ¿Vinculación invoice ↔ bank_transaction?
  ├─ RLS policies
  └─ Reconciliación automática

❌ REPORTES:
□ Dashboard FacturaCheck
  ├─ CFDIs por mes/año
  ├─ Status (borradores, enviados, rechazados)
  ├─ Monto total facturado
  ├─ Clientes más facturados
  └─ Alertas vencimiento certificado

□ Reportes descarga (PDF, CSV, Excel)

❌ COMPLIANCE:
□ SAT compliance requirements
  ├─ Validación XML format
  ├─ Timestamp requirement
  ├─ Cancelación workflow
  ├─ Audit trail 7 años
  └─ Backup requirement

□ GDPR / Privacidad
  ├─ Datos cliente sensibles (no guardar?)
  ├─ Right to delete
  ├─ Data residency (México only)

❌ DOCUMENTACION:
□ Checklist Daniel pre-codificación actualizado
□ Testing plan (casos SAT especiales)
□ Deployment runbook
```

### PUEDO HACER PARALELO (AHORA)

```
✅ CREAR DOCUMENTOS:
□ FACTURACHECK_SWAGGER_SPEC.md
  ├─ Todos endpoints
  ├─ Schemas
  ├─ Error codes
  └─ Rate limits

□ FACTURACHECK_WEBHOOK_SPEC.md
  ├─ HMAC validation
  ├─ Retry logic
  ├─ Idempotency
  └─ Error handling

□ FACTURACHECK_COMPLIANCE_SAT.md
  ├─ Requisitos SAT
  ├─ Cancelación workflow
  ├─ Audit trail
  └─ Certificado digital mgmt

□ FACTURACHECK_INTEGRACION_BANCOCHECK.md
  ├─ Vinculación invoice ↔ transaction
  ├─ Auto-reconciliación
  ├─ RLS policies
  └─ Ejemplos

□ FACTURACHECK_REPORTES.md
  ├─ Dashboard spec
  ├─ Reportes descarga
  ├─ Formatos (PDF, CSV, Excel)
  └─ Refresh intervals

TIEMPO: 12-15 horas
```

**BLOQUEANTE CRÍTICO**: 
- Juan debe confirmar: ¿Facturama sí o buscamos alternativa?
- Necesito FACTURAMA_API_KEY (sandbox) para escribir ejemplos

---

## 🏦 BANCOCHECK — Investigación → Diseño (Completo Hoy)

### STATUS ACTUAL

```
INVESTIGACION: ✅ 100% COMPLETADO
├─ 5 Bancos: ✅ Especificación completa
├─ Belvo:    ✅ Análisis exhaustivo
├─ APIs:     ✅ Endpoints documentados
├─ Código:   ✅ Ejemplos OAuth, adapters
└─ Roadmap:  ✅ 3-4 semanas MVP

DOCUMENTO GENERADO HOY: BANCOCHECK_INTEGRACION_BANCARIA_COMPLETA_5BANCOS.md ✅
```

### PENDIENTES QUE FALTAN AQUÍ (Yo)

```
❌ SCHEMA DETALLADO:
□ bank_accounts table
  ├─ Campos que necesita (encrypted_token, bank_id, refresh_token?)
  ├─ Validaciones
  ├─ Indexes performance
  └─ RLS policies (company_id basado)

□ bank_transactions table
  ├─ Campos (date, amount, description, reference, source_bank)
  ├─ Deduplicación (evitar transacciones duplicadas)
  ├─ Status tracking (synced, matched, reconciled)
  ├─ Indexes
  └─ Particionamiento si muchas rows

□ bank_reconciliations table
  ├─ Tracking manual reconciliations
  ├─ Audit trail cambios
  └─ Status workflow

□ bank_import_logs table
  ├─ Tracking sync attempts
  ├─ Error logging
  ├─ Performance metrics
  └─ Retry attempts

❌ OAUTH FLOWS DETALLES:
□ BBVA OAuth
  ├─ Redirect URI configuration
  ├─ Scope handling
  ├─ Token refresh mechanism
  ├─ Error handling (user denied, expired)
  └─ Session management

□ Santander OAuth
  ├─ Consentimiento flow
  ├─ Scope handling
  ├─ Token refresh
  └─ Consentimiento revocation

□ Belvo OAuth
  ├─ Multi-bank selector
  ├─ User journey UX
  ├─ Error states
  └─ Token encryption strategy

❌ SYNC ARCHITECTURE:
□ Sync Job (cron vs event-driven?)
  ├─ Timing (diario? hourly? tiempo real webhook?)
  ├─ Batch size (cuántas cuentas por job?)
  ├─ Rate limit handling (Belvo limits)
  ├─ Retry strategy
  ├─ Notification si error
  └─ Performance monitoring

□ Webhook Receivers (Belvo)
  ├─ HMAC-SHA256 validation
  ├─ Idempotency deduplication
  ├─ Queue management (Bull?)
  ├─ Error recovery
  └─ Logging detalle

❌ MATCHING CON GASTOCHECKK:
□ Transaction Matching
  ├─ Algorithm (fecha ± 2 días, monto exacto, descripción similarity)
  ├─ Casos edge (transacciones parciales, inversas)
  ├─ Manual matching UI
  ├─ Audit trail matching
  └─ RLS policies

□ Automatic Reconciliation
  ├─ Status workflow (unmatched → matched → reconciled)
  ├─ Alerts unmached amounts
  ├─ User workflow resolución
  └─ End-of-month closing

❌ SECURITY:
□ Token Encryption
  ├─ Encryption algorithm (AES-256?)
  ├─ Key management (Supabase Vault?)
  ├─ Token refresh security
  ├─ Audit log token changes
  └─ Fallback si decrypt fails

□ Rate Limiting
  ├─ Bank API rate limits (qué son?)
  ├─ Nuestros limits a clientes
  ├─ Queue management
  ├─ Alerting si limit reached
  └─ Graceful degradation

❌ ERROR HANDLING:
□ Bank API Errors
  ├─ Mapping error codes (qué significa cada error?)
  ├─ Retry strategies por error type
  ├─ User-facing messages
  ├─ Admin alerts
  └─ Logging detalle

□ Network Errors
  ├─ Timeout handling
  ├─ Circuit breaker pattern?
  ├─ Fallback strategies
  └─ Manual sync trigger

❌ REPORTING:
□ Dashboard BancoCheck
  ├─ Connected accounts
  ├─ Last sync timestamp
  ├─ Unmatched transactions
  ├─ Monthly summary
  └─ Alerts

□ Admin Alerts (Ver NEXT SECTION)
  ├─ Banco nuevo sin integración
  ├─ Sync failures
  ├─ High unmached amounts
  └─ Security alerts

❌ DOCUMENTACION:
□ Setup checklist Daniel
  ├─ BBVA API contrato steps
  ├─ Santander Open Banking setup
  ├─ Belvo sandbox testing
  ├─ Environment variables needed
  └─ Testing checklist

□ API docs (Swagger)

□ Troubleshooting guide
  ├─ Sync failures reasons
  ├─ Token expiration handling
  ├─ Rate limit exceeded
  └─ Bank outages
```

### PUEDO HACER PARALELO (AHORA)

```
✅ CREAR DOCUMENTOS:
□ BANCOCHECK_SCHEMA_COMPLETO.md
  ├─ Todas las tablas
  ├─ Relaciones
  ├─ Indexes
  ├─ RLS policies
  └─ Migration SQL

□ BANCOCHECK_OAUTH_FLOWS.md
  ├─ Cada banco OAuth detalle
  ├─ Error states
  ├─ Token management
  ├─ Session handling
  └─ Diagrams

□ BANCOCHECK_SYNC_ARCHITECTURE.md
  ├─ Cron vs webhook decision
  ├─ Batch processing
  ├─ Rate limiting
  ├─ Retry strategies
  └─ Monitoring

□ BANCOCHECK_TRANSACTION_MATCHING.md
  ├─ Algoritmo matching
  ├─ Edge cases
  ├─ Manual matching workflow
  ├─ Audit trail
  └─ Ejemplos

□ BANCOCHECK_SECURITY.md
  ├─ Token encryption
  ├─ Key management
  ├─ Audit logging
  ├─ Compliance requirements
  └─ Threat model

□ BANCOCHECK_ERROR_HANDLING.md
  ├─ Error mappings
  ├─ Retry logic
  ├─ User messages
  ├─ Admin alerts
  └─ Logging

□ BANCOCHECK_ADMIN_ALERTS_SYSTEM.md
  ├─ Arquitectura sistema de alertas
  ├─ Banco nuevo sin integración (NUEVO)
  ├─ Sync failures
  ├─ Security alerts
  └─ Email/Slack notifications

□ BANCOCHECK_SETUP_CHECKLIST.md
  ├─ Pre-codificación
  ├─ Environment vars
  ├─ API contrato steps
  └─ Testing plan

TIEMPO: 20-25 horas
```

**DECISIONES REQUERIDAS (Juan)**:
1. ¿Belvo desde inicio o fase 2?
2. ¿Sync schedule (hourly, daily, webhook)?
3. ¿Rate limits aceptables?
4. ¿Pricing: incluido en plan o add-on?

---

## 📊 FLUJOCHECK — Definición Conceptual (FALTA AQUÍ)

### STATUS ACTUAL

```
DEFINICION:  🔴 0% (No sé qué es)
DISEÑO:      🔴 0%
CODIGO:      🔴 0%
```

### ¿QUÉ ES FLUJOCHECK?

**NECESITO QUE JUAN DEFINA**:

```
Es cash flow forecast?
├─ Proyectar cash próximos 30/60/90 días?
├─ Basado en:
│  ├─ Cobros esperados (de CobraCheck)
│  ├─ Gastos históricos (de GastoCheck)
│  ├─ Anticipated expenses (entrada manual?)
│  └─ Seasonal patterns?
└─ Output: Gráfico timeline + alertas si déficit?

O es cash flow analysis (retrospectiva)?
├─ Analizar cash histórico?
├─ Ratios (burn rate, runway, etc)?
├─ Comparativas mes a mes?
└─ Forecasting based on trends?

O es cash management app?
├─ Recaudación objetivo vs real?
├─ Morosidad tracking?
├─ Integración pagos (Link Stripe/Pay)?
└─ Alertas cuando cash bajo?
```

### PENDIENTES (Yo)

```
❌ ESPERANDO JUAN:
□ Definición conceptual (qué es FlujoCheck?)
□ Features principal (qué hace?)
□ Datos que necesita (de qué módulos?)
□ Output/reportes (qué genera?)
□ Timeline (cuándo prioridad?)
□ Casos de uso (quién lo usa, cómo?)

UNA VEZ DEFINIDO:
□ Arquitectura completa
□ Schema DB
□ API endpoints
□ Dashboard/reportes
□ Integraciones (GastoCheck, CobraCheck, BancoCheck)
```

### TIEMPO ESTIMADO (Una vez definido)

```
Diseño completo: 15-20 horas
```

---

## 🏪 CAJACHECK — Diseño Estructural (Prioridad?)

### STATUS ACTUAL

```
DISEÑO:      ✅ 95% COMPLETADO
├─ CajaCheck_Architecture.md: ✅
├─ Entidades: ✅
├─ Flujos: ✅
└─ Integraciones: ✅

PRIORIDAD: 🤷 DEPENDE JUAN
├─ ¿Semana 6 (después CobraCheck)?
├─ ¿Mes 2 (después FacturaCheck)?
├─ ¿Deprioritizado?
└─ ¿Fusionar con InventarioCheck?
```

### PENDIENTES

```
❌ SOLO SI JUAN PRIORIZA:
□ Refinamiento arquitectura
□ Schema SQL completo
□ Integraciones detalles (GastoCheck, BancoCheck)
□ Reportes específicos
□ Testing plan
□ Setup checklist Daniel
```

**BLOQUEANTE**: Necesito confirmación Juan prioridad

---

## 📦 INVENTARIOCHECK — Diseño Estructural (Prioridad?)

### STATUS ACTUAL

```
DISEÑO:      ✅ 95% COMPLETADO
├─ InventarioCheck_Architecture.md: ✅
├─ Producto/Movimientos/Proveedores: ✅
├─ Alertas/Perecederos: ✅
└─ Integraciones: ✅

PRIORIDAD: 🤷 DEPENDE JUAN
├─ ¿Mes 2 (release posterior)?
├─ ¿Fusionar con CajaCheck?
└─ ¿Sector específico (licorería, abarrotes)?
```

### PENDIENTES

```
❌ SOLO SI JUAN PRIORIZA:
□ Refinamiento arquitectura
□ Schema SQL completo
□ Integraciones detalles
□ Reportes específicos
□ Testing plan
□ Setup checklist Daniel
```

**BLOQUEANTE**: Necesito confirmación Juan prioridad

---

## 📋 RESUMEN: HORAS PENDIENTES (Yo)

```
🎯 INMEDIATO (Próximas 24h):

BANCOCHECK:          20-25 horas
├─ Schema completo
├─ OAuth flows
├─ Sync architecture
├─ Matching algorithm
├─ Security strategy
├─ Admin alerts (NUEVO)
└─ Setup checklist + docs

COBRACHECK DETALLES: 8-10 horas
├─ Ruta optimización
├─ Matching depósitos
├─ Cierre diario workflow
└─ Integración GastoCheck

FACTURACHECK DETALLES: 12-15 horas
├─ Swagger spec
├─ Webhook detalles
├─ Compliance SAT
├─ Integracion BancoCheck
├─ Reportes
└─ Setup checklist

════════════════════════════════════
TOTAL INMEDIATO:     40-50 horas

════════════════════════════════════

🟡 BLOQUEADO (Esperando decisiones Juan):

FLUJOCHECK:         15-20 horas
├─ Esperando: Definición conceptual
└─ Una vez definido: arquitectura completa

CAJACHECK/INVENTARIO: 10-15 horas
├─ Esperando: Confirmación prioridad
└─ Una vez priorizado: refinamiento + setup

════════════════════════════════════
TOTAL BLOQUEADO:     25-35 horas
════════════════════════════════════

GRAN TOTAL: 65-85 horas (trabajo diseño/arquitectura)
```

---

## 🚀 PRÓXIMOS PASOS

**OPCIÓN A — YO CONTINÚO AHORA** (40-50 horas):
```
✅ BANCOCHECK: Schema + OAuth + Sync + Matching + Security + Admin Alerts + Docs
✅ COBRACHECK: Ruta Optimización + Matching Depósitos + Cierre + Integraciones  
✅ FACTURACHECK: Swagger + Webhooks + SAT + Integraciones + Reportes + Setup
```

**OPCIÓN B — ESPERO DECISIONES JUAN**:
```
⏳ ¿FlujoCheck qué es?
⏳ ¿CajaCheck/Inventario cuándo?
⏳ ¿Belvo cuándo?
⏳ ¿Facturama definitivo?
```

**RECOMENDACIÓN**: Hago OPCIÓN A paralelo (40-50 horas diseño) mientras Juan decide OPCIÓN B.

---

**ESTADO ACTUAL**: Documento listo para que Juan confirme qué hacer primero ✅

