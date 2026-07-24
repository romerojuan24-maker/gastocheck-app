# ContaCheck · C2A — Contratos de Servicio

> §18 contratos; §20 alcance BancoCheck; §21 alcance GastoCheck. Entrada/salida/autorización/idempotencia/
> transacción/errores/auditoría por servicio, y capa donde vive cada uno. **Generación definitiva nunca desde
> React/React Native.**

## 1. Capa por servicio
| Servicio | Capa | Razón |
|---|---|---|
| `resolveAccountingRules` | **RPC Postgres** (`accounting_resolve_rules`) | determinista, cerca de datos; también consumible en dry-run |
| `generateVoucher` | **RPC Postgres** (`accounting_generate_voucher`) invocada por Edge/adaptador | escritura transaccional + idempotencia a nivel BD |
| `validateVoucher` | **RPC Postgres** | valida balance/cuenta/período en transacción |
| `approveVoucher` | **RPC Postgres** | capacidad + segregación |
| `postVoucher` | **RPC Postgres** | asigna folio, valida período, sella inmutabilidad |
| `reverseVoucher` | **RPC Postgres** (`accounting_reverse_voucher`) | transacción espejo |
| `linkBankTransaction` | **RPC Postgres** | crea `accounting_source_links(bank_match)` |
| `getVoucherBySource` | **RPC Postgres** (lectura) o vista | consulta por origen |
| Orquestación adaptadores (eventos) | **Edge Function** (Deno) | dispara desde eventos, llama RPC con `service_role` |
| Tipos/validación de payload | **librería compartida** (`packages/shared`) | reutilizada por web/mobile/edge |
| UI | **React/RN** | solo **propone/lee**; jamás postea directo a `accounting_vouchers` |

**Regla dura:** las 2 rutas cliente actuales (`conciliacion/page.tsx:187`, `useFacturaCheck.ts:423`) que hoy
hacen INSERT directo **migran a llamar la RPC** (ver Compatibilidad). React/RN nunca vuelve a insertar póliza
definitiva.

## 2. Contratos (entrada → salida)

### `resolveAccountingRules`
- **In:** `{company_id, movimiento_normalizado}`. **Out:** `{rule_version_id, lines[], exceptions[], level}`
  (`AUTO_POST|AUTO_APPROVE|REVIEW_REQUIRED|CONFIGURATION_REQUIRED|REJECTED`).
- **Auth:** `accounting.generate`. **Idempotencia:** N/A (puro). **Tx:** solo lectura. **Errores:**
  `RULE_AMBIGUOUS`, `RULE_MISSING`, `ACCOUNT_INACTIVE`. **Audit:** no (dry-run opcional sí).

### `generateVoucher`
- **In:** `{company_id, source_module, source_entity, source_id, source_version, event_type, payload,
  idempotency_key?}`. **Out:** `{voucher_id, status, level}`.
- **Auth:** `accounting.generate` (o `service_role` adaptador). **Idempotencia:** obligatoria — UNIQUE
  `(company_id, idempotency_key)`; misma llave→devuelve existente; llave+payload distinto→`409 CONFLICT`.
- **Tx:** inserta voucher (`generated/validated/pending_*`) + líneas + `accounting_source_links(origin)` en una
  transacción. **Errores:** `IDEMPOTENCY_CONFLICT`, `PERIOD_CLOSED`, `RULE_*`, `UNBALANCED`. **Audit:** sí.

### `validateVoucher`
- **In:** `{company_id, voucher_id}`. **Out:** `{status, exceptions[]}`. **Auth:** `accounting.generate`.
  **Tx:** lectura + update de estado. **Errores:** `UNBALANCED`, `ACCOUNT_INACTIVE`, `DIMENSION_REQUIRED`.

### `approveVoucher`
- **In:** `{company_id, voucher_id, expected_version}`. **Out:** `{status:'approved'}`. **Auth:**
  `accounting.approve` (≠ quien generó). **Idempotencia:** `expected_version` (optimistic lock). **Errores:**
  `VERSION_CONFLICT`, `NOT_REVIEWABLE`, `SEGREGATION_VIOLATION`. **Audit:** sí.

### `postVoucher`
- **In:** `{company_id, voucher_id, accounting_date, expected_version}`. **Out:** `{status:'posted',
  voucher_number}`. **Auth:** `accounting.post` (≠ approve). **Tx:** asigna folio (secuencia por empresa/año/
  tipo), valida período `open`, recalcula totales, verifica `Σdebit=Σcredit`, sella inmutabilidad. **Errores:**
  `PERIOD_NOT_OPEN`, `UNBALANCED`, `ALREADY_POSTED`, `VERSION_CONFLICT`. **Audit:** sí.

### `reverseVoucher`
- **In:** `{company_id, voucher_id, reason, accounting_date?, expected_version}`. **Out:** `{reversal_voucher_id,
  reversal_voucher_number}`. **Auth:** `accounting.reverse`. **Tx:** póliza espejo (ver Orígenes §3). **Errores:**
  `NOT_POSTED`, `ALREADY_REVERSED`, `VERSION_CONFLICT`. **Audit:** sí.

### `linkBankTransaction`
- **In:** `{company_id, voucher_id, bank_transaction_id, relationship_type}`. **Out:** `{link_id}`. **Auth:**
  `accounting.post`/`review`. **Idempotencia:** UNIQUE por `(voucher_id, bank_transaction_id, relationship_type)`.
  **Errores:** `ALREADY_LINKED`, `TXN_NOT_FOUND`. **Audit:** sí.

### `getVoucherBySource`
- **In:** `{company_id, source_module, source_entity, source_id}`. **Out:** `voucher[]`. **Auth:**
  `accounting.view`. **Tx:** lectura vía `accounting_source_links`.

## 3. §20 — Alcance mínimo piloto técnico BancoCheck
- **Crea póliza nueva SOLO para:** comisión (`bank_fee`), interés, movimiento directo, transferencia/diferencia
  **no originada** en otro módulo. (Categorías de `poliza.ts:140-152`.)
- **Para pagos/cobros originados en otros módulos:** **`linkBankTransaction`** (`relationship_type='payment'|
  'collection'|'bank_match'`) + concilia — **no** crea póliza de origen (evita doble contabilización).
- Ciclo: `generate → validate → approve → post → link/reconcile → reverse` con auditoría. VoBo reusa el gate de
  `bancocheck_approve_suggestion` (`20260712050000`).

## 4. §21 — Alcance mínimo piloto funcional GastoCheck
- **Disparo:** transición a `authorized` (`status.ts:23`; `authorize-expense/index.ts:70-73`) → evento
  `gasto_autorizado` → `generateVoucher` (sin añadir estados a `expenses.status`).
- **Payload:** `expense_id`, cuenta (v1), montos (prioridad `receipts`→`cfdi_data`→`expenses`), IVA/retenciones
  (`receipts`, `20260614000100:6-10`), proveedor (`party_id`), `cfdi_type`, forma de pago, `cost_center_id`+tags.
- **Reglas/CFDI/impuestos/dimensiones:** vía motor; IVA y retención como líneas propias.
- **Anticipo:** evento aparte (`advances` insert) → póliza de anticipo; **cierre** (`closed_in_policy`,
  `close-policy/index.ts:96-100`) → aplicación.
- **Pago:** `accounts_payable.status='paid'` → póliza de pago + `linkBankTransaction`.
- **Reversa:** `rejected/deleted` de gasto ya `posted` → `reverseVoucher`.
- **Desconexión `accounts_payable`↔`expenses`:** hoy `accounts_payable` no tiene FK a `expenses`
  (`20260624000001`). Solución no invasiva: **`accounting_source_links`** correlaciona ambos por
  `(source_entity='expense', source_id)` y `(source_entity='accounts_payable', source_id)` bajo el mismo hecho;
  a futuro, columna opcional de correlación (no en C2A).
