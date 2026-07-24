# ContaCheck · C2B — Rollback Report

> Ciclo **apply → verify → rollback → verify → reapply → verify** ejecutado sobre el DB local. Verde.

## Resultados medidos
| Fase | Tablas contab.* | Cols `accounting_vouchers` | `voucher_number` nullable | `accounting_can` |
|---|---|---|---|---|
| Antes de rollback (aplicado) | 26 | 41 | YES | existe |
| Después de rollback | **8** (solo pre-existentes) | **15** (original) | **NO** (NOT NULL restaurado) | **eliminada** |
| Después de reapply | 26 | 41 | YES | existe |

> Las **8 tablas** que quedan tras el rollback son las `accounting_*` **pre-existentes** (accounts, v2, entries,
> exports, account_imports, category_map, export_profiles, vouchers) — NO son de C2B. `accounting_vouchers`
> vuelve exactamente a sus **15 columnas originales**.

## Qué revierte `CONTACHECK_C2B_ROLLBACK.sql`
1. **Purga de datos de prueba** (con `session_replication_role=replica` para poder borrar líneas/pólizas posted
   de prueba). Solo borra pólizas creadas por ContaCheck (`idempotency_key`/`fiscal_year`/`reversal_of` no nulos).
2. **Drop de las 30 funciones `accounting_*`** (cascade elimina sus triggers en objetos existentes: inmutabilidad
   de vouchers, congelamiento de v2).
3. **Revertir `accounting_vouchers`**: drop de las 26 columnas nuevas, restaurar `voucher_number` NOT NULL +
   `UNIQUE` global, restaurar CHECKs originales de `status`/`voucher_type`, drop de índices nuevos.
4. **Revertir `accounting_accounts`**: drop de las 9 columnas nuevas + 2 constraints; quitar comentario deprecado.
5. **Drop de las 18 tablas C2B** en orden de dependencias.

## Reapply
Reaplicar los 16 bloques en orden restaura 26 tablas / 41 columnas **sin errores**, y la suite completa vuelve a
pasar **49/49** (25 SQL + 11 seguridad + 10 pilotos + 3 concurrencia).

## Objetos que NO se pueden revertir automáticamente
- **Ninguno crítico.** El rollback es completo para objetos C2B.
- **Requiere no tener datos contables reales:** el rollback purga datos de prueba; en un entorno con pólizas
  **reales** contabilizadas, el rollback **no** debe ejecutarse tal cual (la inmutabilidad impide borrar posted).
  Documentado como precondición: el rollback destructivo aplica solo mientras no haya contabilidad real (fase de
  pruebas / despliegue controlado temprano).

## No se tocó infraestructura histórica
El rollback no hace DROP de tablas/columnas pre-existentes; solo revierte lo creado en C2B y restaura las
constraints originales de `accounting_vouchers`/`accounting_accounts`.
