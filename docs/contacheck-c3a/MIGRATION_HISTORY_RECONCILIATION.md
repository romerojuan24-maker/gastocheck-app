# ContaCheck · C3A.1 — Reconciliación del historial de migraciones (§4)

> Matriz de migraciones locales **no registradas** en prod. **No se insertó** ningún registro en el historial, no
> se marcó nada como aplicado, no se ejecutó reparación automática.

## Matriz (evidencia: `supabase migration list --linked` + probes PostgREST)
| Timestamp | Nombre | Objetos que debería crear | ¿Presentes en prod? | Equivalencia | Clasificación | Riesgo de reaplicación | Acción recomendada |
|---|---|---|---|---|---|---|---|
| 20260708000001 | cobracheck_complete_impl | cobra_collections, cobra_commissions, cobra_routes | **NO** (404) | inexistente | **NO APLICADA / revertida** | — (no reaplicar; ya marcada reverted en tracker) | Dejar fuera; housekeeping aparte |
| 20260708000002 | flujocheck_complete_impl | flujo_* (esqueleto) | por confirmar (probable NO) | por confirmar | **NO APLICADA (prob.)** | bajo (esqueleto sin uso) | Verificar con `03`; housekeeping |
| 20260708000003 | inventariocheck_complete_impl | inv_* (esquema descartado) | por confirmar (probable NO) | inexistente | **OBSOLETA** | — | No reaplicar; descartada por diseño |
| 20260715000000 | wave6_wave8_schema | (varias) | por confirmar | por confirmar | **por confirmar** | medio | Verificar `03`; decidir en housekeeping |
| 20260715100000 | signal_triggers | business_signals + triggers (cobra) | por confirmar | por confirmar | **por confirmar** | medio (triggers) | Verificar `06` |
| 20260719000000 | fix_rls_contador_general_view_all | políticas RLS | por confirmar | por confirmar | **prob. APLICADA A MANO** | medio (RLS) | Verificar `07` |
| 20260720100000 | fix_cobracheck_field_flow | triggers/func cobra | por confirmar | por confirmar | **por confirmar** | medio | Verificar `06` |
| 20260720120000 | fix_organization_modules | organization_modules | por confirmar | por confirmar | **por confirmar** | bajo | Verificar `03` |
| 20260720130000 | fix_rls_advances_viaticos_contador | políticas RLS | por confirmar | por confirmar | **prob. APLICADA A MANO** | medio (RLS) | Verificar `07` |
| **20260721100000** | **bancocheck_clasificacion_contable** | `bank_transactions.accounting_account_id`/`linked_client_id`/`linked_supplier_id`, índices, RPC `bancocheck_classify` 9-arg | **SÍ (columnas presentes, uuid)** | **parcial (columnas ✓; resto por verificar)** | **APLICADA MANUALMENTE NO REGISTRADA** | **ALTO si se reaplica** (columnas ya existen → error/no-op) | **No reaplicar**; ver `BANCHECK_MIGRATION_EQUIVALENCE.md` |
| 20260722100000 | cfdi_sellos_timbrado | `cfdi_documents` sellos/cadena/QR | por confirmar | por confirmar | **por confirmar** | medio | Verificar `03` |

## Implicación para C2B (lo que importa AHORA)
**Ninguna de estas migraciones es dependencia de C2B.** C2B solo depende de `accounting_accounts`,
`accounting_vouchers`, `companies`, `company_members`, `audit_logs`, `cost_centers`, enum `member_role` y los
`auth_*` helpers — **todos presentes** en prod. Por tanto, la reconciliación del ledger **no bloquea** C2B **si** se
despliega en aislamiento.

## Plan de reconciliación
- **Para C2B (recomendado): Opción A — aplicar C2B en aislamiento** (paquete `deploy/contacheck-c3b/`, `psql -f`),
  **ignorando el ledger**. C2B no toca estas 11 migraciones. Menor riesgo.
- **Housekeeping del ledger (tarea separada, NO parte de C3B): Opción B** — auditar con `03/06/07` qué objetos de
  cada migración existen realmente y luego usar `supabase migration repair --status applied/reverted <version>`
  para reconciliar el ledger con la realidad. **Mayor riesgo, no urgente, no requerido por C2B.**
- **No usar `supabase db push` para C2B** — arrastraría estas 11 (incl. `20260721100000`, que fallaría).

## Nota
La reconciliación completa (Opción B) debe hacerse **antes** de volver a confiar en `db push` para cualquier
despliegue futuro, pero es independiente de este gate.
