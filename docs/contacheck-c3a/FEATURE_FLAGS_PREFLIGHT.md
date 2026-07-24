# ContaCheck · C3A — Feature Flags Preflight (§12)

> No se modificó ningún flag (no existe infraestructura de flags contables en prod todavía).

## Estado en prod (evidencia)
- **`accounting_feature_flags`: AUSENTE en prod** (probe 404). La infraestructura de flags de ContaCheck la crea
  el **bloque 16 de C2B**; hoy no existe en producción.
- Por tanto, **no hay** almacenamiento de flags, ni valores por defecto, ni soporte para `LEGACY`/`SHADOW`/
  `CONTACHECK` en prod actualmente.

## Diseño (que introduce C2B)
- Tabla `accounting_feature_flags(company_id, module, mode, updated_by, updated_at)` con
  `CHECK (mode in ('LEGACY','SHADOW','CONTACHECK'))`, PK `(company_id, module)`.
- Función `accounting_flag_mode(company, module)` → **default `LEGACY`** cuando no hay fila (comportamiento seguro:
  se comporta como hoy).
- `accounting_set_flag(company, module, mode)` requiere `accounting.admin`, escribe `audit_logs`. Activación y
  reversión **por empresa/módulo** (nunca global).

## Comportamiento cuando el flag no existe
Tras desplegar C2B, cualquier empresa sin fila → `accounting_flag_mode` retorna `LEGACY` → los 2 writers actuales
siguen funcionando igual. **Ninguna empresa queda en `CONTACHECK` por defecto.**

## Preflight
| Control | Resultado |
|---|---|
| ¿Existe infra de flags en prod? | **No** (la crea C2B) |
| Default seguro (`LEGACY`) al ausente | ✅ por diseño |
| Activación/reversión por empresa | ✅ por diseño |
| Auditoría de cambios de flag | ✅ (`audit_logs`) |
| Riesgo de activación global accidental | **Nulo** (no hay set global; default LEGACY) |

## Acción
Ninguna en prod ahora (solo lectura). Tras desplegar C2B, **verificar** que `accounting_flag_mode` devuelve
`LEGACY` para las 6 empresas antes de activar `SHADOW` en el piloto (BancoCheck), empresa por empresa.
