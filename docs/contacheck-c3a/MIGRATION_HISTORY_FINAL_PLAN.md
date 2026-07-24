# ContaCheck · C3A.2 — Plan final de reconciliación del historial (§7)

> Completa `MIGRATION_HISTORY_RECONCILIATION.md` (C3A.1) con la clasificación de acción y un procedimiento para
> volver a usar despliegues automatizados sin arrastrar el drift. **No se insertó nada en el historial; no se usó
> `migration repair`.**

## Clasificación de acción por migración no registrada
| Migración | Intención | Objetos reales en prod | Equivalencia | Riesgo reaplicar | **Acción** |
|---|---|---|---|---|---|
| 20260708000001 cobracheck_complete_impl | cobra_collections/commissions/routes | **ausentes** | inexistente | — | **OBSOLETA** (revertida; no reaplicar) |
| 20260708000002 flujocheck_complete_impl | flujo_* esqueleto | prob. ausentes | por confirmar (`03`) | bajo | **OBSOLETA/PENDIENTE** (confirmar) |
| 20260708000003 inventariocheck_complete_impl | inv_* (descartado) | prob. ausentes | inexistente | — | **OBSOLETA** |
| 20260715000000 wave6_wave8_schema | varias | por confirmar | por confirmar | medio | **PENDIENTE** (auditar `03`) |
| 20260715100000 signal_triggers | business_signals + triggers | por confirmar | por confirmar | medio | **PENDIENTE** (auditar `06`) |
| 20260719000000 fix_rls_contador_general_view_all | políticas RLS | prob. aplicadas a mano | por confirmar | medio | **REPARACIÓN DE HISTORIAL** (si equivalen) |
| 20260720100000 fix_cobracheck_field_flow | triggers/func cobra | por confirmar | por confirmar | medio | **PENDIENTE** (`06`) |
| 20260720120000 fix_organization_modules | organization_modules | por confirmar | por confirmar | bajo | **PENDIENTE** (`03`) |
| 20260720130000 fix_rls_advances_viaticos_contador | políticas RLS | prob. aplicadas a mano | por confirmar | medio | **REPARACIÓN DE HISTORIAL** (si equivalen) |
| **20260721100000 bancocheck_clasificacion_contable** | cols/índices/FK/RPC banco | **cols presentes; resto por confirmar** | **PARCIAL** | **ALTO si se reaplica** | **MIGRACIÓN DE RECONCILIACIÓN** (crear solo lo faltante) + reparar historial |
| 20260722100000 cfdi_sellos_timbrado | cfdi_documents sellos | por confirmar | por confirmar | medio | **PENDIENTE** (`03`) |

## Procedimiento para re-habilitar despliegues automatizados (housekeeping, separado de C2B)
1. **Auditar** con `scripts/contacheck-c3a/03/06/07` qué objetos de cada migración existen realmente en prod.
2. Por cada migración:
   - Si **equivale** al esquema real → `supabase migration repair --status applied <version>` (marca aplicada sin
     re-ejecutar). *(Reparación de historial.)*
   - Si es **obsoleta/revertida** → `supabase migration repair --status reverted <version>` **o** retirar el
     archivo del árbol (decisión de housekeeping).
   - Si es **parcial** (p.ej. `20260721100000`) → escribir una **migración de reconciliación** con solo lo
     faltante (comparando definición; `IF NOT EXISTS`), aplicarla, y luego `repair --status applied` de la original.
   - Si es **incompatible** → no marcar; resolver caso por caso.
3. Tras reconciliar, `supabase migration list --linked` debe mostrar `local == remote` sin huecos → **entonces
   `supabase db push` vuelve a ser seguro** para futuros despliegues.

## Regla dura para C2B (ahora)
**No** ejecutar el housekeeping como parte de C3B. C2B se aplica **aislado** (paquete `deploy/contacheck-c3b/`),
**sin** `db push`. El housekeeping del historial es un trabajo **posterior e independiente**, con su propia
revisión, para no bloquear C2B ni arriesgar el drift en el mismo cambio.

## Restricciones respetadas
No se insertaron filas en `schema_migrations`; no se usó `migration repair` de forma indiscriminada; el plan lo
ejecuta Juan con revisión por migración.
