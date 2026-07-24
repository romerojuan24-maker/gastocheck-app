# ContaCheck · C1 — Cuentas Bancarias

> Autoridad por campo entre `bank_accounts` y `company_bank_accounts`. Ref. ADR-007.

## 1. Las dos tablas (evidencia)

**`bank_accounts`** (operativa) — `20260618300000_bancocheck_schema.sql:5-17`, `account_type` añadido en
`20260712010000_bancocheck_ajuste_operativo.sql:10-11`.
Columnas: `id`, `company_id`, `name` (`:8`), `bank_name` nullable (`:9`), `last4` (`:10`), `currency` def MXN
(`:11`), `current_balance` numeric(15,2) (`:12`), `is_active` (`:13`), `notes` (`:14`), `account_type`
(`20260712010000:10`). **Sin** clabe, titular, is_primary.

**`company_bank_accounts`** (fiscal/config) — `20260629010000_company_bank_accounts.sql:4-15`, `clabe_last4`
en `20260706020000_mask_clabe_and_advisor_hardening.sql:10-11`.
Columnas: `id`, `company_id`, `bank_name` NOT NULL (`:7`), `account_last4` (`:8`), `clabe` (`:9`),
`account_holder` (`:10`), `account_type` (`:11`), `currency` (`:12`), `active` (`:13`), `clabe_last4`
GENERATED (`20260706020000:10-11`). **Sin** saldo, movimientos, is_primary.

## 2. Hechos determinantes
- **Movimientos:** `bank_transactions.bank_account_id → bank_accounts` (`20260618300000:22`).
  `company_bank_accounts` **no tiene movimientos**.
- **Enlace contable:** solo a nivel movimiento: `bank_transactions.accounting_account_id → accounting_accounts`
  (v1, `20260721100000_bancocheck_clasificacion_contable.sql:15`). Ninguna cuenta tiene columna contable propia.
- **CLABE:** solo en `company_bank_accounts` (`:9`), texto plano al escribir; a la lectura se **enmascara** —
  REVOKE SELECT total + GRANT por columnas sin la CLABE cruda, exponiendo solo `clabe_last4`
  (`20260706020000:13-15`). **No** cifrada (a diferencia de los CSD, que sí, `20260706010000`).
- **Referencia entrante:** `receipts.bank_account_id → company_bank_accounts` (`20260629010000:45-46`) — la
  **única** FK entrante; nunca se repunta a `bank_accounts`.
- **Consumidores:** `bank_accounts` → BancoCheck web/móvil, conciliación, importación, `advisor-correlate`
  (`supabase/functions/advisor-correlate/index.ts:208,383`). `company_bank_accounts` → `administracion.tsx:223`,
  `admin-panel.tsx:110`, FK de `receipts`.

## 3. Autoridad por campo

| Campo | Tabla autoritativa | Evidencia | Razón |
|---|---|---|---|
| Banco (`bank_name`) | `company_bank_accounts` (maestro, NOT NULL) | `20260629010000:7` vs `20260618300000:9` | En `bank_accounts` es nullable/secundario a `name` |
| Nº enmascarado (last4) | por dominio: op `bank_accounts.last4` / fiscal `company_bank_accounts.account_last4` | `20260618300000:10` / `20260629010000:8` | No comparten fila |
| CLABE | **`company_bank_accounts`** (única) | `20260629010000:9`; masking `20260706020000:10-15` | `bank_accounts` no tiene CLABE |
| Titular | **`company_bank_accounts`** (única) | `20260629010000:10` | `bank_accounts` no tiene titular |
| Moneda | op `bank_accounts.currency` | `20260618300000:11` / `20260629010000:12` | Conciliación opera sobre movimientos |
| Saldo | **`bank_accounts`** (única) | `20260618300000:12` | `company_bank_accounts` no tiene saldo |
| Movimientos | **`bank_accounts`** (única) | `20260618300000:22` | FK de `bank_transactions` |
| Cuenta contable | **`bank_accounts`** vía movimientos | `20260721100000:15` | Único enlace a `accounting_accounts` |
| Cuenta principal | **ninguna** | ausente en ambos DDL | Decisión de negocio pendiente |
| Estatus | op `is_active` / fiscal `active` | `20260618300000:13` / `20260629010000:13` | Nombres distintos |

## 4. Veredicto
**Entidades complementarias** (operativa vs fiscal), con **duplicación parcial** de datos maestros
(banco/last4/tipo/moneda) **sin sincronización** y **sin FK entre sí**. No es "viejo vs nuevo": ambas
evolucionaron en 2026-07 (`20260706020000`, `20260712010000`, `20260721100000`).

## 5. Diseño para ContaCheck (no destructivo)
- **Contraparte contable / conciliación:** `bank_accounts` (autoritativa por saldo+movimientos+enlace contable).
- **Identidad fiscal (CLABE/titular):** `company_bank_accounts`.
- **Puente explícito:** añadir columna opcional de correlación (p.ej. `company_bank_accounts.operational_account_id
  → bank_accounts(id)` **o** una tabla puente), para que un asiento que cruce `receipts` (lado fiscal) con
  movimientos (lado operativo) tenga cómo unirlos. Hoy esa brecha no tiene puente.
- **Cuenta principal:** definir política `is_primary` (decisión de negocio) — no existe hoy.
- Todo aditivo; nada se borra ni se cambia de FK.
