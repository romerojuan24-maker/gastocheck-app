# ContaCheck · C3A — Functions & Triggers Audit (§7, §8)

> Inventario de funciones y triggers sobre tablas afectadas. **Limitación de método:** PostgREST no lista
> funciones de forma fiable (un `rpc/x` con `{}` da 404 tanto si la función no existe como si no tiene overload
> sin argumentos). Por eso el inventario fino **requiere** `scripts/contacheck-c3a/06`.

## Colisión de nombres de función (C2B crea 30 `accounting_*`)
- **Inconcluso vía PostgREST.** Los probes `rpc/accounting_can`, `rpc/accounting_generate_voucher`, etc.
  devolvieron 404 — pero también lo hicieron `rpc/nomi_can` y `rpc/generate_accounting_entries`, que **sí
  existen** en prod. Por tanto el 404 **no** prueba ausencia.
- **Evidencia indirecta (código):** antes de C2B no existían funciones con prefijo `accounting_` (las contables
  previas se llaman `generate_accounting_entries`, `export_policy_*`, `validate_cfdi_with_sat`). → Colisión de
  nombres **improbable**, pero **debe confirmarse** con `06` (sección "COLISIÓN": `ya_existe_en_prod` debe ser 0
  para los 23+ nombres C2B).

## Funciones contables existentes en prod (a inventariar con `06`)
Esperadas por migraciones aplicadas: `generate_accounting_entries`, `export_policy_contpaqui`,
`export_policy_json`, `validate_cfdi_with_sat` (de `20260623000001`), y las `nomi_*` (de `20260722210000`, ~12
funciones incl. `nomi_can`, `nomi_blind_hash`, `nomi_approve_payroll`). `06` reporta firma, owner, `SECURITY
DEFINER`, `search_path` y grants EXECUTE de cada una.

## Triggers sobre tablas afectadas (a inventariar con `06`)
- **Riesgo a descartar:** un **guard de inmutabilidad en prod distinto al probado localmente** sobre
  `accounting_vouchers`. Con 0 filas y sin columnas C2B, es improbable que exista uno de ContaCheck, pero `06`
  debe listar todos los triggers de `accounting_vouchers`, `accounting_accounts(_v2)`, `expenses`,
  `bank_transactions` y confirmar que ninguno bloquee `ALTER`/`ADD COLUMN` ni altere datos inesperadamente.
- `accounting_accounts_v2` podría tener el trigger de auditoría de v2 solo tras C2B (bloque 3) — hoy no debería
  existir.

## Endurecimiento de las funciones C2B (referencia)
Las 30 funciones C2B son `SECURITY DEFINER` con `SET search_path = pg_catalog, public` y `REVOKE EXECUTE FROM
public, anon`. `06` permite comparar que no haya funciones homónimas en prod con `search_path` laxo o grants a
`public`.

## Pendiente
Ejecutar `06` y pegar: (a) tabla de colisión (todo 0), (b) inventario de funciones con definer/search_path/grants,
(c) triggers de las 5 tablas. Sin esto, este control queda **WARNING (no verificado)**, no PASS.
