# ContaCheck · C3A.1 — Resultados de scripts pendientes (§2)

> Qué quedó **confirmado** vía PostgREST/OpenAPI (read-only, sin superusuario) y qué **requiere** ejecutar
> `scripts/contacheck-c3a/05,06,07` en una sesión autenticada (SQL Editor de Juan o rol de solo lectura).
> **No se fabricó** ningún resultado de catálogo.

## Por qué no los ejecuté yo
Los scripts consultan `pg_catalog`/`information_schema`, que **PostgREST no expone**. La única vía era conectar
como `postgres` (superusuario) vía el pooler — que **bypassa RLS** y no es "restringida a lectura". Por seguridad
y por el espíritu del gate, **se delegan** a Juan. Son 100% read-only, idempotentes, sin DDL/DML.

## Ya confirmado (evidencia de esta sesión)
| Ítem | Resultado | Fuente |
|---|---|---|
| Existencia de tablas base/contables | v1(301), v2(0), vouchers(0), deps core presentes; 18 tablas C2B ausentes; cobra_collections/commissions ausentes | PostgREST |
| `accounting_vouchers` = 15 cols originales, sin cols C2B | Confirmado | PostgREST + OpenAPI |
| `bank_transactions` tiene `accounting_account_id`/`linked_client_id`/`linked_supplier_id` (uuid) | Confirmado (tipos correctos) | OpenAPI |
| `voucher_number` = character varying | Confirmado | OpenAPI |
| Volúmenes | 6 empresas, 18 expenses, 6 bank_txn, 10 cobra_inv, 0 pólizas, 0 v2 | PostgREST count |

## PENDIENTE — ejecutar `05` (catálogo y constraints)
- [ ] Códigos duplicados por empresa en v1 (esperado 0).
- [ ] Cuentas activas/inactivas; jerarquías huérfanas (`parent_code` inexistente).
- [ ] **FK real de `expenses.accounting_account_id` → v1 o v2** (crítico; local = v1).

## PENDIENTE — ejecutar `06` (funciones y triggers)
- [ ] **Colisión de nombres**: `ya_existe_en_prod` = 0 para los 23 nombres `accounting_*` de C2B (esperado 0;
      inconcluso por PostgREST — un `rpc` con `{}` da 404 aun si la función existe).
- [ ] Inventario de funciones contables existentes (`generate_accounting_entries`, `export_policy_*`,
      `validate_cfdi_with_sat`, `nomi_*`): firma, owner, SECURITY DEFINER, `search_path`, grants EXECUTE.
- [ ] Triggers en `accounting_vouchers`/`accounting_accounts(_v2)`/`expenses`/`bank_transactions` → descartar un
      **guard de inmutabilidad en prod distinto al probado localmente**.

## PENDIENTE — ejecutar `07` (RLS, políticas, owners, grants)
- [ ] RLS habilitado/forzado por tabla; políticas USING/WITH CHECK/roles.
- [ ] **Políticas más permisivas que las probadas** / duplicadas / contradictorias.
- [ ] Grants directos a `anon`/`authenticated` (ningún `DELETE`/`ALL` inesperado).
- [ ] Vistas `SECURITY DEFINER` (p.ej. `nomi_cashflow_commitments` → confirmar `security_invoker=on`).

## Plantilla de captura (pegar salida real aquí)
```
-- 05: expenses FK →  __________ (v1/v2)   | duplicados: __  | huérfanas: __
-- 06: colisiones accounting_* → __ (esperado 0) | triggers inesperados: __
-- 07: políticas más permisivas: __ | grants anon/auth DELETE: __ | vistas SECURITY DEFINER bypass: __
```

**Hasta pegar estos resultados con PASS, los controles de funciones/triggers/constraints/RLS quedan WARNING, no
PASS** — condición del veredicto (ver `UPDATED_GO_NO_GO.md`).
