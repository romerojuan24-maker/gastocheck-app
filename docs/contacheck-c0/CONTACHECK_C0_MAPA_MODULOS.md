# ContaCheck · C0 — Mapa de Módulos

> Qué hace cada módulo, qué tablas manda, qué evento "confirma" sus movimientos y su madurez contable.

## GastoCheck — egresos (gastos, anticipos, reembolsos, viáticos, CxP)
- **Modelo dual no reconciliado:** `expenses` (motor de saldos/autorización, `init.sql:163`) y `receipts`
  (comprobante, el que captura la app y usa el export, `0003_receipts_schema.sql:97`), enlazados 1:1
  opcional por `expenses.receipt_id`.
- **Motor económico:** trigger `recompute_policy_closing` (`init.sql:260`):
  `saldo = apertura + Σanticipos − Σgastos(authorized|invoice_applied|closed_in_policy)`.
- **Evento que confirma egreso contable:** `expenses.status → authorized` (Edge `authorize-expense`).
  Comprobación CFDI → `invoice_applied`; cierre → `closed_in_policy`.
- **Impuestos:** subtotal/IVA en ambos; **retenciones (IVA/ISR) e IEPS/ISH solo en `receipts`**
  (`20260614000100_tax_fields.sql`). `metodo_pago`/`forma_pago` solo en `cfdi_data`.
- **Export real:** `generate-export` (receipts → Excel/CONTPAQi).
- **Madurez operativa:** FUNCIONAL C/ PENDIENTES (bugs: dashboard filtra por enum inexistente
  'approved'/'draft' → montos 0; `pendientes` consulta `auth.users` vía PostgREST → emails "unknown").
- **Madurez contable:** ESQUELETO (motor `generate_accounting_entries` existe pero no cableado;
  contrapartida `'1010'` fija; SAT simulado; export real desconectado de los asientos).

## BancoCheck — control operativo de movimientos bancarios
- **Diseño explícito:** "control operativo, NO banco digital" (`20260712030000` eliminó tokens OAuth).
  Nunca guarda credenciales bancarias.
- **Tabla núcleo:** `bank_transactions` (`amount` con signo, `currency`, `balance_after`, dedup por
  `unique_hash`, idempotencia de import por `file_hash`).
- **Clasificación contable REAL** (`20260721100000`): `accounting_account_id`/`_code` → `accounting_accounts`,
  `linked_client_id` → `cobra_clients`, `linked_supplier_id` → `suppliers`. RPC `bancocheck_classify`
  (9 args) UPDATE + `bank_audit_log` atómico.
- **Motor de sugerencias:** Edge `bancocheck-auto-match` (solo propone: transferencias internas, depósito→
  factura, cargo→receipt). `bancocheck-ai-classify` (Gemini sugiere código de cuenta). **Nunca auto-aplica.**
- **VoBo contador:** `bancocheck_approve_suggestion` exige rol owner/admin/supervisor/accountant/contador_general.
- **Pólizas:** `accounting_vouchers` (balanceada, `CHECK debit=credit`) + `apps/web/lib/poliza.ts`.
- **Madurez:** FUNCIONAL C/ PENDIENTES. **La más madura contablemente.** Pendientes: mapeo
  `CATEGORY_ACCOUNT` duplicado y hardcodeado en web y mobile; póliza mobile solo texto compartido; no
  se persiste la póliza en `accounting_vouchers` desde el flujo; conciliación mensual por saldo sin UI.

## CobraCheck — cuentas por cobrar (CxC) y cobranza de campo
- **Tablas núcleo:** `cobra_clients` (credit_limit, current_balance, risk_score, rfc),
  `cobra_invoices` (subtotal/tax/amount, `uuid_sat`, issue/due/payment_date, `days_overdue` generado),
  `cobra_payments`, `cobra_movements` (campo: collected/promise/not_paid → auto-genera pago).
- **Evento que confirma cobro:** insert en `cobra_payments`; trigger `update_invoice_status` → paid/partial;
  `recalc_client_balance` recalcula saldo del cliente. Cobro de campo → `create_payment_from_movement`
  (efectivo hardcodeado).
- **Aging:** `cobra_aging_view` (outstanding_balance, max_days_overdue).
- **Faltantes contables:** sin retenciones, sin moneda (asume MXN), sin forma/método de pago SAT ni tipo
  de CFDI en factura, **sin nota de crédito**, descuento no modelado; comisión de cobrador **3 % hardcodeada**
  (`api/cobracheck/collections/route.ts:130`).
- **Madurez operativa:** FUNCIONAL C/ PENDIENTES (esquema triplicado/en conflicto; `api/cobra/*` stubs 501).
- **Madurez contable:** NULA (no genera pólizas/asientos; `cobracheck/polizas.tsx` es hub de navegación,
  falso amigo).

## NóminaCheck — nómina (Fase 1A backend desplegado)
- **Esquema `nomi_*`** desplegado a prod (F1A): `nomi_employees` (RFC/NSS/CURP **cifrados**), `nomi_payroll`
  (version, calculated_by, status, paid_at), `nomi_tax_withholdings`, `nomi_attendance`,
  `nomi_employee_bank_accounts` (cifrado), + modelo de **capacidades/scopes** (`nomi_can`, `nomi_in_scope`).
- **Evento que confirma movimiento:** `nomi_payroll` aprobada (`nomi_approve_payroll`) → provisión de nómina;
  `paid_at` → pago. Retenciones ISR/IMSS en `nomi_tax_withholdings`.
- **Vista de tesorería:** `nomi_cashflow_commitments` (consumida por FlujoCheck).
- **Madurez operativa:** BACKEND FUNCIONAL (sin UI hasta Fase 1B; PII/banca vía Edge Functions cifradas).
- **Madurez contable:** NULA (aún no calcula asientos; es el mejor candidato a diseño contable "desde el
  inicio" porque su esquema es nuevo y limpio).

## FlujoCheck — tesorería / proyección
- **Es un AGREGADOR/PROYECTOR**, no una fuente contable. `apps/mobile/lib/flujocheck-logic.ts` solo LEE de
  `bank_transactions`, `cobra_collections`, `accounts_payable`, `nomi_cashflow_commitments`,
  `cobra_commissions`, `cobra_invoices` y produce proyecciones/escenarios. **No escribe movimientos.**
- **Única escritura propia:** `cash_flow_items` (ítems manuales de tesorería).
- **Esqueleto sin uso:** `20260705120000` (14 tablas), `flujo_*` (`20260708000002`), `economic_indicators`
  — sin código que las pueble. `api/flujo/route.ts` 100 % stub; `api/flujocheck/dashboard/route.ts` apunta
  a tablas inexistentes (stale; la versión mobile ya se corrigió).
- **Madurez:** PARCIAL (proyector). **Para ContaCheck: NO es fuente contable** (no se contabiliza una proyección).

## Síntesis de dependencia contable
```
Fuentes contabilizables → ContaCheck (contabilización) → Libro/pólizas → Export
  GastoCheck (egresos)  ─┐
  CobraCheck (CxC/cobros)─┤
  BancoCheck (bancos)   ─┼─→ [adaptadores] → contrato normalizado → reglas partida doble → accounting_vouchers/journal
  NóminaCheck (nómina)  ─┘
  FlujoCheck ............ (NO: solo proyecta, lee de los anteriores)
```
