# ContaCheck · C3A.1 — Auditoría de funciones SECURITY DEFINER (§3)

> Revisión de las funciones que C2B crea con `SECURITY DEFINER`. Verificado sobre los archivos de migración
> (fuente) y confirmado en el DB local durante C2B (49/49). **No se modificó producción.**

## Criterios y resultado global
Las **21 funciones `SECURITY DEFINER`** de C2B cumplen:

| Criterio | Resultado | Evidencia |
|---|---|---|
| `search_path` explícito y seguro (`= pg_catalog, public`) | **PASS (21/21)** | grep de definiciones: cada `security definer` lleva `set search_path` inline (filtro "sin search_path" = vacío) |
| Nombres de objeto calificados con esquema (`public.…`) | **PASS** | las RPC referencian `public.accounting_*`, `public.company_members`, etc. |
| Valida `company_id` | **PASS** | todas reciben `p_company` y verifican vía `accounting_can(p_company, …)` |
| Valida identidad de usuario | **PASS** | usan `auth.uid()`; membresía/rol vía `accounting_can` (que lee `company_members`) |
| Verifica membresía/rol cuando corresponde | **PASS** | `accounting_can` exige `company_members.status='active'` + capacidad |
| Evita SQL dinámico inseguro | **PASS** | sin `EXECUTE` de strings concatenados con input; el único `format()` (bloque 15) usa `%I` (identificador citado) en una migración, no en runtime |
| Limita grants EXECUTE | **PASS** | `REVOKE EXECUTE … FROM public, anon` + `GRANT … TO authenticated, service_role` en cada RPC |
| No confía solo en parámetros del cliente | **PASS** | la autorización se resuelve server-side (`accounting_can`, período, versión, segregación), no por flags del cliente |

## Clasificación por función (todas PASS)
`accounting_can`, `accounting_log_audit`, `accounting_open_fiscal_year`, `accounting_close_period`,
`accounting_reopen_period`, `accounting_period_for_date`, `accounting_upsert_party`, `accounting_merge_party`,
`accounting_tax_profile_for_date`, `accounting_next_voucher_number`, `accounting_publish_rule`,
`accounting_resolve_rules`, `accounting_generate_voucher`, `accounting_validate_voucher`,
`accounting_approve_voucher`, `accounting_post_voucher`, `accounting_reverse_voucher`,
`accounting_link_bank_transaction`, `accounting_get_voucher_by_source`, `accounting_flag_mode`,
`accounting_set_flag` → **PASS**.

Funciones **trigger** (no SECURITY DEFINER; corren como invoker en contexto de trigger) también fijan
`set search_path = pg_catalog, public`: `accounting_period_guard`, `company_tax_profile_guard`,
`accounting_voucher_immutable_guard`, `accounting_line_account_guard`, `accounting_line_delete_guard`,
`accounting_lines_balance_check`, `accounting_rule_version_locked_guard`, `accounting_v2_freeze_notice`,
`accounting_norm_rfc`, `accounting_payload_hash` → **PASS**.

## Veredicto
**Ninguna función C2B es REQUIERE AJUSTE ni BLOQUEANTE.** No se modificó ninguna migración → la suite local se
mantiene en **49/49 PASS** (sin re-ejecución necesaria; no hubo cambios).

## Comparación con lo existente en prod (pendiente `06`)
El único riesgo residual es que **prod tenga funciones homónimas** con `search_path` laxo o grants a `public` que
colisionen. La probabilidad es baja (no había funciones con prefijo `accounting_` antes de C2B), pero **debe
confirmarse** con `scripts/contacheck-c3a/06` (sección de colisión + inventario de definer/search_path/grants).
