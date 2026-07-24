# ContaCheck · C0 — Movimientos Contabilizables

> Para cada módulo: **qué evento (transición de estado que YA existe) confirma un asiento**, con qué montos
> y contrapartida. Este documento es el insumo directo del contrato normalizado (doc 6).

## Principio
ContaCheck **no inventa el momento de contabilización**: se engancha al *estado que ya confirma el hecho
económico* en cada módulo. Un movimiento se contabiliza cuando su entidad origen alcanza el estado que la
lógica de negocio actual ya trata como "firme".

## GastoCheck — egresos

| Evento (existente) | Disparador | Asiento (partida doble) | Montos |
|---|---|---|---|
| Gasto autorizado | `expenses.status → authorized` (Edge `authorize-expense`) | Dr Gasto (cuenta cat.) + Dr IVA acreditable · Cr Proveedor/Bancos | `subtotal`, `iva`, retenciones (solo en `receipts`) |
| CFDI aplicado | `→ invoice_applied` | Reclasifica sin_cfdi→con_cfdi; reconoce IVA acreditable formal | `cfdi_data`/`receipts` |
| Cierre en póliza | `→ closed_in_policy` (Edge `close-policy`) | Salda anticipo vs gasto comprobado | Σ del trigger `recompute_policy_closing` |
| Anticipo entregado | insert `advances` | Dr Anticipo a comprobar · Cr Bancos/Caja | `advances.amount`, `method` |
| Reembolso cerrado | `reembolsos.status → closed` (Edge `reembolsos-workflow`) | Dr Gastos · Cr Cuenta por pagar empleado | `total` (excluye `is_credit`) |
| CxP pago | `accounts_payable.status → paid` | Dr Proveedor · Cr Bancos | `paid_amount`, `payment_date` |

- **Ojo:** retenciones/IEPS/ISH solo viven en `receipts`; `expenses`/`cfdi_data` no las tienen → el
  adaptador debe leer del lado `receipts` cuando existan.
- Cancelación (`deleted`/`duplicate`/`rejected`) **no** genera contra-asiento hoy: solo excluye del `SUM`.
  ContaCheck deberá decidir póliza de cancelación (ver brechas).

## BancoCheck — movimientos bancarios

| Evento (existente) | Disparador | Asiento | Montos |
|---|---|---|---|
| Movimiento clasificado + aprobado | `bancocheck_approve_suggestion` (VoBo contador) | Dr/Cr Bancos vs cuenta clasificada (`accounting_account_id`) | `amount` (signo), IVA acreditable 16 % separado (poliza.ts) |
| Comisión bancaria | categoría `bank_fee` | Dr Gastos financieros + Dr IVA acred. · Cr Bancos | neto + IVA |
| Transferencia interna | `linked_transaction_id`, categoría `internal_transfer` | Dr Bancos B · Cr Bancos A (sin resultado) | monto espejo |
| Impuesto/retención bancaria | categoría `tax` → cuenta 2200 | Dr Impuestos · Cr Bancos | `amount` |

- **BancoCheck ya tiene la contrapartida bancaria resuelta** (es el módulo de bancos) → es la fuente
  natural de la **conciliación** entre asientos de otros módulos y el banco real.

## CobraCheck — cuentas por cobrar

| Evento (existente) | Disparador | Asiento | Montos |
|---|---|---|---|
| Factura emitida | insert `cobra_invoices` (`status pending`) | Dr Clientes (CxC) · Cr Ingresos + Cr IVA trasladado por cobrar | `subtotal`, `tax` |
| Cobro recibido | insert `cobra_payments` → trigger `update_invoice_status` (paid/partial) | Dr Bancos/Caja · Cr Clientes; traslada IVA por cobrar→trasladado | `cobra_payments.amount`, `method` |
| Cobro de campo | `cobra_movements` collected → `create_payment_from_movement` | igual que cobro (efectivo) | monto |
| Comisión de cobrador | `cobra_commissions` / 3 % hardcodeado | Dr Gasto comisiones · Cr CxP cobrador | % sobre cobrado |

- **Faltantes que bloquean el asiento correcto:** sin retenciones, sin moneda, sin tipo de CFDI (I/E/P),
  **sin nota de crédito** (no hay contra-factura). ContaCheck necesitará estos campos (ver brechas + contrato).

## NóminaCheck — nómina

| Evento (existente) | Disparador | Asiento | Montos |
|---|---|---|---|
| Nómina aprobada | `nomi_approve_payroll` (`nomi_payroll.status`) | Dr Sueldos y salarios · Cr Sueldos por pagar + Cr Retenciones (ISR/IMSS) | percepciones, `nomi_tax_withholdings` |
| Nómina pagada | `nomi_payroll.paid_at` | Dr Sueldos por pagar · Cr Bancos | neto pagado |
| Provisiones (IMSS patronal, etc.) | derivado de `nomi_tax_withholdings` | Dr Gasto patronal · Cr Provisiones/impuestos por pagar | cuotas patronales |

- Datos de empleado (RFC/NSS) **cifrados** → el asiento usa el **id de empleado**, nunca PII en claro
  (ver doc de seguridad).

## FlujoCheck — **NO contabilizable**
Proyección de tesorería; no representa hechos económicos consumados. Se excluye explícitamente como fuente.
(Al revés: FlujoCheck podría *leer* del libro de ContaCheck a futuro, no alimentarlo.)

## Cuadro de "estado que confirma" (resumen)
```
GastoCheck : expenses.authorized | invoice_applied | closed_in_policy ; reembolsos.closed ; accounts_payable.paid
BancoCheck : bank txn approved (VoBo) — clasificada a accounting_account_id
CobraCheck : cobra_invoices insert (devengo) ; cobra_payments insert (cobro)
NóminaCheck: nomi_payroll approved (provisión) ; nomi_payroll.paid_at (pago)
FlujoCheck : — (no aplica)
```
Estos son los **7 puntos de enganche** que los adaptadores del doc 7 deben observar.
