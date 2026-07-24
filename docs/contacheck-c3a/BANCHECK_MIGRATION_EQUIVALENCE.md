# ContaCheck · C3A.1 — Equivalencia de `20260721100000_bancocheck_clasificacion_contable` (§5)

> ¿Producción contiene **exactamente** lo que define esa migración? **No se asume equivalencia solo porque existan
> las columnas.**

## Lo que define la migración (fuente local)
`20260721100000_bancocheck_clasificacion_contable.sql`:
- Columnas en `bank_transactions`: `accounting_account_id uuid REFERENCES accounting_accounts(id)`,
  `accounting_account_code text`, `linked_client_id uuid REFERENCES cobra_clients(id)`, `linked_client_name`,
  `linked_supplier_id uuid REFERENCES suppliers(id)`, `linked_supplier_name` (`:14-19`).
- Índices `idx_bank_txn_acct`, `idx_bank_txn_client` (`:21-22`).
- RPC `bancocheck_classify` extendido a 9 argumentos (`:31-81`), reemplazando la versión de 4.

## Verificado en prod (read-only, OpenAPI)
| Objeto | Prod | Tipo |
|---|---|---|
| `bank_transactions.accounting_account_id` | **presente** | uuid ✓ |
| `bank_transactions.linked_client_id` | **presente** | uuid ✓ |
| `bank_transactions.linked_supplier_id` | **presente** | uuid ✓ |
| `bank_transactions.accounting_account_code` | **presente** | text ✓ |

## NO verificado (requiere `05/06`; no visible por PostgREST/OpenAPI)
- [ ] **Nulabilidad y defaults** exactos de las 6 columnas.
- [ ] **FK reales**: `accounting_account_id → accounting_accounts` (v1), `linked_client_id → cobra_clients`,
      `linked_supplier_id → suppliers` (¿existen las FK, o solo las columnas?).
- [ ] `linked_client_name`, `linked_supplier_name` (no probados individualmente).
- [ ] **Índices** `idx_bank_txn_acct`, `idx_bank_txn_client`.
- [ ] **RPC `bancocheck_classify`**: ¿existe la versión de **9 argumentos** o quedó la de 4?
- [ ] Comentarios / RLS / triggers introducidos por la migración.

## Clasificación de equivalencia
**PARCIAL.** Las columnas de clasificación contable **existen con los tipos correctos**, pero **FK, índices, RPC
9-arg, nulabilidad y demás objetos de la migración NO están confirmados**. Aplicando el principio del §5, **no se
declara COMPLETA** hasta verificar el resto con `05/06`.

## Implicación para C2B
- **Favorable:** el piloto BancoCheck de C2B usa `bank_transactions.accounting_account_id` → la suposición se
  cumple (columnas presentes).
- **Riesgo:** la migración `20260721100000` **no debe reaplicarse** (columnas ya existen → fallaría). Por eso C2B
  se aplica **aislado** (no `db push`).
- **Acción antes de activar el adaptador BancoCheck (fase posterior, no C3B):** confirmar la RPC de 9 args y las FK
  con `06/05`, porque el adaptador dependerá de la clasificación correcta.
