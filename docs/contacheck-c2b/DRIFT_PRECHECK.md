# ContaCheck · C2B — Drift Precheck

> Verificación del esquema real antes de escribir migraciones. Solo lectura sobre el stack local.

## 1. Entorno
- Stack local de Supabase **corriendo** (contenedor `supabase_db_gastocheck-app`, Postgres). Docker 29.3.1,
  Supabase CLI 2.109.0. Sin `psql` en PATH del host → se usó `docker exec … psql`.
- **`supabase_migrations.schema_migrations` NO existe** en el DB local → el esquema local **no** se construyó por
  replay del historial de migraciones; es un **esquema equivalente** ya materializado (coincide con la
  advertencia de `DRIFT_AUDIT_2026-07-22.md`: el historial no es reproducible de principio a fin).

## 2. Procedimiento controlado (§2)
Dado que el historial completo no es reproducible localmente, **no se intentó** un `supabase db reset`. Se probó
ContaCheck **sobre el esquema equivalente vivo**, que contiene los objetos reales que ContaCheck toca. Se
verificó objeto-por-objeto (abajo) que ese esquema coincide con la spec C2A antes de aplicar. Diferencia
documentada: las pruebas corren sobre el esquema equivalente, no sobre un replay limpio del historial.

## 3. Objetos verificados (esquema real vivo)

| Objeto | Estado real | Clasificación |
|---|---|---|
| `accounting_accounts` | `id,company_id,code,name,account_type,active,level,parent_code` (8 cols, v1) | EXPECTED |
| `accounting_accounts_v2` | presente, huérfano (semántica fiscal) | LEGACY |
| `accounting_vouchers` | 15 cols; `voucher_number` UNIQUE **global**; CHECK status(draft/exported/reconciled), type(INCOME/EXPENSE/TRANSFER); `check_balance(total_debit=total_credit)` | EXPECTED |
| tabla de líneas | **no existe** (líneas en `entries jsonb`) | EXPECTED (greenfield) |
| `parties`/`party_links`/`company_tax_profiles`/`accounting_periods`/`accounting_source_links`/`accounting_rules*` | **no existen** | EXPECTED (greenfield) |
| helpers `auth_is_member/auth_role/auth_can_view_all/auth_can_authorize` | presentes | EXPECTED (se reutilizan) |
| `nomi_can`/`nomi_blind_hash` | presentes | EXPECTED (patrón a reutilizar) |
| enum `member_role` | 13 valores incl. `accountant`, `contador_general` | EXPECTED |
| enum `expense_status` | 10 valores (`captured`…`closed_in_policy`) | EXPECTED |
| `audit_logs` | `entity_id` **NOT NULL** (helper de auditoría siempre pasa id real) | EXPECTED |
| `receipts` | tiene `retencion_iva/isr`, `ieps_amount`, `ish_amount`, `currency` | EXPECTED |
| `expenses` | `subtotal/iva/total`, `accounting_account_id`, `cost_center_id`, `receipt_id`, `cfdi_type` | EXPECTED |
| Consumidores INSERT de `accounting_vouchers` | 2 rutas app (BancoCheck web, FacturaCheck mobile) | EXPECTED |

## 4. Clasificación de diferencias
- **BLOCKING:** ninguna. El esquema real coincide con la spec C2A.
- **NON_BLOCKING:** `voucher_number` UNIQUE global (se corrige en la transición de numeración, bloque 7);
  `voucher_number` NOT NULL (se hace nullable para propuestas, bloque 7 — no rompe writers legacy que sí proveen folio).
- **LEGACY:** `accounting_accounts_v2` (congelado, no borrado); motor `generate_accounting_entries` (no reutilizado).
- **EXPECTED:** greenfield de todas las tablas nuevas; helpers/en“ums presentes.

## 5. Precondición para despliegue (prod)
Antes de aplicar en prod (fase posterior, fuera de C2B): verificar objetos reales en **producción** (no
`schema_migrations`): filas en `accounting_accounts_v2`; existencia de `cobra_collections`/`cobra_commissions`;
FK `expenses.accounting_account_id`→v1; esquema de `accounting_vouchers`. **No se aplicó nada en producción.**

## 6. Migraciones históricas
**No se modificó ninguna migración histórica.** Todos los cambios son archivos nuevos aditivos
(`20260724000001..16_contacheck_c2b_*`).
