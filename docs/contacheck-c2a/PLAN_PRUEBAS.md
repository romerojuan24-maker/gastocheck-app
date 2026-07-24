# ContaCheck · C2A — Plan de Pruebas

> §24 casos concretos, incluidas 2 conexiones concurrentes. Para ejecutar en C2B tras cada bloque.

## 1. Migración / esquema
- Aplicar bloques 1–16 en orden sobre copia; verificar 0 errores y que los 2 writers actuales
  (`conciliacion/page.tsx:187`, `useFacturaCheck.ts:423`) siguen insertando sin regresión.
- Rollback de cada bloque (DROP) deja el esquema previo idéntico.

## 2. RLS / multiempresa
- Usuario empresa A no ve/edita pólizas, líneas, períodos, parties ni reglas de empresa B (todas las tablas).
- `accounting_can()` devuelve correcto por rol (owner/contador_general/accountant/admin/otros).
- `authenticated` sin capacidad no ejecuta RPC (REVOKE public/anon efectivo).

## 3. Reglas
- Regla única específica → aplica. **Dos reglas igual specificity+priority → `pending_configuration`** (no
  adivina). Sin regla → `is_default` o `pending_configuration`. Publicar regla con cuenta inactiva/sin balance →
  rechazada. Versión publicada inmutable; cambio = versión nueva; póliza conserva `rule_version_id`.

## 4. Balance / líneas
- `Σdebit=Σcredit` por RPC + CHECK + trigger diferible. Línea con debit y credit ambos > 0 → rechazada
  (CHECK cargo XOR abono). Importe negativo → rechazado. `UNIQUE(voucher_id,line_number)`.

## 5. Idempotencia (incluye 2 conexiones)
- 1ª solicitud crea; misma llave+payload → devuelve el mismo `voucher_id`; misma llave, payload distinto →
  `409 CONFLICT`. **2 conexiones concurrentes** con la misma `idempotency_key` → exactamente **1** póliza (la
  otra recibe conflicto/espera por UNIQUE a nivel BD, no chequeo app).
- Pagos parciales (distinto `source_version`) → múltiples pólizas legítimas.

## 6. Concurrencia (2 conexiones)
- Dos `postVoucher` sobre la misma póliza `approved` → uno postea, el otro `VERSION_CONFLICT` (optimistic lock
  `version`).
- Dos asignaciones de folio simultáneas (misma empresa/año/tipo) → folios consecutivos, sin colisión (lock de
  secuencia).

## 7. Numeración
- Folio solo al `posted`; propuesta descartada no consume folio. Unicidad `(company_id, fiscal_year,
  voucher_type, voucher_number)`. Empresas distintas pueden repetir número (no colisión global).

## 8. Períodos
- `post` en período `open` OK; en `closed`/`locked` → `PERIOD_NOT_OPEN`. Reversa con período original `closed`
  → se contabiliza en período abierto. Reabrir: `soft_closed` con `reopen_period`; `closed` solo `admin`;
  `locked` nunca.

## 9. Reversas
- `reverseVoucher` de `posted` → póliza espejo (debit↔credit), `reversed_by`/`reversal_of` seteados, folio nuevo,
  ambas `posted`. Reversa duplicada → bloqueada. Reversa de no-`posted` → error.

## 10. Inmutabilidad
- UPDATE/DELETE de líneas o importes de una póliza `posted` → rechazado (RLS + trigger). Solo cambios permitidos:
  `reversed_by_voucher_id`, `exported_*`.

## 11. Dimensiones
- Balanza por `cost_center`/`project`/agro correcta (join líneas↔dimensiones). Dimensión obligatoria por regla
  ausente → `CONFIGURATION_REQUIRED`. Referencia a `expense_tags` no duplica el tag.

## 12. Parties
- Dedup por `(company_id, rfc_normalized)`; fallback nombre; genérico sin unicidad. Fusión: pólizas `posted`
  conservan snapshot; deshacer fusión re-vincula. Empleado: solo `tax_id_hash`/`last4`, sin RFC en claro.

## 13. Perfil fiscal
- Un solo `active` vigente por empresa. Cambiar perfil no altera `tax_profile_snapshot` de pólizas históricas.
  CSD no se copia (permanece cifrado en `cfdi_provider_configs`).

## 14. BancoCheck (piloto técnico)
- Comisión/interés/directo/transferencia → póliza nueva. Pago/cobro de otro módulo → `linkBankTransaction`, **no**
  póliza de origen. Movimiento ya conciliado no genera 2ª póliza (idempotencia por `unique_hash`).

## 15. GastoCheck (piloto funcional)
- `authorized` → reconocimiento con IVA/retención como líneas (retenciones desde `receipts`). Sin `receipt_id` →
  regla decide si `pending_configuration`. `accounts_payable.paid` → pago + conciliación. `rejected` de gasto
  `posted` → reversa. No se añadió estado a `expenses.status`.

## 16. Compatibilidad
- Flag off → ruta actual intacta (INSERT directo). Flag on → RPC; **nunca ambas** (verificar 1 sola póliza por
  hecho). Backfill `source_links` ref-only no contabiliza.

## 17. Rollback
- Cada bloque revierte por DROP/flag sin pérdida de datos operativos ni contables previos.

## Matriz de cobertura
Toda fila del gate del §26 tiene ≥1 caso arriba: tablas/columnas/tipos (§1), RLS/capacidades (§2), reglas (§3),
balance/líneas (§4), idempotencia (§5), concurrencia (§6), numeración (§7), períodos (§8), reversas (§9),
inmutabilidad (§10), dimensiones (§11), parties (§12), fiscal (§13), pilotos (§14-15), compatibilidad (§16),
rollback (§17).
