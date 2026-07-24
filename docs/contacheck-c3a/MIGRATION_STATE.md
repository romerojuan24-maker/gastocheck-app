# ContaCheck · C3A — Migration State (§2)

> Fuente: `supabase migration list --linked` (2026-07-24). **Advertencia:** el ledger NO es fuente de verdad —
> hay objetos aplicados a mano no registrados (ver `SCHEMA_DRIFT.md`).

## Mecanismo
Prod usa `supabase_migrations.schema_migrations`. La CLI compara local vs remoto.

## Estado (resumen)
- **Aplicadas y registradas:** el historial hasta `20260713010000` está registrado, **más** `20260722210000`
  (NóminaCheck, aplicada **fuera de orden**).
- **Locales NO registradas en prod (remote vacío) — 13 no-C2B + 16 C2B:**

| Migración | Contenido | ¿Objeto ya en prod? |
|---|---|---|
| `20260708000001` | cobracheck_complete_impl (cobra_collections/commissions) | **NO** (tablas ausentes) — coherente |
| `20260708000002` | flujocheck_complete_impl | por confirmar |
| `20260708000003` | inventariocheck_complete_impl | por confirmar |
| `20260715000000` / `20260715100000` | (varias) | por confirmar |
| `20260719000000` | (varias) | por confirmar |
| `20260720100000/120000/130000` | cobracheck fixes / otros | por confirmar |
| `20260721100000` | **bancocheck_clasificacion_contable** | **SÍ existe en prod** (columnas presentes) — **drift: aplicada a mano, no registrada** |
| `20260722100000` | cfdi_sellos_timbrado | por confirmar |
| `20260724000001..16` | **C2B (ContaCheck)** | NO (objetivo de este gate) |

## Migraciones manuales / fuera de secuencia (evidencia)
- Muchas filas del ledger tienen `time` = la propia versión (p.ej. `20260613300000`, `20260614300000`,
  `20260618300000`…) en lugar de una marca temporal parseada → señal de **aplicación manual/fuera de banda**.
- `20260722210000` (nómina) está registrada **después** de que `20260721100000` (banco) quedara sin registrar →
  aplicación **fuera de orden** (yo mismo apliqué nómina en aislamiento en una sesión previa).

## Implicación crítica para el despliegue de C2B
`supabase db push` aplica **todas** las locales ausentes del remoto. Si se usa tal cual para C2B, **arrastraría
las ~13 migraciones no registradas** (incluida `20260721100000`, cuyas columnas **ya existen** → fallaría o sería
no-op inconsistente; y `cfdi_sellos`, flujo/inv/cobra impl). **→ C2B NO debe desplegarse con `db push` a secas.**
Debe aplicarse **solo los 16 archivos C2B en aislamiento** (patrón usado para nómina), o reconciliar primero el
ledger. Esta es la condición #1 del GO (ver `GO_NO_GO.md`).

## Pendiente de script
Ejecutar `scripts/contacheck-c3a/02_migration_state.sql` en una sesión DB para el listado exacto de `version`,
`name`, `inserted_at` y la confirmación de drift `bank_transactions.accounting_account_id` (col existe / migración
no registrada).
