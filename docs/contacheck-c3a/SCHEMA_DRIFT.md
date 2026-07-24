# ContaCheck · C3A — Schema Drift (prod real vs local validado)

> Diferencias entre el esquema **real de producción** y el esquema local donde se validó C2B.

## Drift confirmado (evidencia)
| # | Drift | Severidad | Evidencia |
|---|---|---|---|
| D1 | **Ledger ≠ esquema real:** `bank_transactions` tiene `accounting_account_id`/`linked_client_id`/`linked_supplier_id` en prod, pero `20260721100000` **no está registrada** como aplicada | ALTA | probe columnas 200 + migration list `remote=""` |
| D2 | **~13 migraciones locales no registradas en prod** (`20260708000001/2/3`, `20260715*`, `20260719*`, `20260720*`, `20260721100000`, `20260722100000`) | ALTA (para el método de despliegue) | `migration list` |
| D3 | `cobra_collections`/`cobra_commissions` **ausentes en prod** (local las tiene por migración revertida) | MEDIA (no afecta C2B) | probe 404 |
| D4 | `20260722210000` (nómina) aplicada **fuera de orden** | MEDIA | migration list |

## Concordancia FAVORABLE prod↔local (lo que C2B necesita)
| Objeto | Prod | Local (baseline C2B) | ¿Coincide? |
|---|---|---|---|
| `accounting_accounts` v1 (id/company/code/name/type/active/level/parent_code) | ✅ 301 filas | ✅ | **Sí** |
| `accounting_accounts` cols fiscales C2B | ausentes | ausentes (las agrega C2B) | **Sí** |
| `accounting_accounts_v2` | existe, **0 filas** | existe, 0 filas | **Sí** (backfill no-op) |
| `accounting_vouchers` (15 cols orig, `voucher_number` unique global) | ✅ 0 filas | ✅ | **Sí** |
| Columnas C2B en vouchers | ausentes | ausentes (las agrega C2B) | **Sí** |
| 18 tablas nuevas C2B | ausentes | ausentes | **Sí** (sin colisión) |
| Deps core (`companies`, `company_members`, `profiles`, `audit_logs`, `cost_centers`) | ✅ | ✅ | **Sí** |

## Diferencia de entorno (no drift de esquema, pero relevante)
- **Local no tiene `schema_migrations`** (esquema equivalente construido a mano); **prod sí lo tiene** pero
  desactualizado. La validación de C2B corrió sobre el equivalente local — por eso este gate re-verifica prod.
- **bank_transactions** en prod **ya trae** la clasificación contable (D1). El **piloto BancoCheck de C2B** asume
  justamente esas columnas → **favorable** (la suposición se cumple en prod). Nota: la migración `20260721100000`
  **no debe re-aplicarse** (columnas ya existen).

## Conclusión de drift
El drift es **de ledger/método de despliegue**, no de incompatibilidad del baseline contable: el esquema real de
prod que C2B toca (`accounting_accounts`, `accounting_vouchers`, deps) **coincide** con el baseline local. El
riesgo central es **cómo** se aplica C2B (no arrastrar las ~13 no registradas), no **qué** aplica. Pendiente de
scripts `03`–`09` la confirmación fina de constraints/FK/triggers/RLS.
