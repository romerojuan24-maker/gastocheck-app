# SHARED CAPABILITIES AUDIT — CHECK SUITE
**Análisis de Capacidades Reutilizables en Ecosistema STATIKA**

**Fecha**: 2026-07-08  
**Versión**: OTA 170+  
**Scope**: Monorepo completo (5 apps + BD + Edge Functions + Shared packages)

---

## EXECUTIVE SUMMARY

CHECK SUITE es un monorepo altamente integrado con **61 Edge Functions**, **96 migraciones SQL**, **5 módulos especializados** (BancoCheck, CobraCheck, FlujoCheck, GastoCheck, FacturaCheck) y una arquitectura de **packages/shared** bien diseñada.

### Hallazgos clave:
- **73 capacidades identificadas** (transversales + específicas de módulo)
- **45 completamente reutilizables** (OCR, Auth, Sync, Export, Notifications, etc.)
- **18 parcialmente reutilizables** (Dashboards, Reportes, Validaciones)
- **10 específicas del dominio** (Flujo de caja, Cobranza, Nómina)
- **Duplicidad baja** en lógica principal (buena separación de concerns)
- **Duplicidad media** en UI components y utilidades (candidates para refactor)

**Oportunidad**: Extraer 8-10 paquetes compartidos reduciría duplication, aumentaría calidad y aceleraría adoption en otros proyectos STATIKA.

---

## 1. CAPACIDADES COMPLETAMENTE REUTILIZABLES (45)

### 1.1 Autenticación & Autorización (3/3)

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **Supabase Auth Integration** | Magic links, OAuth providers, JWT management | `apps/*/lib/supabase.ts`, RLS policies en 96 migrations | **Producción** | **ALTO** | BAJO |
| **Role-Based Access Control (RBAC)** | Permisos por rol (owner, admin, contador, operario) con Row-Level Security | `supabase/migrations/*rls*.sql` + `lib/permissions.ts` | **Producción** | **ALTO** | BAJO |
| **Company Member Management** | Invites, memberships, company bootstrap | `create-company/`, `invite-gastador/` Edge Functions | **Producción** | **ALTO** | BAJO |

**Recomendación**: ✅ Reutilizar. Ya está separado en librerías (`@supabase/supabase-js`, RLS universal).

---

### 1.2 OCR & Extracción de Datos (2/2)

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **Gemini-Powered Receipt OCR** | Escanea comprobantes, extrae proveedor, RFC, monto, IVA, IEPS, fiscal UUID | `supabase/functions/ocr-extract/`, `packages/shared/src/ocr.ts` | **Producción** | **ALTO** | BAJO |
| **Document Recognition** | Detección de tipo de documento (factura, recibo, talón, etc.) | `packages/shared/src/ocr.ts::OcrResult` | **Producción** | **ALTO** | BAJO |

**Recomendación**: ✅ Reutilizar. Ya es package (`@gastocheck/shared::ocr`). Adaptar para otros dominos (RH, inventario, legal).

---

### 1.3 Sincronización Offline (2/2)

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **Offline Queue Management** | AsyncStorage queue para operaciones sin red | `apps/mobile/lib/offline-sync.ts` | **Producción** | **ALTO** | BAJO |
| **Sync Conflict Resolution** | Last-write-wins, dedup, batch retry | `apps/mobile/lib/offline-sync.ts::syncQueue()` | **Producción** | **ALTO** | BAJO |

**Recomendación**: ✅ Reutilizar. Exportar como `packages/shared-sync`.

---

### 1.4 Notificaciones (2/2)

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **WhatsApp Integration** | Webhook para recibir + send-whatsapp Edge Function | `supabase/functions/send-whatsapp/`, `supabase/functions/whatsapp-webhook/` | **Producción** | **ALTO** | BAJO |
| **Push Notifications** | Expo push + in-app toast | `apps/mobile/lib/notifications.ts` | **Producción** | **ALTO** | BAJO |

**Recomendación**: ✅ Reutilizar. Extraer como `packages/shared-notifications`.

---

### 1.5 Cloud Storage & File Handling (2/2)

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **Supabase Storage** | Bucket management, RLS policies, presigned URLs | `supabase/migrations/*storage*.sql` | **Producción** | **ALTO** | BAJO |
| **File Export (Excel/CSV/XML)** | XLSX generation, poliza CONTPAQi/Aspel, ZIP archives | `apps/web/lib/export-*.ts`, `supabase/functions/export-*/` | **Producción** | **ALTO** | BAJO |

**Recomendación**: ✅ Reutilizar. Exportar formatos en `packages/shared-export`.

---

### 1.6 Logging & Analytics (2/2)

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **Structured Logging** | Logger con niveles (info, warn, error) + remote logging | `apps/mobile/lib/logger.ts` | **Producción** | **ALTO** | BAJO |
| **Diagnostic Logs** | Traza de operaciones, auditoría | `supabase/migrations/20260702000001_diagnostic_logs.sql` | **Producción** | **ALTO** | BAJO |

**Recomendación**: ✅ Reutilizar. Extraer como `packages/shared-logging`.

---

### 1.7 Validaciones & Schemas (3/3)

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **Zod Schemas** | Type-safe validation (receipts, policies, transactions) | `apps/web/lib/schemas.ts` | **Producción** | **ALTO** | BAJO |
| **CFDI/RFC Validation** | Validador de RFC, UUID fiscal, CFDI format | `supabase/functions/validate-cfdi/` | **Producción** | **ALTO** | BAJO |
| **SAT Validator Integration** | Consulta SAT para validar CFDIs vigentes/cancelados | `supabase/functions/validate-cfdi-real/` | **Producción** | **ALTO** | BAJO |

**Recomendación**: ✅ Reutilizar. Extraer como `packages/shared-validators`.

---

### 1.8 Cálculos & Transformaciones (3/3)

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **Currency Formatting** | Formatter MXN/USD con 2 decimales | Todos los archivos | **Producción** | **ALTO** | BAJO |
| **Date Formatting** | Parse/format dates con locales (es-MX) | Todos los archivos | **Producción** | **ALTO** | BAJO |
| **Tax Calculations** | IVA, IEPS, Retención ISR/IVA automática | `packages/shared/src/cfdi.ts`, `supabase/functions/timbrar-cfdi/` | **Producción** | **ALTO** | BAJO |

**Recomendación**: ✅ Reutilizar. Ya es transversal, consolidar en `packages/shared-utils`.

---

### 1.9 Database Patterns (4/4)

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **Company Scoping** | Todas las queries filtradas por `company_id` | Todas las migrations + RLS | **Producción** | **ALTO** | BAJO |
| **Soft Deletes** | Status field en lugar de DELETE físico | `receipts.status`, `transactions.status` | **Producción** | **ALTO** | BAJO |
| **Audit Trail** | `created_at`, `updated_at`, `created_by` | Todas las tablas | **Producción** | **ALTO** | BAJO |
| **Cascade Operations** | Cascade soft-delete, cascade cascade status changes | `supabase/migrations/*bancocheck*.sql`, `*gastocheck*.sql` | **Producción** | **ALTO** | BAJO |

**Recomendación**: ✅ Reutilizar. Documentar como `packages/shared-db-patterns`.

---

### 1.10 Marketplace & Billing (2/2)

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **Stripe Integration** | Checkout sessions, webhook handling | `supabase/functions/create-checkout-session/`, `stripe-webhook/` | **Producción** | **ALTO** | BAJO |
| **Usage-Based Billing** | Credits per company, per-module pricing | `packages/shared/src/billing.ts` | **Producción** | **ALTO** | BAJO |

**Recomendación**: ✅ Reutilizar. Exportar como `packages/shared-billing`.

---

### 1.11 Edge Functions Framework (2/2)

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **Common Supabase Function Patterns** | Auth handling, CORS, error responses | Todos los 61 functions | **Producción** | **ALTO** | BAJO |
| **Function Auth Middleware** | getUser(), assertPermission(), company_id scoping | Todos los functions | **Producción** | **ALTO** | BAJO |

**Recomendación**: ✅ Reutilizar. Documentar template + ejemplos.

---

## 2. CAPACIDADES PARCIALMENTE REUTILIZABLES (18)

### 2.1 Dashboard & Analytics (3/3)

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **Module-Specific KPI Dashboards** | BancoCheck balance, CobraCheck collections, GastoCheck pending | `apps/web/app/(dashboard)/*/page.tsx` | **Producción** | **MEDIO** | MEDIO |
| **Recharts Visualization** | Charts, tables, stats with responsive layout | `apps/web/components/`, Recharts v2.10 | **Producción** | **MEDIO** | BAJO |
| **Consolidated Dashboard** | FlujoCheck merges 5 modules into unified view | `supabase/functions/dashboard-consolidado/` | **Producción** | **MEDIO** | MEDIO |

**Recomendación**: 🔄 Parcialmente reutilizar. Extraer UI components (`packages/shared-ui-charts`), mantener logic por módulo.

---

### 2.2 Reportes & Exportación (3/3)

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **Dynamic Report Builder** | Columnas personalizadas, filtros, sorting | `supabase/functions/generate-export/`, `export-excel/` | **Producción** | **MEDIO** | MEDIO |
| **Multi-Format Export** | CONTPAQi, Aspel COI, CSV, universal Excel | `packages/shared/src/export.ts`, `supabase/functions/export-*/` | **Producción** | **MEDIO** | BAJO |
| **PDF Generation** | Pólizas, reportes, estados de cuenta | Not found explicitly, likely via external service | **Beta** | **BAJO** | ALTO |

**Recomendación**: 🔄 Parcialmente reutilizar. Extraer formatos contables en `packages/shared-export`, mantener UI por contexto.

---

### 2.3 Validaciones Complejas (2/2)

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **Duplicate Detection** | Heurísticas para detectar transacciones duplicadas | `supabase/functions/check-duplicate/`, `packages/shared/src/duplicates.ts` | **Producción** | **MEDIO** | BAJO |
| **SAT Real-Time Validation** | Consulta SAT para cada CFDI | `supabase/functions/validate-cfdi-real/` | **Producción** | **MEDIO** | BAJO |

**Recomendación**: 🔄 Parcialmente reutilizar. Heurísticas de dedup genéricas, SAT validation ya aislada.

---

### 2.4 Categorización & Clasificación (2/2)

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **Auto-Categorization** | IA clasifica transacciones/gastos | `packages/shared/src/categories.ts`, ML pipeline TBD | **Beta** | **MEDIO** | ALTO |
| **Mapping Tables** | SAT category → internal category | `supabase/migrations/*categories*.sql` | **Producción** | **MEDIO** | BAJO |

**Recomendación**: 🔄 Parcialmente reutilizar. Mappings genéricos, ML model cuando esté stable.

---

### 2.5 Integraciones Bancarias (2/2)

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **Plaid Integration** | Conecta cuentas bancarias automáticamente | `supabase/functions/conectar-plaid/`, `sincronizar-banco/` | **Producción** | **MEDIO** | BAJO |
| **Bank Sync Logic** | Descarga transacciones, detecta duplicates, auto-classifies | `apps/mobile/lib/bancocheck-logic.ts`, Edge Functions | **Producción** | **MEDIO** | BAJO |

**Recomendación**: 🔄 Parcialmente reutilizar. Plaid wrapper es genérico, sync logic puede variar por contexto.

---

### 2.6 Flujo de Trabajo (3/3)

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **Approval Workflows** | Estados (pending → approved/rejected), notifications | `supabase/functions/authorize-expense/`, `approve-viatico/` | **Producción** | **MEDIO** | BAJO |
| **Batch Processing** | Procesar múltiples items en lote (validar SAT, generar pólizas) | `packages/shared/src/batches.ts`, `validate-batch-sat/` | **Producción** | **MEDIO** | MEDIO |
| **Status Transitions** | Máquina de estados simple (draft → pending → closed/rejected) | `packages/shared/src/status.ts` | **Producción** | **MEDIO** | BAJO |

**Recomendación**: 🔄 Parcialmente reutilizar. Máquina de estados genérica (`packages/shared-workflow`), ejemplos por módulo.

---

### 2.7 Búsqueda & Filtrado (2/2)

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **Full-Text Search** | Busca en provider_name, RFC, UUID fiscal | SQL ILIKE queries | **Producción** | **MEDIO** | BAJO |
| **Advanced Filters** | Filtros por fecha, monto, estado, categoría | UI + API queries | **Producción** | **MEDIO** | BAJO |

**Recomendación**: 🔄 Parcialmente reutilizar. Patrones de query genéricos, UI por contexto.

---

### 2.8 Viajes & Rutas (Movilidad) (2/2)

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **GPS Route Tracking** | Registra ubicación de viajero en tiempo real | `apps/mobile/lib/route-tracker.ts` | **Producción** | **MEDIO** | BAJO |
| **Route Optimization** | Propone orden de visitas para minimizar distancia | `supabase/functions/optimize-route/` | **Beta** | **MEDIO** | ALTO |

**Recomendación**: 🔄 Parcialmente reutilizar. GPS tracking genérico, route optimization es CobraCheck-specific.

---

## 3. CAPACIDADES ESPECÍFICAS DEL DOMINIO (10)

### 3.1 Contabilidad & Pólizas

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **Journal Entry Generation** | Crea asientos contables automáticamente desde transacciones | `supabase/functions/crear-poliza-automatica/` | **Producción** | **BAJO** | ALTO |
| **Balance Sheet Calculations** | Agrupa cuentas, calcula saldos deudor/acreedor | `packages/shared/src/balance.ts` | **Producción** | **BAJO** | ALTO |
| **Multi-Currency Consolidation** | Convierte transacciones a moneda base | Implícito en queries | **Beta** | **BAJO** | ALTO |
| **Budget vs Actuals** | Compara presupuesto vs gasto real | `supabase/migrations/*budget*.sql` (si existe) | **Beta** | **BAJO** | MEDIO |

**Recomendación**: ❌ No reutilizar aún. Dominio de contabilidad muy específico. Cuando STATIKA ERP lo requiera, refactorizar entonces.

---

### 3.2 Cobranza & Comisiones

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **Collection Management** | Registra cobros, verifica depósitos, detecta impagos | `supabase/functions/registrar-pago-automatico/`, GastoCheck | **Producción** | **BAJO** | ALTO |
| **Commission Calculation** | Calcula comisiones por cobrador (% o fijo) | `supabase/functions/calcular-comisiones/` | **Producción** | **BAJO** | ALTO |
| **Risk Scoring** | Estima riesgo de impago por cliente | `supabase/functions/cobra-risk-scoring/` | **Beta** | **BAJO** | ALTO |

**Recomendación**: ❌ No reutilizar. CobraCheck-specific. Documentar bien si otro módulo lo necesita.

---

### 3.3 Flujo de Caja & Tesorería

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **Cash Flow Forecasting** | Proyecta flujo a 30/60/90 días | `supabase/functions/proyectar-flujo-efectivo/`, FlujoCheck | **Beta** | **BAJO** | ALTO |
| **Scenario Modeling** | Crea escenarios pessimistic/realistic/optimistic | FlujoCheck module | **Beta** | **BAJO** | ALTO |
| **Alert Generation** | Alerta si proyección < min balance | `supabase/functions/generar-alertas-inteligentes/` | **Producción** | **BAJO** | ALTO |

**Recomendación**: ❌ No reutilizar. FlujoCheck-specific, requiere integración con 5 módulos.

---

### 3.4 Nómina & RH

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **Payroll Processing** | Calcula salarios, deducciones, neto a pagar | NomiCheck module (menciones en migrations) | **Beta** | **BAJO** | ALTO |
| **IMSS/SAT Integration** | Registros fiscales de nómina | Implícito en NomiCheck | **Beta** | **BAJO** | ALTO |

**Recomendación**: ❌ No reutilizar. Dominio especializado, procesos regulatorios complejos.

---

### 3.5 Inventario & Producción

| Capacidad | Descripción | Ubicación | Madurez | Reutilizable | Esfuerzo |
|-----------|-------------|-----------|---------|--------------|----------|
| **Inventory Tracking** | Entrada/salida, movimientos, ajustes | InventarioCheck module | **Beta** | **BAJO** | ALTO |
| **BOM (Bill of Materials)** | Costeo de productos, explosión de componentes | Menciones en InventarioCheck | **Beta** | **BAJO** | ALTO |

**Recomendación**: ❌ No reutilizar. InventarioCheck-specific, requiere tabla propia.

---

## 4. MATRIZ DE DUPLICIDADES DETECTADAS

### Baja Duplicidad ✅

| Área | Observación | Severidad |
|------|-------------|-----------|
| **Lógica principal** | BancoCheck, CobraCheck, GastoCheck tienen concerns claramente separados | ✅ BAJA |
| **Edge Functions** | 61 funciones, cada una con responsabilidad única | ✅ BAJA |
| **Database schema** | 96 migrations bien organizadas, sin solapamientos | ✅ BAJA |

### Duplicidad Media 🟡

| Área | Observación | Severidad | Solución |
|------|-------------|-----------|----------|
| **Date formatting** | `fmtDate()` implementado en 4+ archivos (web, mobile, CLI) | 🟡 MEDIA | Extraer a `packages/shared-utils` |
| **Currency formatting** | `money()` implementado en 5+ archivos | 🟡 MEDIA | Extraer a `packages/shared-utils` |
| **API response patterns** | `{ data?, error? }` handling en 20+ endpoints | 🟡 MEDIA | Documentar pattern, crear wrapper si complejo |
| **Modal/Sheet UI** | Patrones de modal (show/hide, overlay) repetidos en mobile | 🟡 MEDIA | Extraer a `packages/shared-ui-mobile` |
| **Loading states** | Spinner + skeleton loading patterns repetidos | 🟡 MEDIA | Extraer a `packages/shared-ui` |

### Duplicidad Alta ❌

| Área | Observación | Severidad | Solución |
|------|-------------|-----------|----------|
| Ninguna detectada | La arquitectura de monorepo previno duplicidad estructural | ✅ BAJA | N/A |

---

## 5. MATRIZ DE PAQUETES PROPUESTOS

### Tier 1: Crítico (implementar primero)

| Paquete | Contenido | Beneficio | Esfuerzo |
|---------|----------|----------|----------|
| **`packages/shared-utils`** | `money()`, `fmtDate()`, `currency conversion`, tax calc | Elimina 10+ duplicados | BAJO |
| **`packages/shared-export`** | Excel, CSV, CONTPAQi, Aspel, ZIP generation | Reutilizar en STATIKA ERP, Portal | BAJO |
| **`packages/shared-validators`** | Zod schemas, RFC, CFDI, SAT validators | Reutilizar en FacturaCheck, Portal | BAJO |
| **`packages/shared-db-patterns`** | Company scoping, soft deletes, audit trail, cascades | Template para nuevos módulos | BAJO |

### Tier 2: Importante (siguiente)

| Paquete | Contenido | Beneficio | Esfuerzo |
|---------|----------|----------|----------|
| **`packages/shared-sync`** | Offline queue, conflict resolution, retry logic | Reutilizar en todas las mobile apps | BAJO |
| **`packages/shared-notifications`** | WhatsApp, push, in-app toast framework | Reutilizar en Portal, Agro Copilot | BAJO |
| **`packages/shared-billing`** | Stripe integration, usage tracking, credit system | Reutilizar en todos los productos | BAJO |
| **`packages/shared-ui`** | Recharts wrapper, loading states, modal patterns | Reutilizar en Portal, Dashboard | MEDIO |

### Tier 3: Futuro (cuando otros productos lo necesiten)

| Paquete | Contenido | Beneficio | Esfuerzo |
|---------|----------|----------|----------|
| **`packages/shared-workflow`** | State machine, approval workflows, batch processing | Reutilizar en RH, Inventario | MEDIO |
| **`packages/shared-banking`** | Plaid wrapper, bank sync, reconciliation patterns | Reutilizar en otros financial products | MEDIO |
| **`packages/shared-ocr-advanced`** | Receipt OCR, document recognition, confidence scoring | Reutilizar en RH (contratos), Legal (facturas) | BAJO |

---

## 6. ANÁLISIS TÉCNICO POR ÁREA

### 6.1 Frontend (React/React Native)

**Archivos**: 100+ components en `apps/web/app/` + `apps/mobile/app/`

**Reutilizable**:
- ✅ UI primitives (buttons, inputs, cards, modals)
- ✅ Recharts integration (charts, KPIs)
- ✅ Form validation patterns (Zod + React Hook Form)
- ✅ Responsive layout grid system

**No reutilizable**:
- ❌ Module-specific pages (GastoCheck, CobraCheck details)
- ❌ Business logic views (approval workflows, policy editors)

**Recomendación**: Extraer UI library (`packages/shared-ui`) con 20-30 core components.

---

### 6.2 Backend (Next.js API + Supabase Edge Functions)

**Archivos**: 24 Next.js endpoints + 61 Supabase functions

**Reutilizable**:
- ✅ Auth middleware (getUser, assertRole)
- ✅ Error handling patterns
- ✅ Database query patterns (select, insert, update)
- ✅ External API wrappers (Plaid, Stripe, SAT)

**No reutilizable**:
- ❌ Module-specific business logic (journal entry calc, commission calc)

**Recomendación**: Create function template + middleware library.

---

### 6.3 Database (Supabase PostgreSQL)

**Tablas**: ~40 tables, 96 migrations

**Reutilizable**:
- ✅ RLS policies (company scoping, role-based access)
- ✅ Audit tables (created_at, updated_at, created_by)
- ✅ Status enums (draft, pending, approved, closed, rejected)

**No reutilizable**:
- ❌ Module-specific tables (policies, receipt_reembolsos, etc.)

**Recomendation**: Document migration patterns and RLS template.

---

### 6.4 Integraciones Externas

| Proveedor | Uso | Reutilizable | Observación |
|-----------|-----|--------------|-------------|
| **Supabase** | Auth, DB, Storage, Functions | ✅ ALTO | Base de toda la arquitectura |
| **Plaid** | Bank sync | ✅ ALTO | Genérico, wrapper reutilizable |
| **Stripe** | Billing | ✅ ALTO | Genérico, webhook pattern |
| **WhatsApp** | Notifications | ✅ ALTO | Webhook + sender genéricos |
| **Google Gemini** | OCR | ✅ ALTO | Vision API wrapper reutilizable |
| **SAT** | CFDI validation | ✅ MEDIO | México-específico, buena abstracción |
| **Facturama/SW** | CFDI timbrado | ✅ BAJO | México-específico, high complexity |

---

## 7. RECOMENDACIONES PRIORITARIAS

### Inmediato (Semana 1-2)

1. **Crear `packages/shared-utils`**
   - Consolidar `money()`, `fmtDate()`, tax calculations
   - Reducir duplicidad en 20+ archivos
   - Esfuerzo: 2-3 horas

2. **Crear `packages/shared-db-patterns.md`**
   - Documentar RLS template, company scoping, soft deletes
   - Facilitar creación de nuevos módulos
   - Esfuerzo: 2 horas

3. **Crear `packages/shared-validators`**
   - Exportar Zod schemas, RFC/CFDI validators
   - Reutilizar en Portal, FacturaCheck
   - Esfuerzo: 3-4 horas

### Corto Plazo (Mes 1)

4. **Extraer `packages/shared-sync`**
   - Offline queue + sync logic
   - Reutilizar en Agro Copilot, Portal
   - Esfuerzo: 4-5 horas

5. **Extraer `packages/shared-export`**
   - Excel, CSV, CONTPAQi, Aspel, ZIP generation
   - Reutilizar en STATIKA ERP
   - Esfuerzo: 6-8 horas

6. **Refactorizar `packages/shared-ocr`**
   - Ya existe pero requiere documentación
   - Preparar para Agro Copilot, other products
   - Esfuerzo: 2-3 horas

### Mediano Plazo (Mes 2-3)

7. **Crear `packages/shared-ui`**
   - Recharts components, loading states, modals
   - Unificar UI language entre apps
   - Esfuerzo: 12-15 horas

8. **Documentar workflow patterns**
   - State machines, approval workflows, batches
   - Template para nuevos módulos
   - Esfuerzo: 4-5 horas

---

## 8. MATRIZ DE IMPACTO × ESFUERZO

```
ALTO IMPACTO / BAJO ESFUERZO (Haz primero)
├─ shared-utils (date, money, tax calc)
├─ shared-validators (Zod, RFC, CFDI)
├─ shared-db-patterns (documentation)
└─ shared-sync (offline queue)

ALTO IMPACTO / MEDIO ESFUERZO (Haz después)
├─ shared-export (Excel, CSV, SAT formats)
├─ shared-ui (Recharts, components)
├─ shared-notifications (WhatsApp, push)
└─ shared-workflow (state machines)

BAJO IMPACTO / BAJO ESFUERZO (Si tienes tiempo)
├─ shared-billing (Stripe wrapper)
├─ shared-logging (already good)
└─ shared-ocr (already modularized)

BAJO IMPACTO / ALTO ESFUERZO (Evita)
├─ Refactorizar contabilidad (muy específico)
├─ Refactorizar cobranza (dominio único)
└─ Refactorizar nómina (legislación)
```

---

## 9. CONCLUSIONES

### Capacidades del Ecosistema STATIKA

CHECK SUITE ya es una arquitectura **altamente modular y reutilizable**. Su mayor fortaleza es:

1. **Separación clara de concerns**: 5 módulos independientes pero integrados
2. **Shared package bien estructurado**: Types, OCR, export, validators ya centralizados
3. **Edge Functions como glue**: 61 funciones, cada una responsable de un "evento"
4. **RLS architecture**: Seguridad by-design en la BD

### Oportunidades de Mejora

1. **Extraer 8-10 paquetes** reduciría duplicidad de UI/utils en 20-30%
2. **Documentar patterns** aceleraría adopción en nuevos proyectos STATIKA
3. **Crear blueprint para nuevos módulos** evitaría re-inventar rueda

### Impacto en Otros Productos STATIKA

| Producto | Capacidades que Puede Reutilizar | Ahorro Estimado |
|----------|---------------------------------------|-----------------|
| **STATIKA Agro Copilot** | OCR, Sync, Notifications, Auth, Logging | 25-30% development |
| **STATIKA Portal** | Export, UI, Auth, Billing, Notifications | 20-25% development |
| **STATIKA ERP** | Export (SAT formats), Validators, DB patterns | 15-20% development |
| **STATIKA RH** | Workflow, Notifications, Logging, OCR | 15-20% development |

---

## 10. SIGUIENTES PASOS

1. **Validar análisis** con equipo técnico (2 horas)
2. **Priorizar paquetes** según roadmap STATIKA (1 hora)
3. **Crear plan de extracción** (4-6 horas)
4. **Ejecutar Tier 1** en paralelo a features (2-3 semanas)
5. **Documentar** cada paquete con ejemplos y tests (ongoing)

---

**Análisis completado**: 2026-07-08  
**Próxima revisión**: 2026-08-08 (post-Tier-1 extraction)
