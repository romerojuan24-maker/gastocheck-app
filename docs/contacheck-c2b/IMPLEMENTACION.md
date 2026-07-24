# ContaCheck · C2B — Implementación

> Qué se implementó y verificó localmente. Sin producción, sin despliegue de Edge Functions, sin cambiar rutas
> funcionales, sin retirar legado, sin DROP.

## 1. Alcance entregado
Infraestructura mínima de ContaCheck implementada como **16 migraciones SQL aditivas** + rollback + suite de
pruebas, **aplicadas y verificadas** contra el stack local de Supabase (esquema equivalente; ver `DRIFT_PRECHECK.md`).

## 2. Componentes (todos aplicados)
- **Capacidades** (`accounting.*` × 11) + `accounting_can()` sobre `company_members` + overrides; defaults
  conservadores con **segregación** generate≠approve≠post.
- **Periodos** (`accounting_fiscal_years`/`accounting_periods`, estados open/soft_closed/closed/locked) + RPC
  open/close/reopen; guard anti-solape / dentro-del-ejercicio; sin DELETE.
- **Catálogo** ampliado (`accounting_accounts` +cols fiscales, `is_postable`, `sat_grouping_code`); v2 **congelado**
  (comment deprecado + trigger de aviso); backfill conservador desde v2; `is_deductible`/`requires_cfdi` como
  **defaults** (no absolutos).
- **Parties/party_links** (RFC hash+last4, dedup, fusión controlada) — no CRM, no copia operativa.
- **Perfil fiscal** (`company_tax_profiles`, vigencias no solapadas, snapshot para póliza; CSD no copiado).
- **Pólizas** (`accounting_vouchers` ampliada +26 cols) + **inmutabilidad** de `posted` (trigger).
- **Numeración** por `(empresa, ejercicio, tipo, secuencia)`, folio asignado al `posted`, concurrente.
- **Líneas** (`accounting_voucher_lines`, cargo XOR abono, balance por RPC + trigger diferible).
- **Orígenes** (`accounting_source_links`, multi-origen, unicidad de origen anti-doble-contabilización).
- **Idempotencia** (registro de solicitudes + UNIQUE por empresa + hash de payload).
- **Dimensiones** por línea (`accounting_line_dimensions` + calientes).
- **Motor de reglas** (draft→active, versiones inmutables, publicación validada, resolución con ambigüedad).
- **RPC** (`resolve/generate/validate/approve/post/reverse/link/get_by_source`) SECURITY DEFINER con
  `search_path` fijo, REVOKE public/anon, verificación de empresa+capacidad, auditoría.
- **Reversas** formales (póliza espejo, periodo abierto si el original está cerrado, original inmutable).
- **RLS** por empresa en las 18 tablas nuevas; escrituras solo por RPC; sin DELETE.
- **Compatibilidad** (feature flags `LEGACY`/`SHADOW`/`CONTACHECK`, default **LEGACY**).

## 3. Lo que NO se hizo (por instrucción)
- No se aplicó a producción. No se desplegaron Edge Functions.
- **No se cambiaron** las rutas funcionales de BancoCheck/FacturaCheck/GastoCheck (siguen en modo LEGACY;
  el INSERT legacy se verificó intacto).
- No se retiró legado (v2, `generate_accounting_entries`) — solo congelado.
- No se hizo DROP de tablas/columnas históricas ni cambio de FK (salvo la transición sancionada de unicidad de
  `voucher_number`, §9, reversible).
- No se inició integración completa de CobraCheck/NóminaCheck/Inventarios (fuera de alcance).

## 4. Cómo reproducir
```
# aplicar (sobre el DB local)
for f in supabase/migrations/20260724*_contacheck_c2b_*.sql; do docker exec -i supabase_db_gastocheck-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$f"; done
# probar
docker exec -i supabase_db_gastocheck-app psql -U postgres -d postgres < supabase/tests/contacheck_c2b/00_fixtures.sql
docker exec -i supabase_db_gastocheck-app psql -U postgres -d postgres < supabase/tests/contacheck_c2b/10_sql_tests.sql
# ... 20_rls_tests.sql, 30_pilots.sql (recargar fixtures entre archivos) ...
bash <scratch>/c2b_concurrency.sh
# rollback
docker exec -i supabase_db_gastocheck-app psql -U postgres -d postgres < supabase/migrations/CONTACHECK_C2B_ROLLBACK.sql
```

## 5. Resultado global de pruebas
**49 verificaciones verdes, 0 fallos** — 25 SQL + 11 seguridad/RLS + 10 pilotos + 3 concurrencia (2 conexiones).
Detalle en `TEST_RESULTS_*.md`. Ciclo rollback/reapply verde en `ROLLBACK_REPORT.md`.
