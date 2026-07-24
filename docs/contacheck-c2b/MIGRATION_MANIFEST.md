# ContaCheck · C2B — Migration Manifest

> 16 migraciones aditivas + rollback. Todas aplican limpio sobre el esquema local equivalente. Cero DROP de
> infraestructura histórica. Archivos en `supabase/migrations/`.

| # | Archivo | Contenido | apply | rollback |
|---|---|---|---|---|
| 1 | `20260724000001_contacheck_c2b_01_capabilities.sql` | `accounting_capabilities` + `role`/`user` + `accounting_can()` + defaults (owner/contador_general/accountant/admin) | ✅ | ✅ |
| 2 | `..._02_periods.sql` | `accounting_fiscal_years`, `accounting_periods` + guard (sin solape/dentro del ejercicio) + RPC open/close/reopen + `accounting_log_audit()` | ✅ | ✅ |
| 3 | `..._03_accounts_ext.sql` | ALTER `accounting_accounts` (+`nature`,`account_type_norm`,`is_postable`,`sat_grouping_code`, defaults fiscales) + backfill v2 + congelamiento v2 (comment + trigger de aviso) | ✅ | ✅ |
| 4 | `..._04_parties.sql` | `parties`,`party_links` + dedup RFC + `accounting_upsert_party()`/`accounting_merge_party()` | ✅ | ✅ |
| 5 | `..._05_tax_profiles.sql` | `company_tax_profiles` (vigencias no solapadas) + `accounting_tax_profile_for_date()` | ✅ | ✅ |
| 6 | `..._06_vouchers_ext.sql` | ALTER `accounting_vouchers` (+26 cols encabezado) + widen CHECK status/type + trigger inmutabilidad posted | ✅ | ✅ |
| 7 | `..._07_numbering.sql` | `accounting_voucher_sequences` + `accounting_next_voucher_number()` + **transición unicidad** (voucher_number nullable; global→parcial legacy + compuesta por empresa/ejercicio/tipo) | ✅ | ✅ |
| 8 | `..._08_voucher_lines.sql` | `accounting_voucher_lines` (CHECK cargo XOR abono, no-negativo, línea única) + guard cuenta/inmutabilidad + trigger diferible de balance | ✅ | ✅ |
| 9 | `..._09_source_links.sql` | `accounting_source_links` + unicidad de origen (anti doble contabilización) | ✅ | ✅ |
| 10 | `..._10_idempotency.sql` | `accounting_idempotency_requests` + UNIQUE `(company_id, idempotency_key)` en vouchers + `accounting_payload_hash()` | ✅ | ✅ |
| 11 | `..._11_dimensions.sql` | `accounting_line_dimensions` (normalizada) + columnas calientes (`cost_center_id`,`party_id`) ya en líneas | ✅ | ✅ |
| 12 | `..._12_rules.sql` | `accounting_rules`/`_versions`/`_conditions`/`_outputs` + FK `rule_version_id` + `accounting_publish_rule()` + lock de versión publicada | ✅ | ✅ |
| 13 | `..._13_rpc_generate.sql` | `accounting_resolve_rules()`, `accounting_generate_voucher()` (idempotente), `accounting_validate_voucher()` | ✅ | ✅ |
| 14 | `..._14_rpc_post_reverse.sql` | `accounting_approve/post/reverse_voucher()`, `accounting_link_bank_transaction()`, `accounting_get_voucher_by_source()` | ✅ | ✅ |
| 15 | `..._15_rls_grants.sql` | RLS por empresa en 18 tablas nuevas + grants (SELECT authenticated, sin INSERT/UPDATE/DELETE directos, sin DELETE) | ✅ | ✅ |
| 16 | `..._16_compat_flags.sql` | `accounting_feature_flags` (default LEGACY) + `accounting_flag_mode()`/`accounting_set_flag()` | ✅ | ✅ |
| R | `CONTACHECK_C2B_ROLLBACK.sql` | revierte SOLO objetos C2B (purga datos de prueba, drop funciones/tablas, restaura columnas/constraints originales) | — | — |

## Resultado de aplicación (local, esquema equivalente)
- **18 tablas nuevas**, **30 funciones `accounting_*`**, **30 políticas RLS**. `accounting_vouchers`: 15→41 cols.
- Ciclo probado: **apply → verify → rollback → verify → reapply → verify**, todo verde (ver `ROLLBACK_REPORT.md`).

## Nota sobre la transición de unicidad de `voucher_number` (§9)
Es el **único** punto donde se toca una restricción existente: se **reemplaza** la `UNIQUE(voucher_number)`
global por (a) parcial legacy `where fiscal_year is null` (conserva la garantía de las filas actuales) + (b)
compuesta `(company_id, fiscal_year, voucher_type, voucher_number)` para filas nuevas. El rollback restaura la
unicidad global y `NOT NULL` originales. Documentado como transición sancionada por C2A/§9, no como DROP de infra.
