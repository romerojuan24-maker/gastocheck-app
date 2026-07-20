# VERIFICACIÓN DE CUMPLIMIENTO CONTRA CÓDIGO REAL — 2026-07-20
**Método:** 5 auditores paralelos, solo lectura, toda afirmación con evidencia archivo:línea.
**Alcance:** 10 criterios de aceptación (doc 11) + mapa productor→consumidor de datos entre apps.

---

## VEREDICTO POR CRITERIO

| # | Criterio | Veredicto | Núcleo del hallazgo |
|---|----------|-----------|---------------------|
| 1 | Cierre CxP/CxC | 🔴 NO CUMPLE | Sin estado 'closed', sin `accounts_receivable`, sin trigger de cierre; UI solo web |
| 2 | OCR sin duplicidad | 🔴 NO CUMPLE | Gemini se invoca en cada captura; dedup por hash inalcanzable (nadie envía `file_sha256`) |
| 3 | Auto-confirm OCR | 🔴 NO CUMPLE | Todo pasa por formulario sin importar confidence; low no fuerza re-foto |
| 4 | Sin "relacionar" manual | 🟡 PARCIAL | Auto solo si captura trae póliza; captura estándar deja recibos huérfanos; `expense_attachments` es tabla fantasma |
| 5 | Notificaciones | 🔴 NO CUMPLE | Cadena muerta por ambos extremos: sin trigger, `notify-supervisor` sin llamadores, `push_tokens` vacía (cliente es stub), cero lectores de UI |
| 6 | Cierre automático de póliza | 🔴 NO CUMPLE | Sin `planned_closing_date`, sin cron; `close-policy` huérfana; pólizas de reembolso nacen ya cerradas |
| 7 | Web vs mobile consistentes | 🟡 PARCIAL | Ver matriz abajo; el doc 06 tenía 3 errores de hecho |
| 8 | CobraCheck verificada | 🟡 PARCIAL | Web funciona factura→pago→cierre; el circuito móvil de campo está ROTO (ver B5) |
| 9 | Duplicidades eliminadas | 🔴 NO CUMPLE | Las 4 persisten; SAT se valida hasta por 3 rutas paralelas |
| 10 | Operatividad ≥ 50% | 🔴 NO CUMPLE | Consecuencia de lo anterior: bloqueadores > 0, procesos sin cierre persisten |

**Score: 0 CUMPLE · 3 PARCIAL · 7 NO CUMPLE**

---

## A. HALLAZGO MAYOR: CAPA DE INTEGRACIÓN FANTASMA

El diseño inter-app (GastoCheck→Póliza automática→Contabilidad→Flujo, orquestador, scoring, alertas) está implementado en **16 edge functions que operan sobre tablas que NO existen en ninguna migración** (esquema "en español" fantasma): `movimientos_financieros`, `gastos`, `polizas`, `pagos`, `banco_movimientos`, `plan_pagos_semanal`, `pago_semanal`, `ingreso_semanal_esperado`, `cobros`, `clientes`, `alertas`, `escenario_what_if`, `scoring_cliente_cobranza`, `inventario_productos`.

Funciones afectadas: `orquestador-integracion`, `guardar-gasto-integrado`, `dashboard-consolidado`, `crear-poliza-automatica`, `registrar-pago-automatico`, `reconciliar-automatico`, `proyectar-flujo-efectivo`, `exportar-polizas-sat`, `actualizar-flujo-semanal`, `crear-plan-semanal`, `arrastrar-pago`, `calcular-escenarios-what-if`, `calcular-scoring-cobranza`, `generar-alertas-inteligentes`, `detectar-anomalias`, `gestionar-inventario`.

Agravante: sus llamadores web (`api/gastocheck/crear.ts`, `api/dashboard/consolidado.ts`, etc.) son archivos `.ts` sueltos, **no `route.ts`** → ni siquiera son endpoints válidos en Next App Router. **Toda esta capa es inoperante al 100%.**

---

## B. CADENAS ROTAS PRIORIZADAS (fallas activas)

### B1. Validación SAT rota de punta a punta
- Los 4 clientes leen `data?.status === 'validated'`, pero `validate-cfdi` responde `{ ok, estado, vigente }` — `status` siempre undefined → **todo CFDI se evalúa como inválido aunque esté vigente** (`reembolso.tsx:177`, `supervisor/reembolsos/index.tsx:165`, `polizas.tsx:194`, web `polizas/page.tsx:188`).
- Escriben `'invalid'`/`'cancelled'`/`'not_found'` que **violan el CHECK** de `sat_validation_status` (`20260610000007:9-11` solo permite pending/validated/blocked/warning) → la persistencia falla en silencio.
- Los clientes mandan solo `{uuid}` sin RFCs → la consulta SOAP al SAT va incompleta → "No Encontrado" casi siempre.
- `validate-batch-sat` es un **mock** que marca 'validated' sin llamar al SAT (`batch-detail.tsx:187` lo usa).
- La tabla `sat_validations` (cache/historial que resolvería la triple validación) existe sin un solo lector/escritor.

### B2. Cerrar póliza no marca los comprobantes
`polizas.tsx:231` y web `polizas/page.tsx:224` escriben `receipts.status='closed_in_policy'`, valor **fuera del CHECK** (`20260608000003:150-154`) → el update falla siempre.

### B3. Panel web admin con columnas inexistentes
`pendientes/page.tsx:42`, `hoy/page.tsx:56`, `mis-tareas/page.tsx:46` filtran `advances.status='requested'` y leen `folio`/`user_id` — **advances no tiene esas columnas** (`init.sql:144-154`) → error 400, tarjetas siempre vacías.

### B4. Lista de autorización del supervisor
`supervisor.tsx:228` filtra expenses con `'submitted'`, valor **inexistente en el enum** `expense_status` (`init.sql:16-19`) → la consulta falla.

### B5. CobraCheck móvil de campo ROTO
- `cobra_movements.method` **no existe** → "Registrar Pago" (`pagos.tsx:175`) y "Transferencia" (`transferencia.tsx:84`) fallan al sincronizar; el pago queda atorado en AsyncStorage para siempre.
- Trigger `create_payment_from_movement` inserta `cobra_payments.created_by`, columna **inexistente** en el esquema aplicado → aborta movimientos 'collected' con factura desde Mi Ruta.
- `20260618210000_cobracheck_complete.sql` contiene **SQL inválido** (policies multi-comando, INSERT con USING) → probablemente nunca aplicó → `cobra_promises` y `cobra_calls` en duda.
- `20260715100000_signal_triggers.sql` usa `new.invoice_number` (la columna real es `folio`) → si aplicó, **bloquea crear/pagar facturas**.
- `status='overdue'` **nunca se asigna** (sin cron/trigger) → tabs de vencidos y señal del Advisor siempre vacíos; `days_overdue` estático en 0.
- RLS por rol inconsistente: la app asigna rol `'collector'` pero la policy de UPDATE de cobra_invoices permite `'cobrador'` → el cobrador no puede marcar pagada una factura (falla silenciosa); el INSERT de cobra_movements excluye a `'owner'`.
- "Registrar llamada/WhatsApp/email": **no existe UI** en ninguna plataforma; el único escritor (webhook WhatsApp) inserta columnas inexistentes → falla siempre.

### B6. FlujoCheck móvil dashboard roto
`flujocheck-logic.ts:144,209,283,295` lee `company_payable`, `tax_obligations`, `invoices`, `clients` — **ninguna existe** — y hace `throw` → dashboard truena o queda vacío.

### B7. Contador BancoCheck
`bancocheck/contador/page.tsx:37-46` filtra `pending_document`/`pending_invoice`/`unidentified` — **ningún escritor produce esos estados** → 3 de 5 tarjetas siempre en cero.

### B8. Notificaciones (cadena muerta completa)
Tabla sin trigger → función escritora sin llamadores → función push sin tokens (cliente móvil es stub no-op) → cero lectores de UI.

### B9. Dead-ends menores
`cfdi_data` sin escritor (antiduplicado CFDI inútil) · `cobra_deposits` sin conciliación downstream · `cobra_commissions` sin escritor · `assign-receipts-to-policy` lee `operator_id` que no seleccionó · web facturacheck llama `/api/validate-cfdi-sat` que no existe (404) · `apps/cobra-mobile` (legacy) usa 3 tablas inexistentes.

---

## C. INVENTARIO DE ELEMENTOS MUERTOS (sin uso, no rompen pero ensucian)

- **Tablas:** `accounting_accounts_v2`, `accounting_entries`, `sat_validations`, `expense_attachments`, `receivables`, `payables`, `flujo_cash_flow_items`, `cash_flow_periods`, `cash_flow_transactions`, `bank_accounts_manual`, `bank_accounts_multi`, `accounting_category_map`, vista `cobra_aging_view`.
- **Edge functions sin ningún llamador:** `authorize-expense`, `close-policy`, `assign-receipts-to-policy`, `quick-capture`, `reembolsos-workflow`, `notify-supervisor`, `send-notification`, `cobra-risk-scoring`, `cobra-sat-validator`, `validate-cfdi-real`, `export-excel`, `export-zip` (+ las 16 de la capa fantasma).
- **Pantalla inalcanzable:** `policy-export-modal.tsx` (nadie navega a ella).
- **Archivo mina:** `lib/i18n.ts` importa `expo-localization` no instalado (huérfano hoy).

---

## D. MATRIZ WEB vs MOBILE (criterio 7, incógnitas resueltas)

| Función | Mobile | Web | Veredicto |
|---------|--------|-----|-----------|
| Autorizar gasto | ✓ `supervisor.tsx:320` | ✗ solo SELECT | SOLO MOBILE (doc 06 lo tenía invertido) |
| Cambiar roles | ✓ `equipo.tsx:164` | ✓ `api/members/[userId]:48` | CONSISTENTE |
| Desactivar usuario | ✓ soft (`status='disabled'`) | ⚠ DELETE duro | DIVERGENTE (web borra permanente) |
| Cartera cobranza | ✓ `cartera-total.tsx:39` | ✓ `facturas/page.tsx:66` | CONSISTENTE (doc 06 decía FALTA: falso) |
| Registrar llamada | ✗ | ✗ | ROTO EN AMBOS |
| Exportar | ✓ `batch-detail`→generate-export | ✓ export client-side | CONSISTENTE (rutas separadas) |
| KPIs Dashboard | ✓ por módulo | ✓ `/hoy` multi-módulo | CONSISTENTE (alcance mayor web) |

---

## E. LO QUE SÍ FUNCIONA (cadenas verificadas de punta a punta)

1. Captura → `receipts` → `receipt_reembolsos`/`reembolsos` → póliza → export CONTPAQi/CSV (con la falla B2 al final).
2. Cobranza **web**: factura → pago → cierre (`facturas/page.tsx:138-159`).
3. Banco: importación → auto-match → conciliación → clasificación.
4. CFDI: timbrado → facturacheck → vínculo con movimientos bancarios.
5. FlujoCheck consume directo bank_accounts/cobra_invoices/reembolsos (`useFlujo.ts`) — la integración real es esta, no la capa fantasma.
6. Catálogo contable: `accounting_accounts` → asignación → export (verificado hoy; `_v2` es paralelo muerto).

---

## F. ORDEN DE CORRECCIÓN RECOMENDADO

**Fase 1 — fallas activas visibles a diario (código chico, OTA):**
B1 clientes SAT (leer `vigente`, mandar RFCs, valores válidos del CHECK) · B2 (`included_in_batch` o ampliar CHECK) · B3 (columnas reales de advances) · B4 (quitar 'submitted') · B6 (quitar tablas fantasma de flujocheck-logic) · B7 (alinear estados).

**Fase 2 — CobraCheck de campo (requiere migración SQL + OTA):**
Agregar `cobra_movements.method` y `cobra_payments.created_by` (o quitar del código) · corregir/reaplicar migración 20260618210000 con SQL válido · triggers `invoice_number`→`folio` · job para 'overdue' · unificar rol collector/cobrador en RLS.

**Fase 3 — decisiones de diseño (con Juan):**
¿Se elimina la capa fantasma (16 functions) o se construye su esquema? · ¿Notificaciones se implementan o se elimina la cadena muerta? · Limpieza de tablas/funciones muertas (C).
