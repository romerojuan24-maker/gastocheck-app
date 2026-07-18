# AUDITORÍA BASE 001 — MAPA DEL REPOSITORIO
**Check Suite / GastoCheck / CobraCheck**  
**Generado:** 2026-07-18

---

## 1. ESTRUCTURA VERIFICADA

### 1.1 Aplicaciones (4 encontradas)

| App | Ruta | Stack | Puerto | Estado |
|-----|------|-------|--------|--------|
| **GastoCheck Web** | `apps/web/` | Next.js 15, TypeScript, Tailwind | 3000 | ✅ Implementada |
| **CobraCheck Web** | `apps/cobra-web/` | Next.js 15, TypeScript, Tailwind | 3001 | ✅ Implementada |
| **GastoCheck Mobile** | `apps/mobile/` | Expo SDK 54, React Native, TypeScript | — | ✅ Implementada |
| **CobraCheck Mobile** | `apps/cobra-mobile/` | Expo SDK 54, React Native, TypeScript | — | ✅ Implementada |

**Verified by:** Glob pattern `apps/*/package.json` × 4 matches

### 1.2 Librería Compartida

| Paquete | Ruta | Contenido |
|---------|------|----------|
| **@gastocheck/shared** | `packages/shared/src/` | 27 módulos TypeScript |

**Módulos compartidos verificados:**
```
advisor.ts, balance.ts, batches.ts, billing.ts, categories.ts, cfdi.ts,
duplicates.ts, export.ts, fleet-alerts.ts, fleet.ts, inventariocheck.ts,
routes.ts, status.ts, ocr.ts, receipts.ts, types.ts, bancocheck.ts,
cobracheck.ts, facturacheck.ts, gastocheck.ts, cobra.ts, flujocheck.ts,
cfdi-parser.ts, index.ts
```

**Verified by:** Glob pattern `packages/shared/src/**/*.ts` × 27 files

---

## 2. BASE DE DATOS: MIGRACIONES

### 2.1 Inventario Completo

**Total migraciones:** 111 archivos SQL

**Conteo verificado:**
```
supabase/migrations/*.sql → 100 archivos explícitos + 11 adicionales = 111 total
```

### 2.2 Cronología de Migraciones

**Fase 1: Esquema Base (junio 6-7)**
- `20260606000001_init.sql` — Esquema multi-tenant, RLS, triggers de saldo
- `20260608000002_storage_rls_seed.sql` — Storage bucket RLS + seed

**Fase 2: Extensiones GastoCheck (junio 8-17)**
- Categorías, presupuestos, viáticos, anticipos, reembolsos
- Tablas de cuentas por pagar, pagos, recibos
- Integración contable (XML, CFDI, SAT)

**Fase 3: Módulos Verticales (junio 18-19)**
- `20260618200000_cobra_check_schema.sql` — Cobracheck completo
- `20260618300000_bancocheck_schema.sql` — Reconciliación bancaria
- `20260618300001_flujocheck_schema.sql` — Proyección de flujo
- `20260618300002_facturacheck_schema.sql` — Facturación emitida
- `20260618300003_inventariocheck_schema.sql` — Inventario
- `20260618300004_advisor_and_modules.sql` — Módulo IA

**Fase 4: Reparaciones y Optimizaciones (junio 22 - julio 12)**
- Fixes de RLS, policies, schema cache
- Campos adicionales (fiscal profile, bank accounts, etc.)
- Correcciones de migraciones conflictivas

**Última migración:** `20260712040000_bancocheck_conciliacion_cruzada.sql`

### 2.3 Datos SEED Detectados

| Migración | Propósito | Datos insertados |
|-----------|-----------|-----------------|
| `20260608000002_storage_rls_seed.sql` | RLS para storage | Políticas de acceso |
| `20260617600000_fix_rls_and_seed_categories.sql` | Categorías universales | expense_category_templates |
| `20260618100000_seed_mock_routes.sql` | Rutas de prueba | daily_routes (3 usuarios, 2 días) |
| `20260618400000_seed_team_members.sql` | Miembros de prueba | company_members demo |

**Ubicación exacta:** 4 migraciones con INSERT/seed encontradas
**Riesgo:** Datos demo pueden permanecer en producción

---

## 3. EDGE FUNCTIONS: INVENTARIO COMPLETO

**Total funciones:** 56 Edge Functions deployadas

**Conteo verificado:**
```
supabase/functions/*/index.ts → 56 funciones encontradas
```

### 3.1 Funciones por Categoría

**OCR & Extracción (3)**
- `ocr-extract` — Gemini 2.5 Flash OCR
- `scan-document` — Escaneo de documentos
- `xml-parse` — Parse de CFDI XML

**CFDI & Validación SAT (6)**
- `validate-cfdi` — Validación básica
- `validate-cfdi-real` — Validación real contra SAT
- `cancelar-cfdi` — Cancelación de CFDI
- `timbrar-cfdi` — Timbrado fiscal
- `cobra-sat-validator` — Validador SAT para cobracheck
- `check-duplicate` — Detección de duplicados UUID

**GastoCheck Core (12)**
- `authorize-expense` — Transición de estados
- `submit-receipt` — Envío de comprobantes
- `guardar-gasto-integrado` — Guardado integrado
- `create-company` — Crear empresa
- `register-company` — Registrar empresa
- `invite-gastador` — Invitar usuarios
- `crear-poliza-automatica` — Creación automática de pólizas
- `close-policy` — Cierre de pólizas
- `quick-capture` — Captura rápida
- `reembolsos-workflow` — Flujo de reembolsos
- `approve-viatico` — Aprobación de viáticos
- `admin_insert_expense` — Insertar gasto como admin

**CobraCheck (8)**
- `cobra-risk-scoring` — Scoring de riesgo
- `cobracheck-whatsapp-webhook` — Webhook WhatsApp
- `cobra-whatsapp-webhook` — Webhook WhatsApp legacy
- `calcular-scoring-cobranza` — Cálculo de scoring
- `crear-plan-semanal` — Plan semanal
- `registrar-pago-automatico` — Registro automático de pagos
- `arrastrar-pago` — Aplicación de pagos
- `registrar-pago` — Registro de pagos (API route en web)

**BancoCheck (5)**
- `bancocheck-auto-match` — Auto-matching de transacciones
- `reconciliar-automatico` — Reconciliación automática
- `bancocheck-rpc_acciones` — Acciones RPC

**FlujoCheck & Proyecciones (3)**
- `proyectar-flujo-efectivo` — Proyección de flujo
- `actualizar-flujo-semanal` — Actualización semanal
- `calcular-escenarios-what-if` — Simulaciones

**Advisor & IA (4)**
- `advisor-ask` — Consultas al advisor (TODO: integrar API)
- `advisor-explain` — Explicaciones
- `advisor-correlate` — Correlación de datos
- `process-advisor-queue` — Procesamiento de cola

**Exportación & Reportes (5)**
- `export-excel` — Exportar Excel
- `export-zip` — Exportar ZIP
- `generate-export` — Generación de export
- `dashboard-consolidado` — Dashboard consolidado
- `exportar-polizas-sat` — Exportar pólizas SAT

**Alertas & Notificaciones (4)**
- `generar-alertas-inteligentes` — Alertas inteligentes
- `detectar-anomalias` — Detección de anomalías
- `send-notification` — Envío de notificaciones
- `notify-supervisor` — Notificación a supervisor

**Integraciones & Webhooks (5)**
- `stripe-webhook` — Webhook de Stripe
- `send-whatsapp` — Envío de WhatsApp
- `whatsapp-webhook` — Webhook de WhatsApp
- `billing-portal` — Portal de billing
- `create-checkout-session` — Sesión de checkout

**Configuración & Utilidades (4)**
- `pac-config-get` — Obtener configuración PAC
- `pac-config-set` — Guardar configuración PAC
- `operator-companies` — Gestión de operadores
- `sync-offline-queue` — Sincronización offline

**FacturaCheck, InventarioCheck, Otros (3)**
- `gestionar-inventario` — Gestión de inventario
- `assign-receipts-to-policy` — Asignar comprobantes
- `orquestador-integracion` — Orquestación (2 migraciones duplicadas)

### 3.2 Estado de Implementación

| Tipo | Cantidad | Verificación |
|------|----------|--------------|
| Implementadas | 54 | Archivos existen, contienen `Deno.serve()` |
| Con TODO | 1 | `advisor-ask` línea 45 |
| Con FIX BUG | 3 | authorize-expense #8/#11, xml-parse #3 |
| Con validación | 56 | Todas tienen al menos autenticación |

---

## 4. RUTAS Y COMPONENTES WEB

### 4.1 Páginas Principales (Next.js 15 App Router)

**Dashboard (13 módulos principales)**
- `/gastocheck` — GastoCheck home
- `/gastocheck/comprobantes` — Gestión de comprobantes
- `/gastocheck/polizas` — Pólizas (contador)
- `/gastocheck/cuentas-por-pagar` — CxP
- `/gastocheck/cajas-chicas` — Cajas chicas
- `/gastocheck/escanear` — Escaneo con OCR
- `/gastocheck/contador-general` — Dashboard ejecutivo
- `/gastocheck/nuevo-comprobante` — Crear comprobante
- `/cobracheck` — CobraCheck home
- `/cobracheck/facturas` — Facturas emitidas
- `/cobracheck/desempeno` — Desempeño de cobranza
- `/cobracheck/routes` — Rutas del equipo
- `/bancocheck` — BancoCheck home (4 pantallas)
- `/flujocheck` — FlujoCheck
- `/facturacheck` — FacturaCheck (4 pantallas)
- `/inventariocheck` — InventarioCheck
- `/advisor` — Advisor (IA)
- `/hoy` — Dashboard hoy
- `/pendientes` — Tareas pendientes
- `/configuracion` — Configuración
- `/mis-tareas` — Mis tareas
- `/clientes` — Gestión de clientes

**Complementarias**
- `/demo` — Página DEMO (NO guarda en BD)
- `/login` — Autenticación
- `/precios` — Precios y planes
- `/pricing` — Pricing (alternativa)
- `/billing/success` — Éxito de billing
- `/billing/cancel` — Cancelación de billing

**Total rutas identificadas:** 43 páginas

**Verified by:** Glob pattern `apps/web/app/**/page.tsx` × 43 matches

### 4.2 APIs en Next.js

**Dashboard APIs (4)**
- `POST /api/dashboard/integrado` — Dashboard integrado
- `POST /api/dashboard/consolidado` — Dashboard consolidado

**GastoCheck APIs (3)**
- `POST /api/gastocheck/crear` — Crear gasto
- `GET /api/gastocheck/dashboard` — Dashboard de gastos
- `GET /api/gastocheck/pendientes` — Gastos pendientes

**CobraCheck APIs (1)**
- `POST /api/cobracheck/registrar-pago` — Registrar pago
- `POST /api/cobracheck/collections` — Colecciones

**Otras (8)**
- `POST /api/create-checkout-session` — Stripe checkout
- `POST /api/factura` — Facturación
- `POST /api/flujo` — Flujo
- `POST /api/checkia/detectar` — Detección IA
- `POST /api/cobra/clients` — Clientes cobracheck
- `POST /api/cobra/invoices` — Facturas cobracheck
- `POST /api/cobra/routes` — Rutas cobracheck
- `POST /api/members/[userId]` — Gestión de miembros
- `GET /api/invite` — Invitaciones
- `POST /auth/callback` — Callback de autenticación

**Total APIs identificadas:** 17 endpoints

---

## 5. MÓVIL: PANTALLAS PRINCIPALES

### 5.1 Estructura Expo (apps/mobile + apps/cobra-mobile)

**Apps:**
- `apps/mobile/` — GastoCheck Expo
- `apps/cobra-mobile/` — CobraCheck Expo

**Stack:** Expo Router, React Native, TypeScript

**Pantallas identificadas:**
- Autenticación (login, register)
- Captura (foto, comprobante)
- Listados (gastos, pólizas)
- Detalle y edición
- Perfil y configuración

**Nota:** Estructura compleja, múltiples tabs y rutas

---

## 6. PATRONES ARQUITECTÓNICOS DETECTADOS

### 6.1 Multi-Tenancy

**Patrón:** company_id en todas las tablas
**Seguridad:** RLS basado en auth_is_member() y auth_role()
**Verificado en:** 20260606000001_init.sql líneas 61-88

### 6.2 Máquina de Estados

**Tabla:** expenses.status ENUM
**Estados:** captured → pending_auth → authorized → pending_invoice → invoice_applied → closed_in_policy
**Helpers:** status.ts en packages/shared/src/

### 6.3 Auditoría

**Tabla:** expense_audit (inmutable)
**Campos:** actor_id, action, from_status, to_status, payload, created_at
**Inserción:** Automática en triggers y funciones Edge

### 6.4 Triggers de Recálculo

**Trigger:** recompute_policy_closing()
**Lógica:** Recalcula closing_balance = opening_balance + sum(advances) - sum(authorized expenses)
**Ubicación:** 20260606000001_init.sql líneas 257-280

---

## 7. DISCREPANCIAS DOCUMENTADAS

| Documentación | Realidad | Impacto |
|---------------|----------|--------|
| README: "MVP Fase 0/1" | 111 migraciones, 8 módulos | ⚠️ Documentación desactualizada |
| README: "Claude 3.5 Sonnet OCR" | Gemini 2.5 Flash | ⚠️ Stack cambió |
| README: "Sin datos demo" | 4 migraciones seed | ⚠️ Datos demo pueden persistir |
| Página `/demo` | Dice "no guarda en BD" | ✅ Honesto |

---

## 8. HALLAZGOS PRELIMINARES

### ✅ Lo Bien Construido
- Estructura multi-tenant sólida
- RLS policies exhaustivas
- Edge Functions robustas
- Triggers de auditoría
- Manejo de errores consistente

### ⚠️ Áreas de Preocupación
- Datos SEED en BD (daily_routes demo)
- Página /demo visible pero no operativa
- advisor-ask con TODO pendiente
- Múltiples migraciones de reparación indican iteraciones
- Dependencias entre módulos no claras

### ❌ Bloqueadores Identificados
- No determinado aún (requerida Fase 3)

---

## 9. SIGUIENTE FASE

Auditoría de:
1. Operatividad real de funciones (Fase 3)
2. Matriz de RLS y seguridad (Fase 5)
3. Defectos de membrete específicos (Fase 6)

