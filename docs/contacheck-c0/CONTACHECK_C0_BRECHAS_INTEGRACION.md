# ContaCheck · C0 — Brechas de Integración

> El delta entre lo que hay y lo que una contabilidad correcta exige. Cada brecha con severidad y evidencia.

Severidad: **B**=bloqueante para C1 · **A**=alta · **M**=media.

## Brechas de datos

| # | Brecha | Sev | Evidencia |
|---|---|---|---|
| D1 | **Sin party master** (terceros en 4 tablas: `suppliers`, `cobra_clients`, `cfdi_clients`, `fleet_clients`) | B | RFC+régimen requeridos por póliza; hoy hay que unir 4 tablas |
| D2 | **Catálogo duplicado** `accounting_accounts` vs `_v2`; `expenses` con 2 FK en conflicto | B | `20260615300000:11` vs `20260623000001:62` |
| D3 | **Sin `regimen_fiscal` en `companies`** | A | solo en `cfdi_clients.regimen_fiscal` |
| D4 | **Cuenta bancaria ambigua** (`bank_accounts` vs `company_bank_accounts`) | A | dos representaciones de "cuenta de la empresa" |
| D5 | **Retenciones inconsistentes**: existen en `receipts`, faltan en `expenses`/`cfdi_data`/`cobra_invoices` | A | `20260614000100` solo toca `receipts`; grep cobra sin retenciones |
| D6 | **Moneda inconsistente**: `receipts.currency` sí; `expenses` y `cobra_invoices` **asumen MXN** | A | sin `currency` en `expenses`/`cobra_invoices` |
| D7 | **Sin fecha contable** dedicada (solo fecha de operación) | A | ni `expenses` ni `receipts` ni `cobra_invoices` la tienen |
| D8 | **Sin nota de crédito en CxC** (solo `status='cancelled'` sin lógica) | A | grep `nota_credito|credit_note` cobra sin resultados |
| D9 | **Sin tipo de CFDI (I/E/P) ni forma/método SAT** en `cobra_invoices` | M | `method` solo en `cobra_payments` |
| D10 | **Modelo dual expenses/receipts no reconciliado** (captura en receipts, saldo en expenses) | M | `expenses.receipt_id` 1:1 opcional |

## Brechas de proceso / motor contable

| # | Brecha | Sev | Evidencia |
|---|---|---|---|
| P1 | **Contrapartida hardcodeada `'1010'`** en `generate_accounting_entries` | B | `20260623000001:209` |
| P2 | **No genera IVA/retenciones como líneas separadas** en el asiento | B | `generate_accounting_entries` asume debe=haber simple |
| P3 | **Sin generación automática** de póliza al confirmar evento (todo on-demand o inexistente) | B | reembolso deja asientos como TODO (`pendientes/route.ts:135-143`) |
| P4 | **`validate_cfdi_with_sat` simulada** (siempre "Vigente") | A | `20260623000001:144-150` |
| P5 | **Motor contable desconectado del UI y del export real** (asientos desde policies; export desde receipts) | A | dos caminos que no comparten datos |
| P6 | **Sin libro diario / journal general unificado** (asientos cuelgan de pólizas de gasto) | A | no existe tabla journal general |
| P7 | **Póliza BancoCheck no se persiste** en `accounting_vouchers` desde el flujo (solo se comparte texto) | M | `poliza-dia.tsx:176-178` |
| P8 | **Mapeo cuenta duplicado y hardcodeado** en web y mobile (`CATEGORY_ACCOUNT`) | M | `poliza.ts:140-152` y `poliza-dia.tsx:18-31` |
| P9 | **Sin contra-asiento de cancelación** (cancelar = excluir del SUM, no revertir) | M | GastoCheck y CobraCheck |

## Brechas por confirmar en producción (drift)
| # | Brecha | Sev | Evidencia |
|---|---|---|---|
| X1 | `cobra_collections`/`cobra_commissions` en migración **revertida** — ¿existen en prod? | B | `20260708000001:1-10` bloqueada |
| X2 | Columnas de `bank_transactions` de `20260708000000` nunca aplicaron | A | `20260721100000:6-9` |
| X3 | `viaticos` con migraciones no-op vs create contradictorias | M | `20260616900000` vs `20260629030003` |
| X4 | `schema_migrations` no es fuente de verdad; verificar objetos reales | B | `DRIFT_AUDIT_2026-07-22.md` |

## Bugs colaterales detectados (no ContaCheck, pero afectan datos de origen)
- `api/gastocheck/dashboard/route.ts:42-46,85` filtra por enum inexistente `'approved'/'draft'/'submitted'`
  → montos aprobados/pendientes siempre **0**.
- `api/gastocheck/pendientes/route.ts:70` consulta `.from('auth.users')` vía PostgREST → emails "unknown".
- `api/flujocheck/dashboard/route.ts` (web) apunta a tablas inexistentes (`company_payable`, `tax_obligations`,
  `invoices`, `clients`) — la versión mobile ya se corrigió.

*(Estos se registran como hallazgo; su corrección es decisión aparte, no parte de C0.)*

## Priorización de cierre de brechas antes de C1
1. **Bloqueantes de datos:** D1 (party master), D2 (catálogo único), + confirmar X1/X4 en prod.
2. **Bloqueantes de motor:** P1–P3 (contrapartida configurable, IVA/retención como líneas, disparo por evento).
3. **Altas de datos:** D3–D7 (régimen, cuenta bancaria, retenciones, moneda, fecha contable).
