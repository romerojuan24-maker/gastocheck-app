# ContaCheck · C2A — accounting_vouchers (ampliación) y Líneas

> Ampliación aditiva del encabezado (§4), numeración (§5) y tabla de líneas formal (§6). Tipos exactos para C2B.

## 1. Ampliación de `accounting_vouchers` (ALTER aditivo)
Base actual: `20260705130000:66-90`. Todas las columnas nuevas son **NULL-able** o con default (compatibilidad
con los 2 writers actuales).

| Campo | Ya existe | Tipo propuesto | Nullable | Default | Restricción | Compatibilidad |
|---|---|---|---|---|---|---|
| `company_id` | ✅ `:68` | uuid | no | — | FK companies | — |
| `voucher_number` | ✅ `:70` | varchar(50) | no | — | ver §2 (cambia unicidad) | drop UNIQUE global en fase posterior |
| `voucher_type` | ✅ `:71` | text | no | — | CHECK ampliado (+`ADJUSTMENT`,`OPENING`,`CLOSING`) | ampliar CHECK aditivo |
| `status` | ✅ `:86` | text | no | `'draft'` | CHECK ampliado (ver Periodos_y_Estados) | draft≈generated |
| `source_module` | ✅ `:73` | varchar(50) | no | — | — | — |
| `source_ids` | ✅ `:74` | uuid[] | no | — | **conservar** (compat, no autoridad) | autoridad → `accounting_source_links` |
| `accounting_date` | ❌ | date | sí→no* | — | dentro de período no `locked` | *NULL en backfill, NOT NULL para nuevas |
| `occurred_at` | ❌ | timestamptz | sí | — | — | — |
| `fiscal_year` | ❌ | integer | sí | — | = `accounting_periods.fiscal_year` | — |
| `fiscal_period_id` | ❌ | uuid | sí | — | FK `accounting_periods` | — |
| `currency_code` | ✅ (`currency` `:78`) | varchar(3) | no | `'MXN'` | — | reusar `currency`; alias conceptual |
| `exchange_rate` | ❌ | numeric(18,6) | no | `1.0` | > 0 | — |
| `description` | ❌ | text | sí | — | — | — |
| `reference` | ❌ | text | sí | — | — | — |
| `party_id` | ❌ | uuid | sí | — | FK `parties` | opcional |
| `tax_profile_snapshot` | ❌ | jsonb | sí | — | snapshot inmutable (RFC/razón/régimen/CP) | metadata inmutable OK en jsonb |
| `rule_version_id` | ❌ | uuid | sí | — | FK `accounting_rule_versions` | — |
| `idempotency_key` | ❌ | text | sí→no* | — | UNIQUE `(company_id, idempotency_key)` | *NULL en backfill |
| `reversal_of_voucher_id` | ❌ | uuid | sí | — | self-FK | — |
| `reversed_by_voucher_id` | ❌ | uuid | sí | — | self-FK | — |
| `approved_by` | ❌ | uuid | sí | — | FK auth.users | (hay `exported_by`) |
| `approved_at` | ❌ | timestamptz | sí | — | — | — |
| `posted_by` | ❌ | uuid | sí | — | FK auth.users | — |
| `posted_at` | ❌ | timestamptz | sí | — | — | — |
| `rejected_by` | ❌ | uuid | sí | — | FK auth.users | — |
| `rejected_at` | ❌ | timestamptz | sí | — | — | — |
| `rejection_reason` | ❌ | text | sí | — | — | — |
| `created_by` | ❌ | uuid | sí | — | FK auth.users | — |
| `created_at` | ✅ `:87` | timestamptz | no | `now()` | — | — |
| `updated_at` | ❌ | timestamptz | sí | `now()` | trigger touch (solo pre-posted) | — |
| `version` | ❌ | integer | no | `1` | optimistic lock | patrón `nomi_payroll.version` `20260722210000:110` |
| `metadata` | (parcial `entries`) | jsonb | sí | `'{}'` | datos no consultables | `entries` se conserva como snapshot |

**Nota:** `entries JSONB` (`:80`) se **conserva** como snapshot inmutable; la fuente de reportes son las líneas
normalizadas (§3). No se usa JSON para lo consultable (cuentas, dimensiones, impuestos).

## 2. Numeración de pólizas (§5)
**Problema:** `voucher_number UNIQUE` es **global** (`20260705130000:70`) → colisión multiempresa.
**Diseño:**
- Unicidad objetivo: **`UNIQUE(company_id, fiscal_year, voucher_type, voucher_number)`**.
- **Secuencia por (empresa, ejercicio, tipo)** en tabla `accounting_voucher_sequences(company_id, fiscal_year,
  voucher_type, last_number)` con incremento atómico vía RPC (`SELECT … FOR UPDATE` o `UPDATE … RETURNING`), no
  `SEQUENCE` global (evita huecos entre empresas y respeta RLS).
- **Cuándo se asigna:** el número **oficial** se asigna al **`posted`** (contabilización). Una propuesta
  (`generated`/`pending_*`) usa un **id interno** (`uuid`) + `voucher_number` NULL hasta postear → evita
  consumir folios en propuestas descartadas.
- **Concurrencia:** incremento atómico bajo lock de fila de secuencia; dos conexiones → folios consecutivos sin
  colisión (prueba de 2 conexiones en Plan de Pruebas).
- **Huecos:** no se reutilizan; una propuesta rechazada nunca tomó folio. Reversa toma folio propio.
- **Importaciones / numeración manual / histórica:** permitir `voucher_number` provisto (modo import) validando
  unicidad por la clave compuesta; backfill usa folios históricos o `NULL`+marca `backfilled`.
**Transición:** el `UNIQUE` global actual se mantiene hasta que los 2 writers migren a la clave compuesta; se
retira (DROP) en fase posterior, no en C2B.

## 3. Tabla `accounting_voucher_lines` (§6) — NUEVA

| Campo | Tipo | Nullable | Restricción |
|---|---|---|---|
| `id` | uuid PK | no | `gen_random_uuid()` |
| `company_id` | uuid | no | FK companies RESTRICT (denormalizado para RLS) |
| `voucher_id` | uuid | no | FK `accounting_vouchers` ON DELETE RESTRICT |
| `line_number` | integer | no | UNIQUE `(voucher_id, line_number)` |
| `account_id` | uuid | no | FK `accounting_accounts` (**v1**), cuenta afectable (`is_postable`) |
| `account_code` | varchar(40) | no | snapshot (inmutable) |
| `debit` | numeric(15,2) | no | `0`, ≥ 0 |
| `credit` | numeric(15,2) | no | `0`, ≥ 0 |
| `currency_amount` | numeric(15,2) | sí | importe en moneda origen |
| `exchange_rate` | numeric(18,6) | sí | > 0 |
| `description` | text | sí | — |
| `party_id` | uuid | sí | FK `parties` |
| `tax_code` | varchar(20) | sí | catálogo SAT (traslado/retención) |
| `tax_amount` | numeric(15,2) | sí | ≥ 0 |
| `source_detail_id` | uuid | sí | reglón origen (p.ej. `nomi_tax_withholdings.id`) |
| `metadata` | jsonb | sí | `'{}'` |

**Constraints (§6):**
- `CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))` — cargo **o** abono, no ambos, positivo.
- `UNIQUE(voucher_id, line_number)`.
- Cuenta **afectable**: FK + validación en RPC de que `accounting_accounts.is_postable=true` (columna nueva,
  ver Catálogo).
- **Balance de la póliza:** `Σdebit = Σcredit` — el `CHECK(total_debit=total_credit)` del encabezado
  (`20260705130000:89`) sigue vigente; los totales se recalculan al postear.
- **Inmutabilidad:** sin UPDATE/DELETE cuando el voucher está `posted` (RLS + trigger).

**Mecanismo de validación de balance (§6) — combinación recomendada:**
1. **RPC transaccional de contabilización** (`accounting_post_voucher`) inserta líneas + recalcula
   `total_debit/credit` + verifica `Σdebit=Σcredit` **dentro de la transacción** (fuente primaria de verdad).
2. **CHECK de encabezado** (`total_debit=total_credit`) como red de seguridad declarativa (ya existe).
3. **Trigger diferible** (`CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED`) que, al `COMMIT`, verifica que
   la suma de líneas = totales del encabezado — para atrapar escrituras fuera de la RPC.
No se confía solo en el cliente ni solo en el trigger: la RPC es la vía canónica; el trigger diferible es el
guardián a nivel BD.
