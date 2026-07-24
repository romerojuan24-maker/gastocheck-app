# ContaCheck · C2A — Plan de Migraciones para C2B

> §23 orden exacto de migraciones; §22 backfill. C2B escribe cada bloque en este orden, sin re-decidir.

## 1. Backfill (§22) — clasificación
**Regla:** NO contabilizar automáticamente el histórico. Por tipo de dato:

| Dato | Clase de backfill | Razón |
|---|---|---|
| Pólizas existentes en `accounting_vouchers` (2 writers) | `BACKFILL_REFERENCE_ONLY` | crear `accounting_source_links` desde `source_ids`; no re-postear |
| Gastos `authorized`/`closed_in_policy` históricos | `NO_BACKFILL` (o `MANUAL_REVIEW` selectivo) | contabilizar el pasado sería masivo/riesgoso; solo nuevos desde el flag |
| Movimientos bancarios clasificados | `NO_BACKFILL` | idem; se concilian hacia adelante |
| Facturas (`cfdi_documents`/`cobra_invoices`) | `NO_BACKFILL` | idem |
| Períodos ya cerrados operativamente | `NO_BACKFILL` | no reabrir; arranque en período abierto |
| Datos incompletos (sin cuenta/RFC) | `MANUAL_REVIEW` | requieren configuración antes de contabilizar |
| Cuentas hardcodeadas en generadores | `MANUAL_REVIEW` | migrar a catálogo/reglas antes de reusar |
| `accounting_accounts_v2` con filas (si existieran en prod) | `BACKFILL_REFERENCE_ONLY` → v1 por `(company_id,code)` | portar semántica fiscal, no borrar v2 |

`BACKFILL_POSTED_VOUCHER` **no se usa** en C2B (nada del histórico se marca contabilizado automáticamente).

## 2. Orden exacto de migraciones (§23)
Cada bloque: dependencia · rollback · riesgo · prueba. Todo aditivo; **cero DROP**.

| # | Bloque | Dependencia | Rollback | Riesgo | Prueba clave |
|---|---|---|---|---|---|
| 1 | **Capacidades** (`accounting_capabilities`/`role_`/`user_` + `accounting_can()`) | ninguna | DROP tablas/func | bajo | `accounting_can` por rol; RLS base |
| 2 | **Períodos** (`accounting_fiscal_years`, `accounting_periods` + RPC open/close) | 1 | DROP | bajo | estados período; reabrir con capacidad |
| 3 | **Catálogo** (ALTER `accounting_accounts` +cols; `is_postable`, `nature`, `sat_grouping_code`, defaults) | 1 | DROP COLUMN (NULL) | bajo (colisión `account_type`→`account_type_norm`) | v1 sigue con 9 consumidores sin regresión |
| 4 | **Parties** (`parties`, `party_links`) | 1 | DROP | medio (dedup) | dedup RFC/nombre; genérico; RLS |
| 5 | **Perfil fiscal** (`company_tax_profiles`) | 1 | DROP | bajo | 1 activo vigente; snapshot |
| 6 | **Ampliación pólizas** (ALTER `accounting_vouchers` +encabezado; `accounting_voucher_sequences`) | 1,2,4,5 | DROP COLUMN (NULL) | medio (numeración) | 2 writers actuales intactos; folio por empresa |
| 7 | **Líneas** (`accounting_voucher_lines` + CHECK cargo/abono + trigger diferible balance) | 6,3,4 | DROP | medio | balance; cargo XOR abono; inmutabilidad posted |
| 8 | **Orígenes** (`accounting_source_links`) | 6 | DROP | bajo | multi-origen; UNIQUE origin; backfill ref-only |
| 9 | **Dimensiones** (`accounting_line_dimensions` + cols calientes) | 7 | DROP | bajo | balanza por dimensión; obligatoriedad |
| 10 | **Reglas** (`accounting_rules`/`_versions`/`_conditions`/`_outputs` + simulador) | 3 | DROP | medio | resolución; ambigua→config; publicar inválida bloqueada |
| 11 | **Idempotencia** (`accounting_vouchers.idempotency_key` UNIQUE por empresa + `accounting_idempotency_requests`) | 6 | DROP col/tabla | medio | doble clic; conflicto payload; 2 conexiones |
| 12 | **RPC** (`generate/validate/approve/post/reverse/link/resolve` SECURITY DEFINER) | 6-11 | DROP funciones | alto | máquina de estados; segregación; período |
| 13 | **RLS** (políticas por tabla + grants + REVOKE public/anon) | 1-12 | restaurar políticas | alto | aislamiento multiempresa; sin DELETE |
| 14 | **Compatibilidad** (feature flags; backfill `source_links` ref-only) | 8,12 | flags off | medio | rutas actuales intactas; sin doble escritura |
| 15 | **Piloto BancoCheck** (adaptador vía flag) | 12,13,14 | flag off | medio | comisión/interés origina; pago concilia; no duplica |
| 16 | **Piloto GastoCheck** (adaptador `authorized` vía flag) | 12,13,14 | flag off | medio | reconocimiento; impuestos líneas; pago concilia; reversa |

**Retiro de legado** (`accounting_accounts_v2`, `accounting_entries`, `generate_accounting_entries`,
`export_policy_*`, `voucher_number` UNIQUE global): **fase separada posterior**, no en este orden, tras 0
dependencias + verificación prod.

## 3. Gate previo a C2B (§3 drift)
Verificar en prod (información real, no `schema_migrations`): filas en `accounting_accounts_v2`; existencia de
`cobra_collections`/`cobra_commissions` (migración revertida `20260708000001:4-10`); FK `expenses`→v1;
`accounting_vouchers` esquema `20260705130000`. Documentar como precondición de la Etapa 1.

## 4. Rollback global
Bloques 1–11 = DROP de objetos nuevos / columnas NULL (sin pérdida de datos operativos). 12–16 = DROP de
funciones / flags off. Ninguna migración de C2B borra o altera destructivamente objetos existentes.
