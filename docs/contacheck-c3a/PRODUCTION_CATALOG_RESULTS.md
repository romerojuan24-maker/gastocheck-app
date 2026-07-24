# ContaCheck · C3A.2 — Resultados de catálogo de producción (scripts 05/06/07) (§2)

> **Estado: PENDIENTE de ejecución.** Ni fabricados ni parcialmente inventados.

## Por qué siguen pendientes
Los scripts `05/06/07` consultan `pg_catalog`/`information_schema`, no accesibles por PostgREST. Las dos vías
para ejecutarlos:
1. **SQL Editor de Juan** (sesión autenticada, logueada) — **preferida**.
2. Una conexión directa con rol de solo lectura.

**No los ejecuté** porque:
- La única credencial directa disponible sería la de `postgres` (superusuario) vía pooler, que **bypassa RLS** y
  **no es de solo lectura** — contrario al gate y a mis reglas.
- El **DB local (Docker) está caído** (engine no responde), así que tampoco pude correrlos localmente para validar
  su salida sobre el baseline.

## Cómo completarlo (Juan, sesión de solo lectura; sin DDL/DML/cambios de seguridad)
Pegar en el SQL Editor de prod y capturar la salida:
```
scripts/contacheck-c3a/05_catalog_check.sql        -- catálogo, duplicados, huérfanas, FK expenses
scripts/contacheck-c3a/06_functions_triggers.sql   -- funciones (definer/search_path/grants), colisiones, triggers
scripts/contacheck-c3a/07_rls_security.sql         -- RLS, políticas USING/WITH CHECK, grants, owners
```

## Plantilla de captura (a llenar con la salida real)
### 2.1 Constraints y FK
- [ ] FK de `expenses.accounting_account_id` → **____** (esperado: v1 `accounting_accounts`).
- [ ] FK de `bank_transactions.*` (accounting_account_id/linked_client_id/linked_supplier_id) → existen: **____**.
- [ ] FK de `accounting_vouchers` (company_id, exported_by) → **____**.
- [ ] Constraints únicas / de estado / multiempresa relevantes → **____**.
- [ ] Conflicto con C2B: **____** (esperado: ninguno).

### 2.2 Funciones (recordatorio: **404 de PostgREST NO implica ausencia**)
- [ ] Colisión `accounting_*` de C2B → **0** esperado.
- [ ] Inventario definer/`search_path`/grants de funciones existentes (`generate_accounting_entries`,
      `export_policy_*`, `validate_cfdi_with_sat`, `nomi_*`) → **____**.

### 2.3 Triggers
- [ ] Triggers en `accounting_vouchers`/`accounting_accounts(_v2)`/`expenses`/`bank_transactions` → **____**
      (descartar guard de inmutabilidad inesperado).

### 2.4 RLS
- [ ] RLS/FORCE por tabla; políticas más permisivas que lo probado / duplicadas → **____**.

### 2.5 Owners y grants
- [ ] Owners de tablas/funciones; privilegios de `anon`/`authenticated`/`service_role`; acceso a secuencias → **____**.

## Impacto en el veredicto
Hasta pegar estos resultados con **PASS**, los controles de constraints/funciones/triggers/RLS/grants siguen
**sin verificar**. Es una de las condiciones **no cumplidas** del §9 → contribuye al **NO-GO** actual.
