# ContaCheck · C1.1 — Idempotencia y Reversas

> Diseño conceptual de la llave de idempotencia y del tratamiento de reversas. Sin migraciones. Ref. §11, §12.

## 1. Estado actual de idempotencia (evidencia)
- `accounting_vouchers.voucher_number VARCHAR(50) NOT NULL UNIQUE` (`20260705130000:70`) — **UNIQUE GLOBAL,
  no por empresa** → riesgo de colisión multi-tenant. **No hay `idempotency_key`.**
- Dedupe hoy es **artesanal a nivel app**: `.contains('source_ids', [cfdiId])` (`useFacturaCheck.ts:381`),
  chequeo en `conciliacion/page.tsx:191-192`.
- Patrones robustos ya existentes a reutilizar (partial-unique **por empresa**):
  - `bank_transactions.unique_hash` → `idx…(company_id, bank_account_id, unique_hash) WHERE unique_hash IS NOT NULL`
    (`20260712010000:29-31`).
  - `bank_import_logs.file_hash` (`20260712010000:41-43`).
  - `inventory_movements.idempotency_key` → `idx…(company_id, idempotency_key) WHERE … NOT NULL`
    (`20260712080000:43-45`), aplicada por RPC (`20260712090000:66-69`).

## 2. Llave de idempotencia propuesta
```
idempotency_key = hash(company_id, source_module, source_entity, source_id, source_version, event_type)
```
- `source_version`: versión de la operación origen (p.ej. `nomi_payroll.version` `20260722210000:110`; para
  otros, un contador o el `updated_at`), para que una **corrección** del origen genere una llave distinta
  (nueva póliza de ajuste) y no choque con la original.
- **Restricción conceptual:** índice único **parcial por empresa** sobre `idempotency_key` (patrón
  `inventory_movements`), NO global. Ídem revisar `voucher_number` a folio por empresa/período.

## 3. Qué debe impedir (§11) y cómo
| Amenaza | Defensa |
|---|---|
| Doble clic | misma `idempotency_key` → UPSERT/short-circuit |
| Reintento de API / timeout con respuesta perdida | la 2ª llamada encuentra la póliza existente por llave |
| Webhook duplicado | idem |
| Job repetido | idem |
| Dos servidores simultáneos | índice único a nivel BD (no solo chequeo app) → uno gana, el otro viola constraint |
| Reversa duplicada | la reversa lleva su propia llave (`event_type='reversal'`+`reversal_of`); segunda intenta = colisión |
| BancoCheck duplicando una póliza existente | BancoCheck **concilia** (crea `accounting_source_links`), no origina, si ya hay póliza del módulo para ese hecho |

## 4. Reversas (§12) — regla de oro
**Una póliza `posted` no se edita ni se borra.** Toda corrección es un nuevo asiento.

| Escenario | Tratamiento |
|---|---|
| Cancelación **antes** de contabilizar (`proposed`) | descartar/`rejected` la propuesta; no hubo asiento |
| Cancelación **después** de `posted` | generar **póliza de reversa** (espejo, `reversal_of=voucher_id`) |
| Cambio de importe | reversa total + **póliza corregida** (nueva versión de la operación, nueva `idempotency_key`) |
| Cambio de tercero | reversa + corregida (no editar líneas) |
| Cambio de cuenta | reversa + corregida |
| Cambio de dimensiones | reversa + corregida |
| Período **abierto** | reversa+corregida con `accounting_date` en el período |
| Período **cerrado** | reversa+corregida con `accounting_date` en el **período abierto** actual (nunca reabrir el cerrado) |
| Reversa duplicada | bloqueada por idempotencia (§3) |
| Nueva versión de la operación | `source_version` incrementa → nueva póliza; la anterior se reversa si ya estaba `posted` |

Flujo canónico:
```
póliza original (posted)
  → póliza de reversa (posted, reversal_of = original)
  → póliza corregida (posted, source_version+1)   [cuando corresponda]
```

## 5. Inmutabilidad (implementación conceptual)
- Sin policy UPDATE/DELETE para `authenticated` en `accounting_vouchers` (hoy ya es así:
  `20260705130000:127-139` solo define SELECT+INSERT) + **trigger** que rechace cualquier UPDATE de una fila
  `status='posted'` salvo transiciones de estado permitidas.
- Reglas de estado válidas: ver `CONTRATO`/`RESUMEN` (ciclo `generated→…→posted→reversed`).

## 6. Gaps de reversa en los módulos (a cubrir por el adaptador)
- **CobraCheck:** borrar un `cobra_payment` **no** recalcula saldo/estatus (los triggers son AFTER INSERT/UPDATE,
  no DELETE, `20260618210000:193-196,215-218`) → el adaptador debe tratar el void como evento de reversa, no
  confiar en DELETE.
- **NóminaCheck:** no hay RPC de reversa post-pago; la cancelación es `status='cancelled'`
  (`20260722210000:109`) → el adaptador genera la póliza de reversa al detectar `cancelled`.
- **GastoCheck:** `rejected/deleted` de un gasto ya reconocido no genera contra-asiento hoy → el adaptador lo hace.
