# ContaCheck · C0 — Auditoría del Repositorio

> Solo lectura. Método, cobertura y advertencias sobre la fiabilidad de la evidencia.

## 1. Método
Auditoría por barrido paralelo de 4 frentes (subagentes de exploración read-only) + conocimiento
directo de NóminaCheck de esta sesión:

| Frente | Cobertura |
|---|---|
| GastoCheck | `expenses`/`receipts`, anticipos, reembolsos, viáticos, CxP, export, motor contable en GastoCheck |
| CobraCheck + FlujoCheck | CxC, cobros, comisiones; agregación/proyección de tesorería |
| BancoCheck | movimientos bancarios, clasificación contable, pólizas, conciliación |
| Entidades compartidas + infra contable | `companies`, `profiles`/`company_members`, catálogos, `accounting_*`, `audit_logs` |
| NóminaCheck (directo) | esquema `nomi_*` desplegado en F1A, PII/banca cifradas, capacidades |

Cada afirmación de los docs de detalle cita `archivo:línea`. Base: `supabase/migrations/` y
`apps/{web,mobile}/`.

## 2. Advertencia de fiabilidad (crítica)
`DRIFT_AUDIT_2026-07-22.md`: **el registro `schema_migrations` de prod NO es fuente de verdad** — hubo
SQL aplicado a mano y la carpeta de migraciones **no es reproducible** de principio a fin. Además hay
varias migraciones con `CREATE TABLE IF NOT EXISTS` que **redefinen** tablas ya creadas con columnas
distintas: **gana la primera que corrió; el resto es código muerto silencioso.**

**Implicación para ContaCheck:** antes de C1, para cualquier objeto contable hay que **verificar el
objeto real en producción** (information_schema), no confiar en la migración. Casos concretos detectados:

- `bank_transactions`: la migración `20260708000000` redefine la tabla con columnas
  (`transaction_type`, `approved_by`…) que **nunca aplicaron** (confirmado en `20260721100000:6-9`).
- `cobra_*`: **tres** migraciones crean tablas cobra solapadas; `20260708000001_cobracheck_complete_impl.sql`
  quedó **bloqueada/revertida** (nota líneas 1-10) → `cobra_collections`/`cobra_commissions` dudosas en prod.
- `viaticos`: `20260616900000` la declara no-op ("usamos `is_viatico=true`") pero `20260627000000` y
  `20260629030003` la **vuelven a crear**.

## 3. Inventario de objetos contables ya existentes (para no reinventar)

### Catálogos
- `accounting_accounts` — **vivo**, con jerarquía `level`/`parent_code`, UI administrable
  (`apps/mobile/app/catalogo-cuentas.tsx`, import masivo en `catalogo-import-modal.tsx`).
- `accounting_accounts_v2` — más rico (`account_type`, `nature`, `is_deductible`, `requires_cfdi`),
  **huérfano** (`20260623000001_...:27`).
- `expense_categories` (`acct_code`, `default_account_id`), `cost_centers` (enum `cost_center_type`:
  obra/ruta/proyecto/lote/cliente/unidad/sucursal), `accounting_category_map` (categoría→cuenta/IVA/
  contrapartida/`department_code`/`segment_code`), `accounting_export_profiles` (contpaqi/aspel_coi/microsip/universal_excel).

### Asientos / pólizas
- `accounting_entries` (`20260623000001:72` — `entry_number`, `account_id`, `concept`, `debe`, `haber`,
  `cfdi_reference`) + funciones `generate_accounting_entries` (`:157`), `export_policy_contpaqui` (`:224`),
  `export_policy_json` (`:266`). **Cuelgan de `policies`/`expenses`, no de un libro diario general.**
- `accounting_vouchers` (BancoCheck, `20260705130000:66-90` — `voucher_type` INCOME/EXPENSE/TRANSFER,
  `total_debit/credit`, `entries jsonb`, `CHECK (total_debit = total_credit)`).
- `apps/web/lib/poliza.ts` — generador de póliza balanceada real (Bancos + contrapartida, IVA 16 %).

### Validación fiscal
- `validate_cfdi_with_sat` (`20260623000001:112`) — **SIMULADA**, siempre "Vigente". `sat_validations` existe.

### Exportación
- `generate-export` (Edge Function) — export real que usa la app: lee `receipts` → Excel/CSV/CONTPAQi/Aspel/Microsip.
- `accounting_exports`, `report_exports`, `accounting_export_profiles`.

### Auditoría
- `audit_logs` genérica (`entity_type` libre, `old_values`/`new_values jsonb`) + bitácoras específicas
  (`expense_audit`, `bank_audit_log`).

## 4. Qué NO existe (hueco real para ContaCheck)
- **Libro diario / journal general** unificado (los asientos hoy cuelgan de pólizas de gasto).
- **Party master** de terceros.
- **Fecha contable** consistente (solo fecha de operación/gasto).
- **Retenciones y moneda** consistentes entre módulos (ver doc de brechas).
- **Generación automática** de pólizas al confirmar el evento (todo es on-demand o inexistente).
- **Validación SAT real** (la actual es simulada).

## 5. Conclusión de la auditoría
El repo tiene **piezas contables reales pero desalineadas**. ContaCheck no es "construir contabilidad";
es **unificar, cablear y normalizar** lo existente detrás de un contrato común, sin tocar los módulos.
Detalle por tema en los documentos 2–9.
