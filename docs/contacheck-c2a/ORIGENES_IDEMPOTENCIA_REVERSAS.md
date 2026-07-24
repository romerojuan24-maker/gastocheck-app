# ContaCheck · C2A — Orígenes, Idempotencia y Reversas

> §7 `accounting_source_links`, §8 idempotencia multiempresa, §11 reversa formal. Especificación para C2B.

## 1. `accounting_source_links` (§7) — NUEVA (greenfield confirmado)
Reemplaza como **autoridad** la mezcla actual de `source_ids UUID[]` (`20260705130000:74`) + FKs tipadas de
`bank_transactions` (`related_receipt_id`/`related_invoice_id`/`related_advance_id`, `20260618300000:35-37`).

| Campo | Tipo | Nullable | Restricción |
|---|---|---|---|
| `id` | uuid PK | no | `gen_random_uuid()` |
| `company_id` | uuid | no | FK companies RESTRICT |
| `voucher_id` | uuid | no | FK `accounting_vouchers` RESTRICT |
| `source_module` | varchar(50) | no | gastocheck/bancocheck/cobracheck/facturacheck/nominacheck |
| `source_entity` | varchar(64) | no | tabla origen (expense/bank_transaction/cobra_invoice/…) |
| `source_id` | uuid | no | id en la tabla origen |
| `source_version` | integer | no | `1`; versión de la operación origen |
| `event_type` | varchar(48) | no | gasto_autorizado/cobro_recibido/nomina_pagada/… |
| `relationship_type` | varchar(24) | no | CHECK (ver abajo) |
| `source_status_snapshot` | varchar(40) | sí | estado del origen al enlazar |
| `created_at` | timestamptz | no | `now()` |

**`relationship_type` CHECK:** `origin | payment | collection | settlement | adjustment | reversal | bank_match |
supporting_document`.

**Cardinalidad (§7):**
- 1 operación → N pólizas: varias filas con mismo `(source_module,source_entity,source_id)` y distintos `voucher_id`.
- 1 póliza → N operaciones: varias filas con mismo `voucher_id` (p.ej. conciliación agregada).
- Versiones/cancelaciones/pagos parciales/agregaciones: por `source_version` + `relationship_type`.

**Índices/duplicidad:**
- `idx (company_id, source_module, source_entity, source_id, source_version)` — búsqueda por origen.
- `idx (company_id, voucher_id)`.
- **UNIQUE parcial** `(company_id, source_module, source_entity, source_id, source_version, relationship_type)
  WHERE relationship_type='origin'` — un origen no puede tener **dos** pólizas de tipo `origin` para la misma
  versión (evita doble contabilización originante; los `payment`/`bank_match` sí pueden ser múltiples).

## 2. Idempotencia (§8) — dónde vive y cómo
**Llave:** `idempotency_key = encode(hash(company_id, source_module, source_entity, source_id, source_version,
event_type, payload_hash))`.

**Ubicación (combinación):**
- **Encabezado** `accounting_vouchers.idempotency_key` con **UNIQUE `(company_id, idempotency_key)`** — evita 2
  pólizas idénticas a nivel BD (no solo app; corrige el dedupe artesanal `useFacturaCheck.ts:381`).
- **Registro de solicitudes** `accounting_idempotency_requests` (NUEVA): `id, company_id, idempotency_key
  UNIQUE(company_id,key), request_payload_hash, voucher_id, status(pending/completed/failed), created_at` — para
  responder la misma solicitud sin recomputar y detectar **conflicto** (misma llave, payload distinto).

**Comportamiento (§8):**
```
primera solicitud (llave nueva)          → crea registro pending → genera voucher → completed → devuelve voucher_id
misma solicitud (llave + payload_hash)   → devuelve voucher_id existente (no recrea)
misma llave, payload_hash DISTINTO       → error 409 CONFLICT (no sobrescribe)
```
**Casos:**
- Operación única → 1 llave.
- **Operaciones agregadas** (p.ej. conciliación de N movimientos) → llave incluye hash del conjunto ordenado de
  `source_id`s.
- **Pagos parciales** → `source_version`/`event_type` distinto por pago → llaves distintas (múltiples pólizas
  legítimas).
- Reintentos/timeouts/concurrencia → el UNIQUE a nivel BD garantiza 1 sola (patrón `inventory_movements.
  idempotency_key`, `20260712080000:43-45`).
- Reversa → `event_type='reversal'` + `reversal_of` → llave propia.
- Reprocesamiento → nueva `source_version`.

**Hash del payload:** SHA-256 del payload canónico (campos ordenados, importes normalizados a 2 decimales,
fechas ISO) → `payload_hash`. Diferencia de payload con misma llave = conflicto.

## 3. Reversas (§11) — RPC formal
**Regla:** la póliza original **no se borra ni edita**. Se crea una **póliza de reversa** (líneas invertidas) y,
si aplica, una **póliza corregida**.

**`accounting_reverse_voucher(p_company_id, p_voucher_id, p_reason, p_accounting_date, p_expected_version)`**
— SECURITY DEFINER:
- **Validaciones:** voucher existe y es de la empresa; `status='posted'` (solo se revierte lo contabilizado);
  no tiene ya `reversed_by_voucher_id` (evita reversa duplicada); `p_expected_version` = `version` (optimistic
  lock); capacidad `accounting.reverse`.
- **Período:** si el período original está `closed`/`locked`, la reversa se contabiliza con `accounting_date` en
  el **período abierto** actual (nunca reabre el cerrado); si está `open`, puede usar la fecha original.
- **Bloqueo:** `SELECT … FOR UPDATE` sobre el voucher original.
- **Transacción:** crea voucher reversa (`voucher_type` espejo, `reversal_of_voucher_id=original`), inserta
  líneas con `debit`↔`credit` intercambiados, setea `original.reversed_by_voucher_id`, ambos `posted`, folio
  nuevo, audit en `audit_logs`.
- **Respuesta:** `{ reversal_voucher_id, reversal_voucher_number }`.
- **Autorización:** `accounting.reverse`; segregación: quien revierte puede requerir VoBo según política.
- **Operación corregida posterior:** se genera como voucher nuevo con `source_version+1` (idempotencia distinta).

**Reversa de reversa:** bloqueada (una reversa no se revierte; se corrige con póliza nueva).
