# ContaCheck · C1 — Auditoría del Motor de Pólizas

> Análisis de `apps/web/lib/poliza.ts`, del motor SQL (`generate_accounting_entries` y export), y de
> `accounting_vouchers` como destino. Ref. ADR-004, ADR-005.

## 1. `apps/web/lib/poliza.ts` — librería TS pura de cliente (NO es "el motor de BancoCheck")

**Naturaleza:** funciones puras sin acceso a BD, sin persistencia, sin transacción, sin idempotencia, sin
auditoría. Cabecera "Generación de pólizas contables para CobraCheck" (`apps/web/lib/poliza.ts:1`).

| Entrada | Salida | Reglas |
|---|---|---|
| `generatePolizaFromPayment(payment, company, userEmail)` (`:43`) | `Poliza` (líneas debe/haber) | Cobro→Banco/Clientes/Comisión |
| `generatePolizaFromBankMatches(transactions, company, userEmail)` (`:177`) | `Poliza` de conciliación | 2 líneas por movimiento; IVA split en `bank_fee` |
| `validatePoliza(poliza)` (`:109`) | `{valid, error}` | valida `debe=haber` (tol. 0.01) |

**Cuentas:** contrapartida por diccionario `CATEGORY_ACCOUNT` **hardcodeado** (`:140-152`), `BANK_ACCOUNT_CODE='1010'`
(`:154`), `IVA_ACREDITABLE_CODE='1180'`, `IVA_RATE=0.16` (`:155-156`). `splitBankFeeIVA` separa neto+IVA
acreditable (`:164-168`).

**Validación cargo-abono:** presente pero **solo `console.error`** si desbalancea (`:95-101`, `:254-256`) —
no bloquea. `validatePoliza` sí retorna inválido (`:113-118`) pero es opt-in.

**Acoplamiento a BancoCheck:** `ReconciledBankTransaction` (`:129-138`) y `generatePolizaFromBankMatches`
(`:177`) son específicos de BancoCheck (categorías `internal_transfer`, `bank_fee`). `generatePolizaFromPayment`
es de CobraCheck.

**Defectos (evidencia):**
- **Signo invertido:** un pago de cliente (dinero que ENTRA) se marca `tipo:'EGRESO'` (`:52`) con Banco al
  **HABER** (`:62-68`, comentario "dinero sale"). Un cobro debería ser INGRESO con Banco al DEBE. Bug real.
- **Mapeo de cuentas duplicado** con el móvil (`apps/mobile/app/bancocheck/poliza-dia.tsx`), riesgo de divergencia.
- **No persiste:** no escribe en `accounting_vouchers` ni en ninguna tabla — solo arma un objeto para
  compartir/exportar como texto.

**Clasificación de piezas:** ver tabla en ADR-004.

## 2. Motor SQL de asientos — roto y sin caller

`generate_accounting_entries(policy_id, company_id)` (`20260623000001_gastocheck_contabilidad_integration.sql:157-221`):
- Recorre `expenses` con `status IN ('authorized','invoice_applied','closed_in_policy')` (`:182`).
- **`LEFT JOIN accounting_accounts_v2 aa ON e.accounting_account_id = aa.id`** (`:180`) — pero
  `expenses.accounting_account_id` contiene ids de **v1** (FK viva `20260615300000:11`) → el JOIN da NULL →
  `INSERT ... account_id` NULL viola NOT NULL (`:79`). **No puede completar.**
- Contrapartida: subquery `SELECT id FROM accounting_accounts_v2 WHERE account_type='activo' AND code='1010'`
  (`:209`) — hardcodeada y dependiente de que v2 tenga un `1010`.
- **No separa IVA/retenciones** en líneas.
- Sin caller en `apps/` ni `functions/` (grep = 0).

`export_policy_contpaqui` (`:224-263`) y `export_policy_json` (`:266-296`): leen `accounting_entries`
(alimentada por la función rota) → efectivamente inertes. `validate_cfdi_with_sat` (`:112-154`): **simulada**,
siempre `Vigente`/`valid` (`:147-150`).

## 3. `accounting_vouchers` — destino definitivo (ampliar, no reemplazar)

Definición `20260705130000_bancocheck_reconciliation_tables.sql:66-90`.

**Ya tiene:** `company_id` (`:68`), `voucher_number UNIQUE` (`:70`), `voucher_type` CHECK INCOME/EXPENSE/TRANSFER
(`:71`), `source_module` (`:73`), `source_ids UUID[]` (`:74`), `total_debit/credit` (`:76-77`), `currency`
(`:78`), `entries JSONB NOT NULL` (`:80`), `exported_format/at/by` (`:82-84`), `status` CHECK
draft/exported/reconciled (`:86`), `CHECK (total_debit=total_credit)` (`:89`). RLS: SELECT miembro (`:129`),
INSERT accountant/admin/owner/superadmin (`:133-139`); **sin UPDATE/DELETE policy** → inmutable de facto.

**Le falta (respuestas §6 del prompt):**
1. ¿Puede ser la tabla definitiva? **Sí.**
2. Falta: `accounting_date`/período, `party_id`, VoBo/`approved_by`, estado `proposed|posted|cancelled`,
   `reverses_voucher_id`, referencia documental, líneas normalizadas con FK a v1.
3. Campos que mezclan conceptos: `source_module`+`source_ids` (trazabilidad) conviven con `entries`
   (contenido) — aceptable.
4. Cambios compatibles: todos los anteriores como **columnas nuevas NULL-ables** / CHECK ampliado / tabla
   de líneas separada.
5. Cambios destructivos: cambiar tipo de `entries`, endurecer `voucher_number` a por-empresa, tocar el CHECK
   de balance → evitar; usar columnas nuevas.
6. ¿Ampliable sin reemplazar? **Sí.**
7. Propuesta vs contabilizada: `status='proposed'` → `'posted'`.
8. Impedir editar contabilizada: sin policy UPDATE (ya) + trigger que rechace cambios con `status='posted'`.
9. Reversa: póliza espejo nueva con `reverses_voucher_id`.
10. Múltiples orígenes: `source_ids UUID[]` ya lo soporta (`:74`).

**Persistencia hoy:** ningún flujo escribe `accounting_vouchers` desde `poliza.ts` (la póliza de BancoCheck
se comparte como texto, `apps/mobile/app/bancocheck/poliza-dia.tsx`). Cerrar esta brecha (P7 de C0) es parte
del piloto (ADR-010).
