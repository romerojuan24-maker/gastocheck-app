# ContaCheck · C2A — Esquema Objetivo

> Especificación exacta y no destructiva de la infraestructura mínima. Verificación previa del esquema real
> (§3), convenciones, e inventario de objetos nuevos/ampliados. **No se escriben migraciones.**

## 1. Verificación previa del esquema real (§3) — evidencia

| Objeto | Estado real | Evidencia |
|---|---|---|
| `accounting_accounts` (v1) | Existe: `id, company_id, code, name, account_type(text libre), active`, unique `(company_id,code)`; + `level, parent_code` | `20260606000001_init.sql:96-104`; `20260615300000_accounting_columns.sql:5-7` |
| `accounting_accounts_v2` | Existe, huérfano: +`sub_type, nature, is_deductible, requires_cfdi, account_type(CHECK SAT), description, timestamps` | `20260623000001_gastocheck_contabilidad_integration.sql:27-42` |
| `accounting_vouchers` | Existe: `company_id, voucher_number UNIQUE(global), voucher_type CHECK(INCOME/EXPENSE/TRANSFER), source_module, source_ids UUID[], total_debit/credit, currency, entries JSONB, exported_*, status CHECK(draft/exported/reconciled), CHECK(total_debit=total_credit)` | `20260705130000_bancocheck_reconciliation_tables.sql:66-90` |
| Tabla de líneas | **NO existe** (líneas viven en `entries JSONB`) | `20260705130000:80` |
| Índices únicos de vouchers | solo `voucher_number UNIQUE` **global** | `20260705130000:70` |
| RLS vouchers | SELECT miembro (`:129-131`), INSERT accountant/admin/owner/superadmin (`:133-139`); **sin UPDATE/DELETE** | `20260705130000:127-139` |
| Grants vouchers | `GRANT ALL ON accounting_vouchers TO authenticated` | `20260705130000:147` |
| Triggers vouchers | ninguno | (ausencia en `20260705130000`) |
| Consumidores (INSERT) | BancoCheck web `bancocheck/conciliacion/page.tsx:187`; FacturaCheck mobile `facturacheck/hooks/useFacturaCheck.ts:423` | grep |
| Uso de `voucher_number` | generado `BC-…Date.now()` (`poliza.ts:186`); `INC-…` en FacturaCheck | app |
| Uso de `source_module`/`source_ids` | dedupe `.contains('source_ids',…)` (`useFacturaCheck.ts:381`, `conciliacion/page.tsx:191-192`) | app |
| `cost_center_id` | header-level en `expenses` (`init:169`), `receipts` (`20260608000003:158`); **sin línea** | migraciones |
| Estados actuales de póliza | `draft/exported/reconciled` | `20260705130000:86` |
| Funciones SQL contables | `generate_accounting_entries`/`export_policy_*` (rotas, sin caller) | `20260623000001:157-296` |
| `parties`/`party_links`/`company_tax_profiles`/`accounting_periods`/`accounting_source_links`/`accounting_voucher_lines`/`accounting_rules*` | **NO existen** (greenfield) | grep = 0 |
| Modelo de capacidades reutilizable | NóminaCheck: `nomi_capabilities`/`nomi_role_capabilities`/`nomi_user_capabilities`/`nomi_can()` | `20260722210000_nomicheck_secure_schema.sql` |
| Auditoría genérica | `audit_logs(entity_type, entity_id, action, old_values/new_values jsonb, reason, ip, user_agent)` | `20260608000003_receipts_schema.sql:361-377` |

## 2. Precondiciones de drift (§3) — a confirmar en prod antes de C2B
1. **`accounting_accounts_v2`**: nº de filas en prod (decide backfill vs retiro directo). No asumir.
2. **`cobra_collections`/`cobra_commissions`**: migración revertida `20260708000001:4-10` — pueden **no existir** en prod aunque el API escriba (`route.ts:135,151`).
3. **`expenses.accounting_account_id`**: confirmar FK a **v1** en prod (el intento a v2 `20260623000001:62` fue no-op).
4. **`accounting_vouchers`**: confirmar esquema `20260705130000` aplicado en prod.
5. **`schema_migrations` no es fuente de verdad** (`DRIFT_AUDIT_2026-07-22.md`) → verificar objetos reales por `information_schema`.

## 3. Convenciones para C2B (para no re-decidir)
- **Prefijos:** objetos contables nuevos = `accounting_*`; identidad transversal = `parties`/`party_links`;
  perfil fiscal = `company_tax_profiles`; capacidades = `accounting_capabilities`/`accounting_role_capabilities`/
  `accounting_user_capabilities` + función `accounting_can(company_id, capability)`.
- **Tipos:** dinero = `numeric(15,2)` (igual que `accounting_vouchers`); moneda = `varchar(3)`; tipo de cambio =
  `numeric(18,6)`; ids = `uuid` (`gen_random_uuid()`); timestamps = `timestamptz`; versiones de clave =
  `smallint`; enums = **`text` con CHECK** (patrón del repo) salvo donde ya exista tipo enum.
- **Multiempresa:** toda tabla nueva lleva `company_id uuid NOT NULL REFERENCES companies(id) ON DELETE …`
  (RESTRICT para contabilidad, no CASCADE, para no borrar histórico contable).
- **Auditoría:** eventos en `audit_logs` (`entity_type='contacheck_*'`); sin DELETE físico.
- **Inmutabilidad:** pólizas `posted` sin UPDATE/DELETE (RLS + trigger).
- **Aditivo:** todo `ADD COLUMN` es NULL-able con default seguro; toda tabla nueva; **cero DROP/rename/FK-change**
  en C2B (el retiro de legado es fase posterior).

## 4. Inventario de objetos de C2A
**Ampliaciones aditivas (ALTER):** `accounting_accounts` (+cols fiscales), `accounting_vouchers` (+encabezado
ampliado). **Se conserva** `source_ids UUID[]` como compatibilidad (no autoridad).
**Tablas nuevas:** `accounting_fiscal_years`, `accounting_periods`, `accounting_voucher_lines`,
`accounting_source_links`, `accounting_line_dimensions`, `accounting_rules`, `accounting_rule_versions`,
`accounting_rule_conditions`, `accounting_rule_outputs`, `parties`, `party_links`, `company_tax_profiles`,
`accounting_capabilities`, `accounting_role_capabilities`, `accounting_user_capabilities`,
`accounting_idempotency_requests` (registro de solicitudes).
**RPC nuevas (SECURITY DEFINER):** `accounting_generate_voucher`, `accounting_validate_voucher`,
`accounting_approve_voucher`, `accounting_post_voucher`, `accounting_reverse_voucher`,
`accounting_link_bank_transaction`, `accounting_resolve_rules`, `accounting_can`, `accounting_open/close_period`.

Detalle campo-por-campo en los documentos 2–7; contratos en el 8; compatibilidad/pilotos en el 9; orden y
backfill en el 10; pruebas en el 11.
