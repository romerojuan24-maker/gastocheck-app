# ContaCheck · C3A — Migration Simulation (§14)

> Cada una de las 16 migraciones C2B comparada contra el esquema **real** de prod. Clasificación: **SEGURA** /
> **CONDICIONADA** / **BLOQUEANTE**. Sin aplicar cambios.

## Contexto de prod que hace todo de bajo impacto
- `accounting_vouchers`: **0 filas**; `accounting_accounts_v2`: **0 filas**; `accounting_accounts`: 301 filas.
- Las 18 tablas nuevas **ausentes** (sin colisión). Deps core presentes. PG 17 (ADD COLUMN con default
  no-volátil = **metadata-only**, sin rewrite).

## Clasificación por bloque
| # | Bloque | Clasificación | Motivo / lock / rewrite |
|---|---|---|---|
| 1 | capabilities | SEGURA | CREATE TABLE nuevas; sin lock relevante |
| 2 | periods + audit helper | SEGURA | tablas nuevas |
| 3 | accounts_ext (ALTER accounting_accounts) | **CONDICIONADA** | ADD COLUMN sobre 301 filas: `is_postable NOT NULL DEFAULT true` es metadata-only en PG17 (rápido); CHECKs `NOT VALID` (sin validación costosa). Backfill v2 = **no-op** (0 filas). Lock breve `ACCESS EXCLUSIVE` en `accounting_accounts` (ms) |
| 4 | parties | SEGURA | tablas nuevas |
| 5 | tax_profiles | SEGURA | tabla nueva |
| 6 | vouchers_ext (ALTER accounting_vouchers) | **CONDICIONADA** | 26 ADD COLUMN sobre **0 filas** → instantáneo; drop+recreate de CHECK status/type (widen) con 0 filas → sin validación costosa; trigger inmutabilidad nuevo. Lock breve |
| 7 | numbering (voucher_number nullable + unicidad) | **CONDICIONADA** | `DROP CONSTRAINT unique` + `ALTER COLUMN DROP NOT NULL` + índices parciales sobre **0 filas** → sin rewrite, sin duplicados |
| 8 | voucher_lines | SEGURA | tabla nueva + constraint trigger |
| 9 | source_links | SEGURA | tabla nueva |
| 10 | idempotency | SEGURA | tabla nueva + índice único parcial sobre vouchers (0 filas) |
| 11 | dimensions | SEGURA | tabla nueva |
| 12 | rules (+FK rule_version en vouchers) | SEGURA | tablas nuevas; FK sobre 0 filas |
| 13 | rpc_generate | SEGURA | CREATE OR REPLACE FUNCTION (verificar colisión con `06`) |
| 14 | rpc_post_reverse | SEGURA | idem |
| 15 | rls_grants | **CONDICIONADA** | políticas/grants sobre tablas nuevas; verificar que no toque políticas legacy de `accounting_vouchers` (por diseño no lo hace) |
| 16 | compat_flags | SEGURA | tabla nueva + funciones |

**BLOQUEANTE:** ninguna a nivel de contenido de migración.

## Riesgos de método (no de contenido) — el punto crítico
- **`supabase db push` arrastraría ~13 migraciones no registradas** (D2 en `SCHEMA_DRIFT.md`), incluida
  `20260721100000` cuyas columnas **ya existen** en prod → esa sí sería **BLOQUEANTE** si se replay-ea. **Por eso
  C2B debe aplicarse SOLO con sus 16 archivos, en aislamiento** (no `db push`), o reconciliando el ledger primero.
- **Colisión de nombres de función:** pendiente de confirmar con `06` (esperado 0). Si alguna `accounting_*` ya
  existiera con otra firma, `CREATE OR REPLACE` podría fallar → CONDICIONADA hasta verificar.

## Locks / validaciones costosas / rewrites
- **Rewrites de tabla:** ninguno (0 filas en las tablas alteradas relevantes; ADD COLUMN metadata-only).
- **Validaciones costosas:** ninguna (CHECK `NOT VALID`; FKs sobre 0 filas).
- **Locks:** solo `ACCESS EXCLUSIVE` breves en `accounting_accounts` (301 filas) y `accounting_vouchers` (0) →
  milisegundos; ventana de mantenimiento no imprescindible dado el bajo volumen, pero recomendada.

## Nombres ya ocupados
- Tablas: **0 colisiones** (confirmado por probes 404). Funciones: **pendiente `06`**. Índices/constraints: nombres
  C2B son nuevos (`uq_vouchers_*`, `acc_line_*`, etc.) — verificar con `04`/`09`.
