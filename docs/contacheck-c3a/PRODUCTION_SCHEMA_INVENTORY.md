# ContaCheck · C3A — Production Schema Inventory (§3, §4, §5)

> Evidencia obtenida vía PostgREST (existencia de tabla/columna y conteos). Detalle de tipos/constraints/índices:
> ejecutar `scripts/contacheck-c3a/03,04,05`.

## Tablas contables — existencia en prod (2026-07-24)
| Tabla | Prod | Filas |
|---|---|---|
| `accounting_accounts` (v1) | **existe** | **301** |
| `accounting_accounts_v2` | **existe** | **0** |
| `accounting_vouchers` | **existe** | **0** |
| `accounting_entries` | existe | 0 |
| `accounting_voucher_lines` (C2B) | **ausente** | — |
| `accounting_source_links` (C2B) | ausente | — |
| `accounting_periods` / `accounting_fiscal_years` (C2B) | ausente | — |
| `accounting_rules` (C2B) | ausente | — |
| `parties` / `party_links` / `company_tax_profiles` (C2B) | ausente | — |
| `accounting_feature_flags` (C2B) | ausente | — |
| **(18 tablas nuevas de C2B)** | **todas ausentes (404)** | — |

## §4 — accounting_vouchers (shape real en prod)
- **Columnas presentes:** `id, voucher_number, voucher_type, source_module, source_ids, total_debit,
  total_credit, currency, entries, exported_format, exported_at, exported_by, status, created_at` → **15
  columnas originales** (coincide con `20260705130000`). Probado por presencia (200) de cada una.
- **Columnas C2B: AUSENTES** (400): `accounting_date, party_id, idempotency_key, fiscal_period_id, posted_at,
  reversal_of_voucher_id` → confirma que C2B parte del shape original.
- **Volumen: 0 filas** → `voucher_number` NOT NULL / transición de unicidad / idempotencia = **triviales y sin
  riesgo de datos** (no hay folios que colisionen ni nulos que reparar).
- Pendiente de script (`04`): constraint de unicidad exacta, CHECK de status/type, triggers, RLS, grants.

## §5 — Catálogo contable
- **v1 `accounting_accounts`: 301 filas** (datos reales), con `level`/`parent_code` (200). **Sin** columnas
  fiscales de C2B (`nature`, `is_postable`, `account_type_norm`, `sat_grouping_code` → 400).
- **v2 `accounting_accounts_v2`: 0 filas** → **vacío en prod**. Implicaciones: el backfill de C2B (bloque 3) es
  **no-op**; v2 puede congelarse/deprecarse **sin migración de datos**; riesgo de "dos catálogos" es documental,
  no de datos.
- Pendiente de script (`05`): códigos duplicados por empresa, activas/inactivas, jerarquías huérfanas
  (`parent_code` inexistente), y **FK real de `expenses.accounting_account_id` (v1 vs v2)**.

## §6 — Dependencias por módulo (existencia en prod)
| Tabla | Prod |
|---|---|
| `expenses` | existe (18 filas); cols `id, company_id, status, accounting_account_id, accounting_account_code` presentes |
| `receipts` | existe |
| `bank_transactions` | existe (6 filas); **`accounting_account_id`, `linked_client_id`, `linked_supplier_id` PRESENTES** (aplicadas a mano; migración `20260721100000` no registrada) |
| `company_bank_accounts` | existe |
| `bank_reconciliations` | existe |
| `cobra_invoices` / `cobra_payments` | existen (10 / n) |
| **`cobra_collections` / `cobra_commissions`** | **ausentes (404)** — migración revertida `20260708000001` |
| `accounts_payable` | existe (0 filas) |
| `cfdi_provider_configs` / `cfdi_documents` | existen |
| `nomi_employees` / `nomi_payroll` | existen (0 / 0 filas) |
| `companies` / `company_members` / `profiles` / `audit_logs` / `cost_centers` | **existen** (deps core de C2B) |

**`expenses` (confirmación §6):** PK `id`, `company_id`, `status` presentes; `accounting_account_id` +
`accounting_account_code` presentes. FK exacta (v1/v2) y registros huérfanos: pendiente de `05`.

## Volúmenes (agregados)
6 empresas · 301 cuentas contables · 18 expenses · 6 bank_transactions · 10 cobra_invoices · **0 pólizas** · 0 v2
· 0 nómina. **Prod es de bajo volumen** → despliegue aditivo de bajo riesgo operativo.
