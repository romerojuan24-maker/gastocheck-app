# ContaCheck · C1.1 — BancoCheck: Piloto Técnico

> BancoCheck valida la infraestructura (contrato, persistencia, conciliación, idempotencia, reversa) sin
> convertirse en la fuente universal de pólizas. Ref. §5.

## 1. Por qué BancoCheck es el piloto técnico
Es el único módulo que **ya persiste** una póliza en `accounting_vouchers` (BancoCheck web,
`bancocheck/conciliacion/page.tsx:187`) y ya tiene **VoBo del contador**
(`bancocheck_approve_suggestion`, `20260712050000:37-66`). Trae la **contrapartida bancaria real**, base de la
conciliación con los demás módulos.

## 2. Rol de BancoCheck: conciliar, no originar
BancoCheck NO debe ser el origen contable de gastos/cobros/nómina. Su función es:
- Registrar el **lado banco** de un hecho ya reconocido por otro módulo.
- **Conciliar** el asiento del módulo con el movimiento bancario real, evitando doble contabilización.

## 3. Movimientos y su tratamiento

| Caso | Fuente/estado (evidencia) | Tratamiento contable |
|---|---|---|
| Movimiento clasificado+aprobado | `bancocheck_approve_suggestion` (`20260712050000:37-66`), cuenta `bank_transactions.accounting_account_id`→v1 (`20260721100000:15`) | póliza de conciliación DR/CR Bancos vs cuenta clasificada |
| Pago de GastoCheck | `bank_transactions.related_receipt_id → receipts` (`20260618300000:35`) | **conciliar**, no re-contabilizar: liga el pago de `accounts_payable` con el movimiento |
| Cobro de CobraCheck | `related_invoice_id` (uuid, sin FK, `20260618300000:36`) | conciliar con `cobra_payments` |
| Pago de NóminaCheck | `nomi_payroll.paid_via_bank_transaction_id` (`20260722210000:115`) | conciliar el pago de nómina |
| Comisión bancaria | categoría `bank_fee`, split IVA (`poliza.ts:224-238`) | reconocimiento directo (origen banco) |
| Interés / impuesto | categoría `tax`→2200 (`poliza.ts:146`) | reconocimiento directo |
| Movimiento directo (sin contraparte) | categoría clasificada | reconocimiento directo |
| Transferencia interna | `linked_transaction_id`/`internal_transfer` (`20260712040000:11`) | DR Bancos B / CR Bancos A, sin resultado |
| No identificado | `status='unidentified'` | queda `pending_configuration` hasta clasificar |

## 4. Relación propuesta (§5)
```
operación del módulo (gasto/cobro/nómina)
   → póliza de reconocimiento (accounting_vouchers, source_module = módulo)
bank_transactions (movimiento real, aprobado por contador)
   → póliza de conciliación / o marca de conciliado
accounting_source_links (NUEVO):
   voucher_id ── bank_transaction_id ── source_module ── source_entity ── source_id ── link_type(origen|conciliacion)
```
- **`accounting_source_links` no existe** hoy (greenfield, confirmado); reemplaza la mezcla actual de
  `source_ids UUID[]` (`accounting_vouchers:74`) + FKs tipadas de `bank_transactions`
  (`related_receipt_id`/`related_invoice_id`/`related_advance_id`, `20260618300000:35-37`).
- El puente `bank_accounts`↔`company_bank_accounts` (C1 ADR-007) permite ligar el lado fiscal (`receipts`) con
  el operativo (movimientos).

## 5. Evitar doble contabilización
- **Idempotencia** por `idempotency_key` (ver `IDEMPOTENCIA_Y_REVERSAS.md`): un pago reconocido por GastoCheck
  y luego "visto" por BancoCheck **no** genera segunda póliza; BancoCheck solo **concilia** (marca el vínculo).
- Regla: si existe una póliza `source_module≠'bancocheck'` ligada al mismo hecho, BancoCheck **no origina**;
  crea `accounting_source_links(link_type='conciliacion')`.
- Hoy el dedupe es artesanal (`.contains('source_ids', …)` en `useFacturaCheck.ts:381` y
  `conciliacion/page.tsx:191-192`) → se formaliza con la llave de idempotencia.

## 6. Qué valida el piloto técnico (criterios de salida)
1. Contrato normalizado produce `entries` balanceadas (`CHECK total_debit=total_credit` ya existe,
   `20260705130000:89`).
2. Persistencia `proposed`→`posted` con inmutabilidad.
3. Conciliación con `accounting_source_links` sin doble póliza.
4. VoBo del contador respetado (reusar rol/gate de `bancocheck_approve_suggestion`).
5. Reversa por contra-asiento.
6. Idempotencia ante reintentos/doble clic.

## 7. Corrección a arrastrar del código actual
La póliza persistida hoy usa cuentas **hardcodeadas** (`poliza.ts:140-156`) y numeración `BC-…Date.now()`
(`poliza.ts:186`). El piloto debe: (a) tomar cuentas del motor de reglas, (b) numerar por empresa/período
(el `voucher_number UNIQUE` actual es **global**, `20260705130000:70` — riesgo multi-tenant).
