# ContaCheck · C1 — Modelo de Autoridad de Datos

> Quién es dueño de cada dato, quién lo consume, y qué "congela" ContaCheck como snapshot contable.
> ContaCheck es propietario **solo** de lo contable; el resto lo **lee** (con snapshot en la póliza).

## 1. Principio
Una póliza es un hecho histórico: debe **fotografiar** (snapshot) los datos del origen en el momento de
contabilizar (RFC del tercero, cuenta, importe, tipo de cambio), de modo que cambios posteriores en los
módulos operativos **no** reescriban la contabilidad. Los datos vivos siguen siendo dueños de su módulo.

## 2. Matriz de autoridad

| Dato | Autoridad (tabla) | Consumidores | Snapshot contable | Sincronización |
|---|---|---|---|---|
| Empresa (tenant) | `companies` (`init:38-47`) | todos | id + nombre en póliza | referencia |
| Perfil fiscal | `company_tax_profiles` (nuevo, ADR-008) ← hoy `companies`+`cfdi_provider_configs` | ContaCheck, FacturaCheck | RFC/razón/régimen vigentes → snapshot en póliza | vista `companies_fiscal_v` |
| Catálogo de cuentas | **`accounting_accounts` v1** (ADR-001) | GastoCheck, BancoCheck, ContaCheck | `account_code` en línea | FK viva |
| Terceros (canónico) | `parties` (nuevo, ADR-006) | todos vía `party_links` | `party_id`+RFC en póliza | `party_id` opcional por módulo |
| Proveedores (op) | `suppliers` (`20260608000003:35`) | GastoCheck, Banco | nombre/RFC snapshot | `party_id` opcional |
| Clientes (op) | `cobra_clients` (`20260618200001:10`), `cfdi_clients` (`20260712070000:13`) | Cobra, Factura, Banco | nombre/RFC snapshot | `party_id` opcional |
| Empleados | `nomi_employees` (`20260722210000:39`, PII cifrada) | Nómina | **solo id/hash**, nunca PII | `party_id` por `rfc_hash` |
| Cuentas bancarias (op) | `bank_accounts` (`20260618300000:5`) | Banco, asesor | cuenta contable de contrapartida | puente |
| Cuentas bancarias (fiscal) | `company_bank_accounts` (`20260629010000:4`) | receipts, admin | CLABE/titular (no en póliza) | puente |
| Movimientos bancarios | `bank_transactions` (`20260618300000:19`) | Banco, Flujo | importe/fecha en póliza de conciliación | evento (aprobado) |
| Gastos | `expenses`/`receipts` | GastoCheck | importe/IVA/retención snapshot | evento (authorized) |
| Cobros | `cobra_invoices`/`cobra_payments` | CobraCheck | importe/IVA snapshot | evento (insert/paid) |
| Nómina | `nomi_payroll`/`nomi_tax_withholdings` (`20260722210000`) | Nómina | totales por póliza, sin PII | evento (approved/paid) |
| CFDI | `cfdi_documents`/`cfdi_data` | Factura, Gasto | UUID/sellos referenciados | referencia |
| **Pólizas** | **`accounting_vouchers`** (ADR-005) | **ContaCheck** | — (es el libro) | dueño |
| **Líneas** | `accounting_voucher_lines` (nuevo, ampliación) | ContaCheck | FK a v1 | dueño |
| **Períodos / cierres** | tablas nuevas de ContaCheck | ContaCheck | — | dueño |
| **Reglas de contabilización** | tabla nueva de ContaCheck | ContaCheck | — | dueño |
| **Dimensiones** | `cost_centers` (`init:115`) + dims nuevas | GastoCheck, ContaCheck | código en línea | referencia |
| Auditoría | `audit_logs` (`20260608000003:361`) | todos | — | dueño compartido |

## 3. ContaCheck es propietario ÚNICAMENTE de
Configuración contable · reglas de contabilización · registros contabilizables (staging) · pólizas
(`accounting_vouchers`) · líneas · movimientos contables · períodos · cierres · estados financieros ·
trazabilidad contable. **Nada más.** Terceros, cuentas bancarias, gastos, cobros, nómina y CFDI siguen siendo
propiedad de sus módulos; ContaCheck los lee y snapshotea.

## 4. Regla de snapshot vs referencia
- **Snapshot (copiar valor a la póliza):** importes, IVA/retenciones, RFC/nombre del tercero, `account_code`,
  moneda, tipo de cambio, fecha contable. → inmutabilidad contable.
- **Referencia (guardar id/puntero):** `source_module`+`source_ids` (`accounting_vouchers:73-74`), `party_id`,
  `cfdi_uuid`, `bank_transaction_id`. → trazabilidad.
