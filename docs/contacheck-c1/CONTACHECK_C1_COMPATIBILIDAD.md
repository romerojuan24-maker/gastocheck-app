# ContaCheck · C1 — Diseño de Compatibilidad

> Cómo avanzar sin migraciones destructivas: vistas, columnas opcionales, adaptadores, snapshots, flags.
> Ninguna "gran migración" simultánea. Ref. §11 del prompt.

## 1. Mecanismos de compatibilidad
- **Vistas de solo lectura:** `contacheck_expense_account_v` (cuenta normalizada de gasto, ADR-003),
  `companies_fiscal_v` (perfil fiscal activo, ADR-008), vistas por adaptador (contrato normalizado).
- **Columnas nuevas opcionales (NULL-ables):** `party_id` por módulo; columnas fiscales en v1 (ADR-002);
  ampliaciones de `accounting_vouchers` (ADR-005); puente bancario (ADR-007).
- **Tablas de mapeo:** `(company_id, code)` v2→v1 si hubiera filas v2 en prod; `accounting_category_map`
  (`20260608000003:342-356`) ya existe para categoría→cuenta (reutilizar, no duplicar).
- **RPC/funciones:** motor de contabilización nuevo (lee v1, escribe `accounting_vouchers`); no toca los RPC
  de módulos (`bancocheck_classify`, `bancocheck_approve_suggestion`, `20260712020000`/`050000`).
- **Snapshots:** la póliza fotografía valores (ver autoridad de datos).
- **Feature flags:** activar contabilización por módulo/empresa (piloto controlado).

## 2. Matriz por objeto legado

| Objeto | Se conserva | Se congela | Se adapta | Se migra después | Se retira después |
|---|---|---|---|---|---|
| `accounting_accounts` (v1) | ✅ | — | +cols fiscales | — | — |
| `accounting_accounts_v2` | ✅ (no borrar) | ✅ | — | mapear si hay datos | ✅ (tras 0 filas) |
| `generate_accounting_entries` + `export_policy_*` | ✅ (no borrar) | ✅ | — | reemplazado por motor nuevo | ✅ |
| `accounting_entries` (v2) | ✅ | ✅ | — | — | ✅ (tras corte) |
| `accounting_vouchers` | ✅ | — | +cols (fecha/período/party/VoBo/reversa/líneas) | — | — |
| `apps/web/lib/poliza.ts` | ✅ | — | extraer reglas a `packages/shared` (corrigiendo signo) | — | opcional |
| `expenses.accounting_account_id/_code` | ✅ | — | vista normalizada (ADR-003) | limpiar `_code` | — |
| `suppliers`/`cobra_clients`/`cfdi_clients`/`fleet_clients` | ✅ | — | +`party_id` opcional | — | — |
| `bank_accounts` / `company_bank_accounts` | ✅ | — | +puente opcional | — | — |
| `companies` (cols fiscales) | ✅ | — | vista `companies_fiscal_v` | consumidores → perfil | — |
| `cfdi_provider_configs` (CSD) | ✅ | — | referenciado por perfil | — | — |

## 3. Verificación previa obligatoria (drift)
Antes de cualquier implementación, **verificar objetos reales en prod** (no `schema_migrations`), según
`DRIFT_AUDIT_2026-07-22.md`:
- ¿Existen filas en `accounting_accounts_v2` en prod? (para decidir mapeo vs retiro directo).
- ¿`cobra_collections`/`cobra_commissions` existen? (migración `20260708000001` revertida, `:1-10`).
- Confirmar que `expenses.accounting_account_id` es FK a v1 en prod (no v2).
- Confirmar `accounting_vouchers` presente en prod con el esquema de `20260705130000`.

## 4. Principio rector
Toda evolución es **aditiva y reversible por objeto**: `CREATE VIEW`, `ADD COLUMN ... NULL`, tablas nuevas.
Cero `DROP`/cambio de FK/reestructura de módulo en las fases tempranas. El retiro de legado ocurre **al
final**, con evidencia de 0 dependencias vivas.
