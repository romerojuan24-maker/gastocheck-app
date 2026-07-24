# ContaCheck · C2A — Resumen Ejecutivo

> Especificación exacta y no destructiva de la infraestructura mínima. Solo lectura: sin migraciones, sin
> código, sin despliegue. Cada afirmación del repo con `archivo:línea`. Ref. §1–§26.

## 1. Qué entrega C2A
La especificación suficiente para que **C2B escriba las migraciones sin re-decidir arquitectura**: tablas,
columnas, tipos, constraints, índices, estados, RLS, capacidades, RPC, contratos de servicio, idempotencia,
reversas, períodos, numeración, reglas, dimensiones, parties, perfil fiscal, compatibilidad, pilotos, backfill,
rollback, pruebas y **orden exacto de 16 bloques**.

## 2. Objetos (aditivo, cero DROP en C2B)
- **ALTER aditivos:** `accounting_accounts` (+`nature`, `account_type_norm`, `is_postable`, `sat_grouping_code`,
  defaults fiscales); `accounting_vouchers` (+29 campos de encabezado, todos NULL-able/default).
- **Tablas nuevas:** `accounting_fiscal_years`, `accounting_periods`, `accounting_voucher_lines`,
  `accounting_voucher_sequences`, `accounting_source_links`, `accounting_line_dimensions`, `accounting_rules`
  (+`_versions`/`_conditions`/`_outputs`), `parties`, `party_links`, `company_tax_profiles`,
  `accounting_capabilities` (+`_role_`/`_user_`), `accounting_idempotency_requests`.
- **RPC SECURITY DEFINER:** `accounting_can`, `resolve_rules`, `generate/validate/approve/post/reverse_voucher`,
  `link_bank_transaction`, `open/close/reopen_period`, `simulate_rules`.

## 3. Decisiones exactas cerradas
- **Catálogo:** v1 autoritativo + columnas fiscales de v2 (`account_type_norm` para no pisar `account_type`
  libre `init:101`). v2 congelado, no borrado.
- **Numeración:** folio por `(company_id, fiscal_year, voucher_type, secuencia)`, asignado al `posted`; corrige
  el `voucher_number` UNIQUE **global** (`20260705130000:70`).
- **Líneas:** tabla normalizada con CHECK cargo-XOR-abono; balance por RPC + CHECK + trigger diferible.
- **Orígenes:** `accounting_source_links` como autoridad; `source_ids UUID[]` se conserva como compatibilidad.
- **Idempotencia:** llave `(company_id, source_module, source_entity, source_id, source_version, event_type,
  payload_hash)`, UNIQUE por empresa (no global); registro de solicitudes para conflicto.
- **Reversas:** solo contra-asiento; período cerrado → reversa en período abierto; original inmutable.
- **Estados:** ampliar `draft/exported/reconciled` → `generated/validated/pending_configuration/pending_review/
  approved/posted/rejected/reversed` sin duplicar.
- **Dimensiones:** normalizada `accounting_line_dimensions` + columnas calientes (`cost_center_id`, `party_id`).
- **Parties/Perfil fiscal:** greenfield; snapshot fiscal e identidad de tercero copiados a la póliza (inmutable);
  CSD nunca en el perfil (permanece cifrado en `cfdi_provider_configs:76-78`).
- **Seguridad:** 11 capacidades `accounting.*`, segregación generate≠approve≠post, RLS por empresa, sin DELETE
  físico, RPC con `search_path` fijo + REVOKE public/anon.
- **Contratos:** 8 servicios como RPC Postgres (+ Edge para orquestación, shared para tipos); **UI nunca postea**.
- **Compatibilidad:** las 2 rutas actuales (`conciliacion/page.tsx:187`, `useFacturaCheck.ts:423`) intactas;
  migración por feature flag; **doble escritura prohibida**.
- **Pilotos:** BancoCheck (origina solo comisión/interés/directo/transferencia; lo demás concilia) y GastoCheck
  (`authorized` dispara reconocimiento; `accounts_payable.paid` concilia; sin estados nuevos en `expenses`).
- **Backfill:** histórico `NO_BACKFILL`/`REFERENCE_ONLY`; nada se contabiliza automáticamente.

## 4. Precondición de drift (§3) — verificar en prod antes de la Etapa 1 de C2B
Objetos reales (no `schema_migrations`, `DRIFT_AUDIT_2026-07-22.md`): filas en `accounting_accounts_v2`;
existencia de `cobra_collections`/`cobra_commissions` (migración revertida `20260708000001:4-10`); FK
`expenses.accounting_account_id`→v1; esquema de `accounting_vouchers` (`20260705130000`). **No bloquea el diseño**
(la infra mínima y los pilotos no dependen de los objetos inciertos); es el primer paso de C2B.

## 5. VEREDICTO (§26)

```
C2A LISTO PARA ESCRIBIR MIGRACIONES
```

**Justificación:** todos los ítems del gate del §26 están definidos con especificación exacta y evidencia
`archivo:línea` — tablas, columnas, tipos, relaciones, índices, constraints, estados, RLS, capacidades, RPC,
contratos, idempotencia, reversas, períodos, numeración, reglas, dimensiones, parties, perfil fiscal,
compatibilidad, pilotos, backfill, rollback, pruebas y el orden exacto de 16 bloques para C2B. El diseño es
**aditivo y reversible** (cero DROP; el retiro de legado es fase posterior). La verificación de drift en prod es
la **primera acción de C2B** (gate de la Etapa 1), documentada, y **no** constituye inconsistencia ni bloqueo del
diseño.

## Paquete C2A (12 documentos en `docs/contacheck-c2a/`)
`ESQUEMA_OBJETIVO` · `ACCOUNTING_VOUCHERS_Y_LINEAS` · `ORIGENES_IDEMPOTENCIA_REVERSAS` · `CATALOGO_Y_REGLAS` ·
`PERIODOS_Y_ESTADOS` · `DIMENSIONES_PARTIES_FISCAL` · `SEGURIDAD_RLS` · `CONTRATOS_SERVICIO` ·
`COMPATIBILIDAD_Y_PILOTOS` · `PLAN_MIGRACIONES_C2B` · `PLAN_PRUEBAS` · `RESUMEN_EJECUTIVO`.

> **No se escribieron migraciones ni se modificó código. No se inició C2B. Detente y espera revisión.**
