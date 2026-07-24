# ContaCheck · C2A — Períodos Contables y Estados de Póliza

> §9 ejercicios/períodos; §10 máquina de estados de póliza. Especificación para C2B.

## 1. `accounting_fiscal_years` (§9) — NUEVA
`id, company_id FK RESTRICT, year integer NOT NULL, start_date date, end_date date, status text CHECK('open',
'soft_closed','closed','locked') DEFAULT 'open', closed_by uuid, closed_at timestamptz, created_at`.
`UNIQUE(company_id, year)`.

## 2. `accounting_periods` (§9) — NUEVA
`id, company_id FK RESTRICT, fiscal_year_id FK, fiscal_year integer, month smallint CHECK(1..12), start_date,
end_date, status text CHECK('open','soft_closed','closed','locked') DEFAULT 'open', closed_by, closed_at,
reopened_by, reopened_at, created_at`. `UNIQUE(company_id, fiscal_year, month)`.

### Qué permite cada estado
| Estado | Contabilizar (`post`) | Reversa | Ajuste | Reabrir |
|---|---|---|---|---|
| `open` | ✅ | ✅ | ✅ | — |
| `soft_closed` | ❌ nuevas; ✅ solo ajustes con capacidad | ✅ | ✅ (con `accounting.post` + flag) | ✅ `accounting.reopen_period` |
| `closed` | ❌ | reversa **se contabiliza en período abierto** | ❌ | ✅ solo `accounting.admin` |
| `locked` | ❌ | ❌ (reversa va a período abierto) | ❌ | ❌ (definitivo) |

### Reglas (§9)
- **Ajustes en período cerrado:** no se tocan; se registran en el período abierto actual (póliza de ajuste con
  `accounting_date` en período abierto y `reference` al original).
- **Reversa con período original cerrado/locked:** la reversa toma `accounting_date` del período **abierto**
  (ver `accounting_reverse_voucher`, doc Orígenes §3).
- **Quién reabre:** `soft_closed`→`open` con `accounting.reopen_period`; `closed`→`open` solo `accounting.admin`
  con auditoría; `locked` no reabre.
- **Control RLS/RPC:** el cierre/apertura es vía RPC (`accounting_close_period`/`accounting_reopen_period`,
  SECURITY DEFINER) que verifica capacidad + escribe `audit_logs`; `post` valida el estado del período dentro de
  la transacción.

## 3. Máquina de estados de póliza (§10)
`accounting_vouchers.status` hoy: `draft/exported/reconciled` (`20260705130000:86`). Se **amplía sin duplicar**:
`draft` ≈ `generated`; `exported`/`reconciled` se conservan como sub-estados post-`posted` (compatibilidad con
los 2 writers actuales que insertan `draft`/marcan `exported`).

Ciclo objetivo: `generated → validated → pending_configuration | pending_review → approved → posted → reversed`,
más `rejected`.

### Tabla de transiciones
| Estado origen | Acción | Estado destino | Capacidad requerida |
|---|---|---|---|
| — | generar | `generated` (alias de `draft`) | `accounting.generate` |
| `generated` | validar | `validated` | `accounting.generate` (o motor) |
| `validated` | (falta config/cuenta/regla) | `pending_configuration` | (automático) |
| `validated` | (importe extraordinario / IA baja) | `pending_review` | (automático) |
| `pending_configuration` | reconfigurar+revalidar | `validated` | `accounting.configure` |
| `validated`/`pending_review` | solicitar revisión | `pending_review` | `accounting.generate` |
| `pending_review` | aprobar | `approved` | `accounting.approve` |
| `pending_review`/`validated` | rechazar | `rejected` | `accounting.approve` |
| `approved` | contabilizar | `posted` | `accounting.post` (≠ approve: segregación) |
| `posted` | solicitar reversa | (crea reversa) | `accounting.reverse` |
| `posted` | — | `reversed` (marca al ser revertida) | — |

**Reglas duras:**
- `posted` **inmutable**: sin UPDATE de líneas/importes (RLS sin UPDATE + trigger que rechaza cambios salvo el
  set controlado `reversed_by_voucher_id`/`exported_*`).
- **Segregación:** `accounting.approve` y `accounting.post` deben ser capacidades distintas; quien genera no
  aprueba (patrón `nomi_payroll_approval_guard`, `20260722210000:525-542`).
- `rejected` es terminal (se genera póliza nueva si se corrige).
- Transición controlada por RPC (`accounting_*_voucher`), nunca por UPDATE libre del cliente.

### Mapeo de compatibilidad
| Actual (`20260705130000:86`) | Objetivo |
|---|---|
| `draft` | `generated` |
| (nuevo) | `validated`,`pending_configuration`,`pending_review`,`approved` |
| `posted` (nuevo) | `posted` |
| `exported` | sub-marca de `posted` (exportada a CONTPAQi/…) |
| `reconciled` | sub-marca de `posted` (conciliada con banco) |
No se elimina ningún estado existente; se añaden los faltantes (aditivo).
