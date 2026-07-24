# ContaCheck · C2A — Compatibilidad y Pilotos

> §19 compatibilidad con las 2 rutas que hoy escriben `accounting_vouchers`; detalle operativo de pilotos.

## 1. Las 2 rutas que hoy escriben `accounting_vouchers` (evidencia)
- **BancoCheck web:** `apps/web/app/(dashboard)/bancocheck/conciliacion/page.tsx:187` (`generateVoucher()`
  `:179`), INSERT `status:'draft'`, `source_module='bancocheck'`, `source_ids`, `entries`.
- **FacturaCheck mobile:** `apps/mobile/app/facturacheck/hooks/useFacturaCheck.ts:423` (`generate/Bulk`), INSERT
  con dedupe `.contains('source_ids',…)` (`:381`) + `audit_logs` (`:438`).

## 2. Estrategia de transición (§19) — sin romper flujos
**Principio: doble escritura PROHIBIDA.** Durante la transición cada ruta escribe por **un solo** camino,
controlado por feature flag.

### Fase compat-0 (C2B Etapa 1–2): esquema ampliado, rutas intactas
- Las columnas nuevas son NULL-ables → los INSERT actuales **siguen funcionando** sin cambio (llenan
  `source_module`, `source_ids`, `entries`, `total_*`, `status='draft'`).
- El `UNIQUE(voucher_number)` global se conserva; la nueva unicidad compuesta se añade **sin** quitar la vieja
  todavía (ambas coexisten si no colisionan; ver numeración).

### Fase compat-1: adaptador temporal (lectura compatible)
- Un backfill `BACKFILL_REFERENCE_ONLY` crea `accounting_source_links` a partir de `source_ids` existentes de las
  pólizas ya escritas (sin tocar las pólizas). Lectura por origen ya usa la tabla nueva.

### Fase compat-2: migración de la ruta (feature flag por empresa/módulo)
- Con flag **off** → ruta actual (INSERT directo). Con flag **on** → la UI llama `generateVoucher`/`postVoucher`
  (RPC); deja de insertar directo. **Nunca ambas** (sin doble escritura).
- FacturaCheck y BancoCheck migran **independientemente** (flags separados).

### Fase compat-3: retiro del INSERT directo
- Cuando el flag está on para todas las empresas y hay regresión verde, se retira el código de INSERT directo
  del cliente. (Fase posterior, no C2B.)

**Regresión/rollback:** apagar el flag revierte a la ruta actual (el esquema ampliado es compatible). Ninguna
columna nueva es requerida por el camino viejo.

## 3. Piloto técnico BancoCheck — alcance mínimo (§20)
| Caso | Acción ContaCheck |
|---|---|
| Comisión `bank_fee` | `generateVoucher` (origen banco) + split IVA regla |
| Interés / impuesto | `generateVoucher` (origen banco) |
| Movimiento directo clasificado | `generateVoucher` |
| Transferencia interna | `generateVoucher` (TRANSFER, sin resultado) |
| Pago de gasto / cobro / nómina | `linkBankTransaction` + conciliar (**no** origina) |
| No identificado | queda sin póliza hasta clasificar (`pending_configuration`) |
- VoBo: gate de `bancocheck_approve_suggestion` (`20260712050000`). Idempotencia por `unique_hash` del
  movimiento (`20260712010000:29-31`) → `idempotency_key`.

## 4. Piloto funcional GastoCheck — alcance mínimo (§21)
Máquina real (`status.ts`): `captured → pending_auth → authorized → invoice_applied/closed_in_policy`.
- **`authorized`** dispara `gasto_autorizado` → reconocimiento (no se añade estado a `expenses`).
- `invoice_applied` → reclasificación CFDI. `closed_in_policy` → aplicación de anticipo/cierre.
- `accounts_payable.paid` → pago + `linkBankTransaction`. `rejected/deleted` → `reverseVoucher`.
- Correlación `expenses`↔`accounts_payable` vía `accounting_source_links` (no hay FK hoy, `20260624000001`).

## 5. Riesgos de compatibilidad y mitigación
| Riesgo | Mitigación |
|---|---|
| Doble escritura (viejo + nuevo) | flag excluyente; prueba que verifica 1 sola póliza por hecho |
| Colisión `voucher_number` global durante transición | numeración compuesta + folio solo al postear |
| `entries` JSONB vs líneas normalizadas divergentes | `entries` = snapshot; líneas = fuente; RPC llena ambas |
| Backfill de `source_ids` mal mapeado | `BACKFILL_REFERENCE_ONLY` (no contabiliza), revisión manual |
