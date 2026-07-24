# ContaCheck · C1.1 — Contrato Normalizado de Póliza

> Contrato compatible con `accounting_vouchers` (`20260705130000:66-90`). Para cada campo: si ya existe, si se
> amplía, si es encabezado o línea, y si va en tabla relacionada / metadata. **No hay SQL aquí.** Ref. §6.

## 1. Encabezado

| Campo | Estado en `accounting_vouchers` | Ubicación destino |
|---|---|---|
| `schema_version` | **NUEVO** | encabezado (col) |
| `company_id` | **EXISTE** (`:68`) | encabezado |
| `source_module` | **EXISTE** (`:73`) | encabezado |
| `source_entity` | **NUEVO** (hoy implícito en module) | tabla relacionada `accounting_source_links` |
| `source_id` | **EXISTE parcial** como `source_ids UUID[]` (`:74`) | tabla relacionada (1..N) |
| `source_version` | **NUEVO** | `accounting_source_links` |
| `event_type` | **NUEVO** (hoy solo `voucher_type`) | encabezado |
| `voucher_type` | **EXISTE** CHECK INCOME/EXPENSE/TRANSFER (`:71`) → ampliar | encabezado |
| `accounting_date` | **NUEVO** (solo hay `created_at` `:87`) | encabezado |
| `occurred_at` | **NUEVO** | encabezado |
| `ejercicio` / `period_id` | **NUEVO** | encabezado (FK a `accounting_periods` NUEVO) |
| `currency` | **EXISTE** def MXN (`:78`) | encabezado |
| `exchange_rate` | **NUEVO** | encabezado |
| `description` | **NUEVO** (hoy no hay) | encabezado |
| `reference` | **NUEVO** | encabezado |
| `party` | **NUEVO** (`party_id`) | encabezado (opcional) + snapshot RFC/nombre |
| `documents` (múltiples) | **NUEVO** | tabla relacionada `accounting_voucher_documents` |
| `dimensions` (cabecera) | **NUEVO** | por línea (ver §2), no encabezado |
| `idempotency_key` | **NUEVO** (hoy solo `voucher_number UNIQUE` **global** `:70`) | encabezado (col + índice único por empresa) |
| `reversal_of` (`reverses_voucher_id`) | **NUEVO** | encabezado (self-FK) |
| `status` | **EXISTE** draft/exported/reconciled (`:86`) → ampliar ciclo | encabezado |
| `approved_by`/`approved_at` (VoBo) | **NUEVO** (hay `exported_by` `:84`) | encabezado |
| `total_debit`/`total_credit` | **EXISTE** + `CHECK =` (`:76-77,89`) | encabezado |
| `metadata` | usar `entries`/nuevo `metadata jsonb` | encabezado (jsonb) |

## 2. Líneas
Hoy las líneas viven en **`entries JSONB`** (`:80`), sin FK ni dimensiones. Diseño: materializar a
**`accounting_voucher_lines`** (NUEVO), conservando `entries` como snapshot.

| Campo de línea | Estado | Nota |
|---|---|---|
| `account_id` | **NUEVO** (FK a `accounting_accounts` v1) | catálogo autoritativo (C1 ADR-001) |
| `account_code` | **NUEVO** (snapshot) | inmutable aunque cambie el catálogo |
| `rule_concept` | **NUEVO** | qué regla generó la línea |
| `debit` / `credit` | en `entries` hoy | columnas |
| `description` | en `entries` | columna |
| `party_id` | **NUEVO** | FK opcional a `parties` |
| `tax_code` / `tax_amount` | **NUEVO** | IVA/retención como **línea propia** (cierra P2) |
| `dimensions` | **NUEVO** | ver `PARTIES_FISCAL_DIMENSIONES.md` (por línea) |
| `source_detail_id` | **NUEVO** | reglón origen (p.ej. `nomi_tax_withholdings.id`) |
| `metadata` | jsonb | libre |

## 3. Reglas de ubicación (§6)
- **Ya existen (encabezado):** `company_id`, `source_module`, `source_ids`, `voucher_type`, `currency`,
  `total_debit/credit`+CHECK, `status`.
- **Deben ampliarse (encabezado):** `event_type`, `accounting_date`/`occurred_at`, `period_id`,
  `exchange_rate`, `description`, `reference`, `party_id`, `idempotency_key`, `reversal_of`, VoBo, `schema_version`.
- **Tablas relacionadas (NO en JSON):** líneas (`accounting_voucher_lines`), orígenes
  (`accounting_source_links`), documentos (`accounting_voucher_documents`), períodos (`accounting_periods`).
- **NO deben guardarse en JSON:** cuentas por línea, dimensiones, tercero, impuestos (necesitan FK/consulta
  para mayor/balanza). `entries` JSONB se conserva **solo como snapshot inmutable**, no como fuente de reportes.
- **Sí pueden ir en metadata:** payloads del origen, banderas de UI, trazas de la regla, datos no consultables.

## 4. Compatibilidad con lo que ya escribe
Los 2 writers actuales (`conciliacion/page.tsx:187`, `useFacturaCheck.ts:423`) llenan `source_module`,
`source_ids`, `entries`, `total_*`, `status`. El contrato es **aditivo**: esos writers siguen funcionando; el
motor nuevo llena además los campos ampliados. Migración de sus `entries` a `accounting_voucher_lines` es
posterior (no rompe).

## 5. Invariantes del contrato
1. `Σdebit = Σcredit` (ya por `CHECK`, `:89`).
2. `idempotency_key` único **por empresa** (corrige el `voucher_number` global).
3. `currency`+`exchange_rate` siempre presentes.
4. Snapshot de cuenta/RFC/importes en la línea/encabezado → inmutabilidad histórica.
5. PII de nómina: nunca RFC en claro; `party_id`/`rfc_hash`.
