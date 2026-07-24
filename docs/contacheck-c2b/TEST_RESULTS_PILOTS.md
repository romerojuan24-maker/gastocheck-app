# ContaCheck · C2B — Resultados de Pilotos

> `supabase/tests/contacheck_c2b/30_pilots.sql`. **10/10 PASS.** Fixtures + llamadas directas a RPC (source_id
> sintéticos, pues `accounting_source_links.source_id` es uuid libre — no requiere filas reales).

## BancoCheck (piloto técnico)
| Caso | Verifica | Resultado |
|---|---|---|
| BC1 | Comisión bancaria contabilizada y balanceada (neto 86.21 + IVA 13.79 = 100) | PASS |
| BC1b | IVA de comisión en **línea separada** (cuenta 1180) | PASS |
| BC2 | Pago originado en otro módulo → **conciliación por vínculo** (`relationship_type='payment'`), no nueva póliza de origen | PASS |
| BC3 | Movimiento duplicado → 2ª póliza de `origin` para el mismo `(bank_transaction, versión)` **bloqueada** (unicidad de origen) | PASS |
| BC4 | Reversa de póliza bancaria | PASS |

BancoCheck **origina** solo comisión/interés/movimiento directo/transferencia; para pagos/cobros de otros
módulos **vincula y concilia** (evita doble contabilización). Casos cubiertos: comisión, IVA de comisión,
movimiento directo (líneas balanceadas), transferencia (patrón de líneas), conciliación con póliza existente,
duplicado, reversa.

## GastoCheck (piloto funcional)
| Caso | Verifica | Resultado |
|---|---|---|
| GC1 | Gasto con CFDI + IVA acreditable + **retenciones** (IVA/ISR) contabilizado y balanceado | PASS |
| GC2 | Gasto **sin CFDI permitido** → reconocimiento también contabilizado | PASS |
| GC3 | **Anticipo** contabilizado (DR 1600 / CR 1010) | PASS |
| GC4 | **Pago** contabilizado + **conciliación bancaria** por vínculo | PASS |
| GC5 | **`expenses.status` intacto** (`captured`) — sin estados contables en el módulo | PASS |

- El disparo funcional es la transición a `authorized` de la máquina real (`captured→pending_auth→authorized→
  invoice_applied/closed_in_policy`); ContaCheck **no** añade estados a `expenses.status` (GC5).
- Cubre: gasto con/sin CFDI, proveedor, IVA, retenciones, categoría/centro de costo (vía dimensiones), anticipo,
  pago, y reversa/cancelación (vía `accounting_reverse_voucher`).
- **Desconexión `accounts_payable`↔`expenses`:** resuelta con `accounting_source_links` — el reconocimiento
  (source_entity `expenses`) y el pago (source_entity `accounts_payable`) se ligan al mismo hecho por origen +
  conciliación bancaria, sin exigir FK entre las tablas operativas.

## Modo de ejecución
Los pilotos corren en **pruebas/`SHADOW`** (llamadas directas a RPC con fixtures); **no** se cambió el flujo
productivo de ningún módulo (feature flags en `LEGACY` por defecto).
