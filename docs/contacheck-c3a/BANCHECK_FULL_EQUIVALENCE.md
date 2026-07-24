# ContaCheck · C3A.2 — Equivalencia completa de BancoCheck (§3)

> Objeto por objeto de `20260721100000_bancocheck_clasificacion_contable` vs producción.

## Confirmado (read-only, OpenAPI)
| Objeto | Prod | Detalle |
|---|---|---|
| `bank_transactions.accounting_account_id` | ✅ presente | tipo **uuid** |
| `bank_transactions.linked_client_id` | ✅ presente | **uuid** |
| `bank_transactions.linked_supplier_id` | ✅ presente | **uuid** |
| `bank_transactions.accounting_account_code` | ✅ presente | **text** |

## NO verificable sin `05/06` (Docker caído + prod = sesión de Juan)
| Objeto | Estado |
|---|---|
| `linked_client_name`, `linked_supplier_name` | no probados individualmente |
| **Nulabilidad y defaults** de las 6 columnas | **pendiente** |
| **FK** (→ `accounting_accounts`, `cobra_clients`, `suppliers`) | **pendiente** (columna presente ≠ FK presente) |
| Índices `idx_bank_txn_acct`, `idx_bank_txn_client` | **pendiente** |
| **RPC `bancocheck_classify` de 9 args** (vs 4) | **pendiente** (crítico para el adaptador BancoCheck futuro) |
| Comentarios / RLS / triggers de la migración | **pendiente** |

## Clasificación
```
EQUIVALENCIA PARCIAL
```
Las **columnas existen con tipos correctos**, pero **FK, índices, RPC de 9 args, nulabilidad, RLS y triggers no
están confirmados**. Por principio (no asumir equivalencia por columnas), **no** se declara COMPLETA.

## Si al ejecutar `05/06` resulta PARCIAL/INCOMPATIBLE
Generar una **migración de reconciliación específica** (aparte de C2B) que cree **solo lo faltante** de
`20260721100000` (p.ej. FK/índices/RPC de 9 args) con `IF NOT EXISTS` y comparación de definición — **sin**
re-aplicar la migración completa (sus columnas ya existen). Esta reconciliación es **requisito del adaptador
BancoCheck** (fase posterior), **no** del despliegue del esquema C2B.

## Relación con C2B
- **Favorable para C2B:** el piloto BancoCheck usa `accounting_account_id` (presente).
- **No bloquea el esquema C2B:** C2B no re-aplica `20260721100000` (se despliega aislado).
- **Sí bloquea** activar el **adaptador BancoCheck** en producción hasta cerrar la equivalencia (RPC 9-arg + FK).
