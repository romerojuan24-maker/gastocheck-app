# ContaCheck C3A — Scripts de inspección de producción (SOLO LECTURA)

> Todos son **read-only, idempotentes, sin DDL, sin DML, sin cambios de sesión/seguridad**. Seguros para
> ejecutar en producción. Ninguno expone datos personales/fiscales/bancarios (solo estructura y métricas
> agregadas; los pocos valores se enmascaran).

## Cómo ejecutarlos (sesión con rol de solo lectura sobre prod)
Ejecutar en el SQL Editor de Supabase (prod) o vía `psql "<cadena-solo-lectura>"`. **No** requieren superusuario;
un rol con `SELECT` sobre `information_schema`/`pg_catalog` basta. No modifican nada.

| Script | Cubre (gate §) |
|---|---|
| `01_environment.sql` | §1 identificación de entorno |
| `02_migration_state.sql` | §2 estado de migraciones + drift de ledger |
| `03_schema_inventory.sql` | §3 columnas/tipos/defaults/nulabilidad de tablas contables |
| `04_accounting_vouchers_deep.sql` | §4 constraints, índices, triggers, RLS, grants, volumen, nulos |
| `05_catalog_check.sql` | §5 v1/v2 filas, duplicados, jerarquías huérfanas, cuentas por empresa |
| `06_functions_triggers.sql` | §7/§8 funciones (firma/definer/search_path/EXECUTE) y triggers |
| `07_rls_security.sql` | §9 RLS habilitado, políticas USING/WITH CHECK, grants, owners |
| `08_data_volume.sql` | §10 filas/tamaños/fechas por tabla afectada |
| `09_migration_simulation.sql` | §14 colisiones de nombres, constraints incompatibles |

## Qué ya se verificó vía PostgREST (read-only) y qué requiere estos scripts
Lo verificado sin estos scripts (existencia de tablas/columnas y volúmenes) está en
`docs/contacheck-c3a/PRODUCTION_SCHEMA_INVENTORY.md`. Estos scripts completan lo que la API REST **no** puede ver:
constraints exactos, FK (v1 vs v2), triggers, definiciones/`search_path` de funciones, políticas RLS internas e
índices. Ejecútalos y pega su salida en los documentos correspondientes antes de emitir GO definitivo.
