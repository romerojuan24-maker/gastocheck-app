# ContaCheck · C1 — Catálogo Contable

> Auditoría profunda de `accounting_accounts` (v1) vs `accounting_accounts_v2`, inventario de referencias, y
> estrategia de consolidación no destructiva. Ref. ADR-001, ADR-002.

## 1. Comparativa de esquemas (evidencia)

| Aspecto | v1 `accounting_accounts` | v2 `accounting_accounts_v2` |
|---|---|---|
| Definición | `20260606000001_init.sql:96-104` | `20260623000001_gastocheck_contabilidad_integration.sql:27-42` |
| Columnas base | `id, company_id, code, name, account_type, active` | `id, company_id, code, name, account_type, sub_type, nature, is_deductible, requires_cfdi, active, description, created_at, updated_at` |
| Jerarquía | **Sí** — `level`, `parent_code` (`20260615300000_accounting_columns.sql:5-7`) | **No** |
| `account_type` | `text` libre, sin CHECK (`init.sql:101`) | CHECK `activo/pasivo/patrimonio/ingreso/egreso/costo` (`:32`) |
| Semántica fiscal | Ninguna | `nature` (`:34`), `is_deductible` (`:35`), `requires_cfdi` (`:36`), `sub_type` (`:33`) |
| Unicidad | `(company_id, code)` (`init.sql:103`) | `(company_id, code)` (`:41`) |
| Company scoping | Sí (`init.sql:98`) | Sí (`:29`) |
| RLS | read miembros / manage owner+accountant+admin (`init.sql:334-337`, `20260617600000:6-7`) | read miembro+can_view_all / manage owner+accountant (`:306-311`) |
| Timestamps | No | `created_at`/`updated_at` (`:39-40`) |
| Seed | **Ninguno** (grep `INSERT INTO accounting_accounts` = 0) | **Ninguno** |

## 2. Inventario de referencias (FK / lógicas)

| Tabla/archivo:línea | Campo | Catálogo | Uso real | Datos | Riesgo |
|---|---|---|---|---|---|
| `20260606000001_init.sql:111` | `expense_categories.default_account_id` | v1 | sin lectura en app | no seed | Bajo |
| `20260615300000_accounting_columns.sql:11` | `expenses.accounting_account_id` | **v1** (FK viva) | UI (pólizas/supervisor) | no seed | Medio |
| `20260623000001:62` | `expenses.accounting_account_id` (intento v2) | v2 **NO-OP** | none | — | **Alto** (motor asume v2) |
| `20260623000001:79` | `accounting_entries.account_id` | v2 | motor SQL sin caller | no seed | **Alto** (código muerto + JOIN roto) |
| `20260721100000_bancocheck_clasificacion_contable.sql:15` | `bank_transactions.accounting_account_id` | v1 | UI+API (BancoCheck) | no seed | Bajo |
| `20260630000001_fix_reembolsos_receipts_columns.sql:6` | `receipts.accounting_account_id` | v1 | UI (reembolsos) | no seed | Bajo |
| `20260608000003_receipts_schema.sql:347` | `accounting_category_map.accounting_account` | **ninguno** (TEXT) | sin uso en app | no seed | Medio |

Consumidores de app (todos **v1**): `catalogo-cuentas.tsx:69/121/125/139/206` (CRUD),
`catalogo-import-modal.tsx:89` (import), `polizas.tsx:129`, `apps/web/.../gastocheck/polizas/page.tsx:122`,
`supervisor.tsx:257`, `supervisor/reembolsos/index.tsx:123`, `bancocheck/components/ClassifyModal.tsx:79`,
`bancocheck/hooks/useBanco.ts:106-112`. Consumidores de **v2**: solo funciones SQL sin caller
(`generate_accounting_entries`, `export_policy_contpaqui`, `export_policy_json`, `20260623000001:157-296`).

## 3. Determinaciones (§3 del prompt)
- **Mayor cobertura / más consumidores:** v1 (9 puntos de app + 3 FK reales). v2 = 0 consumidores de app.
- **Jerarquía / código agrupador:** solo v1 (`level`/`parent_code`). *(Nota: ninguno tiene `CodAgrupador` SAT
  para contabilidad electrónica — brecha; ver perfil fiscal.)*
- **Soporte de empresa:** ambos (`company_id`).
- **Datos reales:** ambos se pueblan solo en runtime; la UI escribe **v1**; v2 sin escritores → huérfano.
- **Info exclusiva en v2:** sí — `nature`, `is_deductible`, `requires_cfdi`, `sub_type`, `account_type` con
  CHECK SAT, `description`, timestamps.
- **IDs mapeables:** v1 y v2 usan `uuid` independientes; la correspondencia es por `(company_id, code)`, no
  por id. Un mapeo debe hacerse por **code**.
- **Duplicados semánticos / códigos incompatibles:** posible, porque `account_type` es libre en v1 y acotado
  en v2; al portar se normaliza vía columna nueva.

## 4. Estrategia de consolidación (no destructiva)
1. **Congelamiento:** marcar v2 como legado; ningún objeto nuevo escribe v2. (Documental en C1; efectivo en
   fase de congelamiento.)
2. **Compatibilidad:** añadir a **v1** columnas fiscales opcionales (`account_type_norm` con CHECK,
   `nature`, `is_deductible`, `requires_cfdi`, `sub_type`) — aditivo, NULL-able, sin romper `account_type`
   libre existente (`init.sql:101`).
3. **Mapeo:** por `(company_id, code)` de v2→v1 si hubiera filas v2 en prod (a verificar; probablemente 0).
4. **Migración progresiva:** reapuntar el motor de asientos (hoy roto contra v2, `20260623000001:180`) a v1;
   los consumidores de app ya usan v1 (sin cambio).
5. **Retiro futuro:** tras confirmar 0 filas v2 en prod, deprecar v2 y sus funciones muertas.

## 5. Brecha para contabilidad electrónica (SAT)
Ni v1 ni v2 tienen **CodAgrupador** del catálogo SAT ni tablas de balanza/mayor/diario. Los catálogos SAT
(régimen/uso/forma de pago) viven solo del lado app (`apps/mobile/lib/sat-catalogs.ts`), no en BD. Esto es
trabajo de C7/C8, no de C1; se registra como brecha.
