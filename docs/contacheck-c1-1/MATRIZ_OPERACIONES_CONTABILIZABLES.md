# ContaCheck · C1.1 — Matriz de Operaciones Contabilizables

> Por módulo: evento operativo real, estado que lo confirma (con `archivo:línea`), disparador contable
> propuesto, tipo de póliza y reversa. Operaciones que el producto aún no tiene → marcadas **FUTURA**.

Tipos de asiento: reconocimiento · provisión · pago · cobro · cancelación · reversa · ajuste · conciliación ·
reclasificación.

## GastoCheck (egresos)
| Evento | Estado actual (file:line) | Disparador contable | Póliza | Reversa |
|---|---|---|---|---|
| Gasto capturado | `captured` (`status.ts:22`, `init.sql:20`) | ninguno (no contabiliza) | — | — |
| Gasto autorizado | `authorized` (`status.ts:23`; `authorize-expense/index.ts:70-73`) | **reconocimiento** | DR Gasto + DR IVA acred. / CR Proveedor o Bancos | reversa si se rechaza |
| CFDI aplicado | `invoice_applied` (`status.ts:27`) | reclasificación sin_cfdi→con_cfdi | ajuste IVA formal | — |
| CxP registrada | `accounts_payable.status='pending'` (`20260624000001:18`, **sin FK a expenses**) | **provisión** CxP | DR Gasto / CR Proveedores | `cancelled` (`:19`) |
| Pago a proveedor | `accounts_payable.status='paid'` + `payment_date` (`20260624000001:18-21`) | **pago** | DR Proveedores / CR Bancos | reversa de pago (FUTURA) |
| Anticipo entregado | insert `advances` (sin `status`; trigger saldo `init.sql:266-272`) | pago (anticipo a comprobar) | DR Anticipos / CR Bancos | — |
| Comprobación / cierre | `closed_in_policy` (`status.ts:29`; `close-policy/index.ts:96-100`) | **aplicación de anticipo** / cierre | salda anticipo vs gasto | — |
| Reembolso cerrado | `reembolsos.status='closed'` (`20260617200000:10`; **gap:** la Edge no produce `closed`) | provisión CxP empleado | DR Gastos / CR Por pagar empleado | `rejected` |
| Cancelación de gasto | `rejected`/`deleted`/`duplicate` (`status.ts:24,28,30`) | **cancelación** (hoy solo excluye del SUM) | contra-asiento (FUTURA) | — |

## BancoCheck (bancos)
| Evento | Estado actual (file:line) | Disparador contable | Póliza | Reversa |
|---|---|---|---|---|
| Movimiento importado | `bank_transactions` insert (`20260618300000:19`) | ninguno hasta clasificar | — | — |
| Movimiento clasificado+aprobado | `bancocheck_approve_suggestion` VoBo (`20260712050000:37-66`) | **conciliación**/reconocimiento | DR/CR Bancos vs cuenta clasificada | — |
| Comisión bancaria | categoría `bank_fee` (`poliza.ts:224`) | provisión gasto financiero | DR Gasto fin. + DR IVA / CR Bancos | — |
| Transferencia interna | `linked_transaction_id`/`internal_transfer` (`20260712040000:11`) | reclasificación (sin resultado) | DR Bancos B / CR Bancos A | — |
| Impuesto bancario | categoría `tax` → cuenta 2200 (`poliza.ts:146`) | provisión | DR Impuestos / CR Bancos | — |

## CobraCheck (CxC)
| Evento | Estado actual (file:line) | Disparador contable | Póliza | Reversa |
|---|---|---|---|---|
| Factura emitida | `cobra_invoices.status='pending'` (`20260618210000:60`) | **reconocimiento** (devengo CxC) | DR Clientes / CR Ingresos + IVA trasladado | `cancelled` |
| Factura vencida | `overdue` + `days_overdue` (`20260618210000:61-66`) | provisión cartera (informativo) | opc. DR Estimación incobrables | — |
| Pago total | `paid` por trigger `update_invoice_status` (`20260618210000:199-218`) | **cobro** | DR Bancos / CR Clientes | **gap** (DELETE sin recalc) |
| Pago parcial | `partial` (`20260618210000:206-207`) | cobro parcial | DR Bancos / CR Clientes | idem |
| Cobro de campo | `cobra_movements='collected'` → `create_payment_from_movement` (`20260623000000:122-141`) | cobro (efectivo) | DR Caja / CR Clientes | **gap** |
| Recepción/depósito/conciliación | `cobra_collections` registered/deposited/reconciled (`route.ts:151,200-201`) | cobro/traspaso/conciliación | DR Bancos / CR Caja tránsito | `disputed` |
| Comisión cobrador | `cobra_commissions.status` pending→paid (`20260708000001:77` **migración revertida**) | provisión→pago | DR Gasto comisiones / CR Por pagar | `cancelled` |
| Nota de crédito | — | **FUTURA** (no existe columna/tabla) | DR Ingresos / CR Clientes | — |

## NóminaCheck (nómina) — la más fuerte para contabilidad
| Evento | Estado actual (file:line) | Disparador contable | Póliza | Reversa |
|---|---|---|---|---|
| Nómina calculada | `nomi_payroll.status='draft'` (`20260722210000:109`) | ninguno (borrador) | — | editar en draft |
| Nómina aprobada | `approved` vía `nomi_approve_payroll` (`:621-644`; guard `:525-542`) | **provisión** (devengo) | DR Sueldos / CR Sueldos por pagar + CR ISR + CR IMSS | cancelación |
| Retención ISR/IMSS/INFONAVIT | `nomi_tax_withholdings` (`:129`, `account_code` `:133`) | provisión pasivo fiscal | CR Impuestos/aportaciones por pagar | ligada a nómina |
| Nómina pagada | `paid` + `paid_at` + `paid_via_bank_transaction_id` (`:114-115`) | **pago** | DR Por pagar / CR Bancos | — |
| Nómina cancelada | `cancelled` (`:109`) | **cancelación/reversa** | contra-asiento del devengo | es el estado de reversa |
| Cuentas sugeridas | `suggested_account_debit/credit` (`:107-108`) | input al asiento | — | — |

## FlujoCheck — **NO contabilizable** (proyección; lee de los demás, incl. `nomi_cashflow_commitments` `:699`).

## Inventarios / Compras / Ventas / Activos
| Evento | Estado actual | Disparador contable | Nota |
|---|---|---|---|
| Entrada/salida/ajuste/merma | `inventory_movements.movement_type` (`20260618300003:30`; `reason` `20260712080000:37`) | **FUTURA** | esquema vivo sin COGS/cuenta |
| Costo de ventas (COGS) | solo en esquema `inv_*` **descartado** (`inv_valuations.cost_of_goods_sold` `20260708000003:138`) | **FUTURA** | requiere lógica de valuación nueva |
| Compras / Ventas / Activos fijos / depreciación | — | **FUTURA** | módulos inexistentes |

## Lectura transversal
Eventos **contabilizables hoy con estado confirmatorio real:** GastoCheck (authorized/paid/closed),
BancoCheck (approve_suggestion), CobraCheck (invoice/payment), NóminaCheck (approved/paid). Todo Inventarios/
Compras/Ventas/Activos es **FUTURA**. Los estados contables (`accounting_ready`/`voucher_generated`/`posted`)
**no existen** en ningún módulo y los aporta ContaCheck.
