# ContaCheck · C3A — Resumen Ejecutivo (Gate de producción)

> Verificación **estrictamente solo lectura** de producción (checksuite, `omhycwfjxynkfwywzwvz`), 2026-07-24.
> No se desplegó nada, no se modificaron datos/objetos/RLS/permisos/flags. No se expusieron secretos.

## 1. Qué encontré realmente en producción
- **Bajo volumen**: 6 empresas, 301 cuentas contables (v1), 18 expenses, 6 bank_transactions, 10 cobra_invoices,
  **0 pólizas** (`accounting_vouchers` vacío), **0 filas en `accounting_accounts_v2`**, 0 nómina.
- **Baseline contable que C2B necesita: presente y sano** — `accounting_accounts` v1 (con `level/parent_code`),
  `accounting_vouchers` con sus **15 columnas originales**, deps core (`companies`, `company_members`,
  `profiles`, `audit_logs`, `cost_centers`).
- **Las 18 tablas nuevas de C2B: ausentes** (sin colisión).
- **`bank_transactions` ya tiene la clasificación contable** (`accounting_account_id`, `linked_client_id/supplier_id`)
  — aplicada **a mano**, con su migración **no registrada**.
- **`cobra_collections`/`cobra_commissions`: ausentes** (migración revertida).

## 2. Diferencias respecto a local
- **El ledger de migraciones NO es fuente de verdad**: ~13 migraciones locales figuran **no aplicadas** en prod,
  pero algunos de sus objetos **sí existen** (aplicados a mano) — p.ej. la clasificación de `bank_transactions`.
- Local no tiene `schema_migrations` (esquema equivalente); prod sí, pero desactualizado.
- **Favorable:** el esquema real de prod que C2B toca **coincide** con el baseline local validado.

## 3. Bloqueadores
- **De contenido de migración: ninguno.** Todas las 16 migraciones C2B son SEGURA/CONDICIONADA sobre prod (0
  rewrites; ADD COLUMN metadata-only; 0 filas donde importa).
- **De método (alto): `supabase db push` arrastraría ~13 migraciones no registradas** (incluida una cuyas columnas
  ya existen → fallaría). C2B **debe** aplicarse **solo con sus 16 archivos, en aislamiento**.

## 4. Riesgos
- **Alto (método):** despliegue no aislado (db push) → drift/errores. Mitigación: aplicación aislada.
- **Medio (no verificado en read-only):** colisión de funciones `accounting_*`, constraints/FK finos, triggers y
  políticas RLS de prod más permisivas de lo probado. Mitigación: ejecutar scripts `05/06/07`.
- **Alto (operativo):** recuperación **no confirmada** (backup diario existe; PITR/último restore sin verificar).
  Mitigación: backup manual + confirmar PITR antes de aplicar.
- **Bajo:** tipos TS quedarán incompletos tras agregar columnas (no rompen; regenerar).

## 5. Acciones necesarias antes del despliegue (C3B)
1. Ejecutar `scripts/contacheck-c3a/05, 06, 07` en una sesión de solo lectura sobre prod y confirmar: catálogo sin
   duplicados/huérfanas, FK de `expenses` (v1), **0 colisiones de función**, triggers/RLS sin sorpresas.
2. **Backup manual reciente** + confirmar PITR/restaurabilidad (dashboard).
3. Preparar la aplicación **aislada** de los 16 archivos C2B (no `db push`).
4. (No bloqueante) plan de regeneración de tipos TS post-deploy.

## 6. Orden exacto recomendado para C3B
1. Prechecks `05/06/07` PASS + backup confirmado.
2. Ventana corta de mantenimiento.
3. Aplicar los 16 bloques C2B **aislados**, en orden (capacidades → … → compat_flags).
4. Verificación post: `03` (18 tablas + 41 cols), flags = LEGACY en las 6 empresas, humo de RPC.
5. Regenerar tipos TS.
6. (Después) activación gradual por empresa: SHADOW (BancoCheck) → CONTACHECK. Nunca global.

## 7. Veredicto

```
GO CON CONDICIONES
```

El baseline de prod **soporta C2B** y el cambio es de **muy bajo riesgo de datos** (0 pólizas, v2 vacío, sin
colisiones, deps presentes). Las condiciones son: **(a)** despliegue aislado de los 16 archivos (no `db push`),
**(b)** ejecutar los scripts `05/06/07` y confirmar 0 colisiones/sin sorpresas, **(c)** backup reciente + PITR
confirmados. Cumplidas, el gate pasa a **GO PARA C3B**.

## Entregables de este gate
- Docs: `PRODUCTION_ENVIRONMENT`, `MIGRATION_STATE`, `PRODUCTION_SCHEMA_INVENTORY`, `SCHEMA_DRIFT`,
  `DATA_COMPATIBILITY`, `FUNCTIONS_TRIGGERS_AUDIT`, `RLS_SECURITY_PREFLIGHT`, `APPLICATION_COMPATIBILITY`,
  `FEATURE_FLAGS_PREFLIGHT`, `BACKUP_RECOVERY`, `MIGRATION_SIMULATION`, `C3B_RUNBOOK_DRAFT`, `GO_NO_GO`,
  `RESUMEN_EJECUTIVO`.
- Scripts read-only reutilizables: `scripts/contacheck-c3a/01..09` + `README.md`.

> No se ejecutó C3B. No se aplicó nada en producción. Detente para revisión.
