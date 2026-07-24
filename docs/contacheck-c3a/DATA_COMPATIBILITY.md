# ContaCheck · C3A — Data Compatibility (§10)

> ¿Los datos reales de prod son compatibles con las nuevas constraints de C2B? Métricas agregadas, sin datos
> personales/fiscales/bancarios.

## Volúmenes reales (2026-07-24)
| Tabla | Filas | Riesgo para C2B |
|---|---|---|
| `accounting_accounts` (v1) | 301 | Bajo — solo se AGREGAN columnas NULL-ables |
| `accounting_accounts_v2` | **0** | **Nulo** — backfill no-op; deprecación sin migración de datos |
| `accounting_vouchers` | **0** | **Nulo** — nullable/idempotencia/unicidad sin filas que reparar |
| `accounting_entries` | 0 | Nulo |
| `expenses` | 18 | Bajo — no se altera `expenses`; adaptador es aditivo |
| `bank_transactions` | 6 | Bajo |
| `cobra_invoices` | 10 | N/A (CobraCheck no es parte de C2B) |
| `accounts_payable` | 0 | N/A |
| `nomi_*` | 0 | N/A |
| `companies` | 6 | Bajo |

## Compatibilidad con constraints nuevas de C2B
- **`voucher_number` → nullable + unicidad compuesta:** con **0 filas**, no hay nulos ni duplicados que violen
  nada. Trivial. (Verificar con `04`: `null_voucher_number`, `duplicate_voucher_numbers` = 0.)
- **`CHECK(total_debit=total_credit)`:** ya existe en prod (parte de `20260705130000`); 0 filas → sin violación.
- **CHECK ampliado de `status`/`voucher_type`:** solo **amplía** el dominio (aditivo); los valores existentes
  (draft/exported/reconciled, INCOME/EXPENSE/TRANSFER) siguen válidos. 0 filas de todas formas.
- **`accounting_accounts` +columnas:** todas NULL-able/default → 301 filas quedan válidas sin backfill.
- **Unicidad `(company_id, code)` en v1:** ya existente; verificar 0 duplicados con `05`.

## Registros incompletos / huérfanos
- **Pendiente de `05`:** cuentas con `parent_code` inexistente (jerarquía huérfana) y FK de
  `expenses.accounting_account_id`. Con 301 cuentas conviene confirmar 0 huérfanas antes de asumir jerarquía sana.
- `accounting_vouchers` 0 filas → sin `source_ids` huérfanos ni estados incompatibles.

## Veredicto de datos
**Compatibilidad de datos: PASS (bajo riesgo).** El punto históricamente más delicado (transición de
`voucher_number`) es **inocuo** porque prod tiene **0 pólizas**. Único WARNING: confirmar jerarquía/huérfanas y FK
del catálogo (301 cuentas) con el script `05`.
