# ContaCheck · C1.1 — GastoCheck: Primer Piloto Funcional

> Diseño del flujo de generación automática de pólizas desde GastoCheck, mapeado a estados reales. Ref. §4.
> No se modifica código; esto es el diseño ejecutable.

## 1. Estados reales (evidencia)
Enum `expense_status` (`20260606000001_init.sql:19-22`): `captured, pending_auth, authorized,
pending_invoice, invoice_applied, observed, rejected, deleted, duplicate, closed_in_policy`. Máquina en
`packages/shared/src/status.ts:21-31`. Ortogonal: `cfdi_type ∈ {con_cfdi, sin_cfdi}` (`20260613300000:12`).

**Gaps de la máquina (a considerar):**
- `pending_invoice` es alcanzable como `from` pero **ninguna** transición lo produce (`status.ts:27`) — huérfano.
- `authorize-expense/index.ts:9` acepta `submit`/`cancel` que **no existen** en `TRANSITIONS` → acciones muertas.
- `reembolsos-workflow` no tiene acción que produzca `closed` (`20260617200000:10` define el estado; la Edge
  solo hace draft/submit) → gap de transición.

## 2. Qué estado genera cada asiento

| Asiento | Estado disparador (evidencia) | Cargo | Abono |
|---|---|---|---|
| **1. Reconocimiento del gasto** | `authorized` (`status.ts:23`; `authorize-expense/index.ts:70-73` escribe `authorized_by/at`) — primer estado que el trigger `recompute_policy_closing` cuenta (`init.sql:269-271`) | DR Gasto (cuenta de `accounting_account_id`→v1) + DR IVA acreditable | CR Proveedores (con_cfdi/crédito) **o** CR Bancos (pago inmediato) |
| **2. Cuenta por pagar** | `accounts_payable.status='pending'` (`20260624000001:18`) — entidad **desacoplada** (sin FK a `expenses`) | DR Gasto | CR Proveedores |
| **3. Salida bancaria** | `accounts_payable.status='paid'` + `payment_date` (`20260624000001:18-21`); no hay estado de pago en `expenses` | DR Proveedores | CR Bancos |
| **4. Aplicación de anticipo** | insert `advances` (`init.sql:147-157`, sin `status`) + cierre `closed_in_policy` (`close-policy/index.ts:96-100`) | DR Anticipos a comprobar (al entregar) → luego DR Gasto / CR Anticipos (al comprobar) | CR Bancos / CR Anticipos |
| **5. Reversa** | `rejected`/`deleted`/`duplicate` (`status.ts:24,28,30`) — hoy **solo excluye del SUM**, sin contra-asiento | contra-asiento espejo del reconocimiento | — |

## 3. Origen de montos (crítico) — fragmentación en 3 tablas
Subtotal/IVA/total están **triplicados** sin reconciliación: `expenses.subtotal/iva/total` (`init.sql:172-174`),
`cfdi_data.subtotal/iva/total` (`init.sql:193-195`), `receipts.subtotal_amount/tax_amount/total_amount`
(`20260608000003:118-120`). **Retenciones e IEPS/ISH viven SOLO en `receipts`** (`20260614000100:6-10`),
accesibles desde `expenses` únicamente vía `expenses.receipt_id → receipts` (`20260608000003:194-196`); si
`receipt_id` es NULL, **no hay retenciones**.

**Regla del adaptador GastoCheck:** la vista de origen (`contacheck_expense_source_v`) debe:
1. Tomar cuenta desde `expenses.accounting_account_id` (v1) con fallback a `accounting_account_code`.
2. Tomar montos con prioridad `receipts` (por tener retenciones/IEPS/ISH) → `cfdi_data` → `expenses`.
3. Resolver forma/método de pago desde `cfdi_data.forma_pago/metodo_pago` (`init.sql:197-198`) o
   `receipts.payment_method` (`20260608000003:126`).
4. Marcar **excepción** si hay divergencia entre las 3 fuentes de montos (validación de conflicto).

## 4. Flujo mínimo propuesto (mapeo a estados reales)

| Estado ContaCheck | Estado real | Naturaleza |
|---|---|---|
| `capturado` | `captured` (existe) | operativo |
| `validado` | `pending_auth` (existe) | operativo |
| `aprobado` | `authorized` (existe, ya escribe `authorized_by/at`) | **reconocimiento** |
| `accounting_ready` | **NUEVO** (no existe) | precondición: cuenta resuelta + montos sin conflicto + (si `requires_cfdi`) CFDI presente |
| `voucher_generated` | **NUEVO** | póliza `proposed` en `accounting_vouchers` |
| `posted` | **NUEVO** (cercano a `closed_in_policy`, distinto dominio) | contabilizada e inmutable |

Los 3 estados contables **no se añaden a `expenses`** (no invasivo): viven en el registro contabilizable de
ContaCheck / en `accounting_vouchers.status`. `expenses` solo aporta el evento (`authorized`).

## 5. Diseño no invasivo del piloto
1. **Disparo:** al `authorize` (Edge `authorize-expense`), un adaptador lee la vista de origen y **propone**
   una póliza (`status='proposed'`) en `accounting_vouchers` — sin modificar `authorize-expense` en C1.1
   (mecanismo: vista/outbox; ver Plan). `source_module='gastocheck'`, `source_ids=[expense_id]`.
2. **Reglas:** cuentas y contrapartida vienen del **motor de reglas** (no hardcode), usando categoría
   (`expenses.category_id`), proveedor, `cfdi_type` y forma de pago.
3. **IVA/retenciones como líneas separadas** (cierra P2 de C0).
4. **VoBo:** el contador revisa `proposed` → `posted`.
5. **Reversa:** al `rejected/deleted` de un gasto ya `posted`, generar contra-asiento (no editar).

## 6. Precondiciones para implementar (no bloquean el diseño)
- Definir "validado" (¿`pending_auth` o incluye validación SAT de `receipts.sat_validation_status`
  `20260613300000:6`?).
- Cerrar el gap de `reembolsos` que nunca llega a `closed`.
- Confirmar en prod la FK de `expenses.accounting_account_id` a v1.
