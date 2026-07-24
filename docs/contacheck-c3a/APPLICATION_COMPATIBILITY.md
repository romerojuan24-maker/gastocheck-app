# ContaCheck · C3A — Application Compatibility (§11)

> Consumidores de `accounting_vouchers`/`accounting_accounts`/`voucher_number` en el repo y su compatibilidad con
> el esquema ampliado de C2B. Grep sobre `apps/` (11 archivos).

## Escritores de `accounting_vouchers` (los 2 writers legacy)
| Archivo:línea | Operación | ¿Provee `voucher_number`? | Compat con C2B |
|---|---|---|---|
| `apps/web/app/(dashboard)/bancocheck/conciliacion/page.tsx:187` | INSERT `status:'draft'` | **Sí** | ✅ nullable no lo rompe; columnas nuevas son NULL-able |
| `apps/mobile/app/facturacheck/hooks/useFacturaCheck.ts:423` | INSERT + dedupe `source_ids` (`:381`) | **Sí** | ✅ igual |

**Ninguno asume `voucher_number NOT NULL` de forma que se rompa** — ambos lo **proveen** en el INSERT. Hacerlo
nullable en C2B **no** afecta estos flujos. Las columnas nuevas son aditivas → los INSERT con lista explícita
siguen válidos; un `SELECT` que traiga más columnas es inocuo para lectura.

## Consumidores de `accounting_accounts` (catálogo v1)
`catalogo-cuentas.tsx`, `catalogo-import-modal.tsx`, `polizas.tsx`, `bancocheck/components/ClassifyModal.tsx`,
`supervisor.tsx`, `supervisor/reembolsos/index.tsx`, `apps/web/.../gastocheck/polizas/page.tsx`,
`apps/mobile/app/shared/integrations.ts` — todos leen/escriben **v1**. C2B **solo agrega columnas** a v1 → sin
ruptura.

## Riesgos a revisar (checklist §11)
| Ítem | Estado |
|---|---|
| `SELECT *` sobre `accounting_vouchers` | Revisar en los 2 writers; aunque exista, columnas nuevas son inocuas en lectura |
| `INSERT` sin lista de columnas | Los 2 writers usan lista explícita (evidencia de dedupe/campos) → OK |
| Tipos TypeScript desactualizados | Al agregar columnas, los tipos TS de `accounting_vouchers` quedarán **incompletos** (no rotos). Regenerar tipos tras desplegar C2B (no bloqueante en modo LEGACY) |
| ORM/Prisma | El repo usa el cliente supabase-js, no Prisma → sin schema.prisma que reconciliar |
| Validaciones que asuman `voucher_number NOT NULL` | No detectadas en los writers (lo proveen) |
| Enums incompatibles | CHECK de status/type se **amplía** → valores actuales siguen válidos |
| Rutas legacy / cron / Edge Functions / webhooks | Ninguna Edge Function escribe `accounting_vouchers` (grep previo = 0); sin cron contable |
| Reportes/exportaciones | Export de pólizas actual usa `receipts`/`policies`, no depende de las columnas nuevas |

## Modo de operación tras C2B
C2B deja los **feature flags en `LEGACY` por defecto** → estos 2 writers **siguen insertando directo** sin cambio
de comportamiento. La migración a RPC (`SHADOW`/`CONTACHECK`) es opt-in por empresa (fase posterior). **No hay
ruptura de frontend** por desplegar el esquema C2B.

## Veredicto de compatibilidad de aplicación
**PASS** para el despliegue de esquema en modo LEGACY. Acción no bloqueante: **regenerar tipos TS** de
`accounting_vouchers`/`accounting_accounts` tras aplicar C2B para reflejar las columnas nuevas.
