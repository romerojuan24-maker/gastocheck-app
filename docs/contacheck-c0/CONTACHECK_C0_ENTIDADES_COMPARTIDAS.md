# ContaCheck · C0 — Entidades Compartidas

> Qué reutilizar tal cual, qué está duplicado, y qué falta. Regla: **no crear paralelos de lo que ya vive.**

## Tabla de veredicto

| Entidad | Tabla VIVA | Reutilizar | Riesgo de duplicación |
|---|---|---|---|
| Tenant (empresa) | `companies` | Sí | Bajo — falta `regimen_fiscal` |
| Usuarios / roles | `profiles`, `company_members`, enum `member_role` | Sí (íntegro) | Ninguno |
| Proveedores | `suppliers` | Sí | Medio (también texto libre en `expenses`) |
| Clientes | `cobra_clients` + `cfdi_clients` + `fleet_clients` | **Consolidar** | **ALTO — sin party master** |
| Bancos | `bank_accounts` vs `company_bank_accounts` | **Elegir una** | **Medio-alto** |
| Catálogo de cuentas | `accounting_accounts` | Sí | **ALTO — `accounting_accounts_v2` huérfano y paralelo** |
| Asientos / pólizas | `accounting_entries`, `accounting_vouchers`, funciones export | Base existente | Medio (dos generadores; atados a policies) |
| CFDI / docs | `cfdi_documents`, `cfdi_data`, `receipts` | Sí | Bajo |
| Export | `accounting_exports`, `accounting_export_profiles`, `accounting_category_map` | Sí | Bajo |
| Auditoría | `audit_logs` (genérica) | Sí | Ninguno |

## 1. Tenant — `companies` (fuente única, reutilizar)
- Base `20260606000001_init.sql:38-47` (`id`, `name`, `rfc`, `plan`, `created_by`).
- Perfil fiscal por ALTER: `nombre_comercial`, `direccion`, `ciudad`, `cp`, `telefono`, `moneda` (MXN/USD),
  `colonia`, `estado`, `pais`, `sector`.
- **Falta para contabilidad:** `regimen_fiscal` a nivel empresa (hoy solo en `cfdi_clients.regimen_fiscal`).
  RFC ✔, CP ✔. **Recomendación:** añadir `regimen_fiscal` a `companies`, no crear tabla nueva.
- El tenant contable **es** `companies`; no hay entidad "organización" separada.

## 2. Usuarios / roles — reutilizar íntegro (no duplicar)
- `profiles` (extiende `auth.users`), `company_members` (`role member_role`, `status`, unique(company,user)).
- Enum `member_role` incluye ya **`accountant`** y **`contador_general`** — ContaCheck los reutiliza; la RLS
  contable existente ya los contempla (p.ej. `facturacheck_catalogos_y_relaciones.sql:52`).
- Helpers SECURITY DEFINER reutilizables: `auth_is_member`, `auth_role`, `auth_can_view_all`,
  `auth_can_authorize` (`init.sql:64-91`).

## 3. Terceros — DUPLICACIÓN ALTA (sin party master)
- **Proveedores:** `suppliers` (normalizada, con `canonical_supplier_id`, RFC) + texto libre en
  `expenses.provider_name/rfc`.
- **Clientes — 4 tablas, sin fuente única:**
  - `cobra_clients` (CobraCheck: crédito, saldo, riesgo).
  - `cfdi_clients` (FacturaCheck: `razon_social`, `uso_cfdi`, **`regimen_fiscal`**, `codigo_postal`).
  - `fleet_clients` (vertical flotilla).
- BancoCheck ya sufre la fragmentación: liga a `cobra_clients` y `suppliers` por separado.
- **Contabilidad exige RFC + régimen por tercero.** Hoy tendría que unir 4 tablas.
- **Decisión bloqueante (ya en pendientes de Juan):** introducir/consolidar `parties` (directorio único
  cliente+proveedor+empleado) vs vista de consolidación. Recomendado: `parties` + alta por Constancia de
  Situación Fiscal + OCR (decisión ya tomada por Juan para evitar duplicados).

## 4. Bancos — DOS representaciones
- `bank_accounts` (BancoCheck): operativa, con `current_balance` y movimientos (`bank_transactions`).
- `company_bank_accounts` (`20260629010000`): catálogo fiscal ligero (CLABE, titular), ligada a
  `receipts.bank_account_id`.
- **Decisión bloqueante:** cuál es la cuenta autoritativa para la contrapartida caja/bancos en asientos.
  Recomendado: `bank_accounts` como operativa (tiene saldos/movimientos) y mapear CLABE/titular fiscal
  como datos de la misma, deprecando la duplicación.

## 5. Catálogo de cuentas — DUPLICACIÓN CRÍTICA
- `accounting_accounts` (**vivo**, jerarquía `level`/`parent_code`, UI móvil administrable, usado por
  BancoCheck y pólizas). **Esta es la autoritativa.**
- `accounting_accounts_v2` (más rico: `account_type`, `nature`, `is_deductible`, `requires_cfdi`,
  `20260623000001:27`) — **huérfano**.
- Peor: `expenses.accounting_account_id` tiene **dos FK conflictivas** (a v1 en `20260615300000:11` y a v2
  en `20260623000001:62`); prevalece una según orden de aplicación.
- **Decisión bloqueante:** unificar en `accounting_accounts` y **migrar las columnas fiscales útiles de v2**
  (`nature`, `is_deductible`, `requires_cfdi`) a la viva; luego deprecar v2 y resolver la FK.

## 6. Documentos / CFDI / storage (reutilizar)
- `receipts` (comprobante central), `expense_attachments` (ticket/pdf/xml), `cfdi_documents`
  (`xml_storage_path`, `pdf_storage_path`), `cfdi_data` (1:1 con expense).
- Storage con RLS por empresa (`20260608000002`, endurecido en `20260706000001`).
- ContaCheck **lee** `cfdi_documents`/`cfdi_data` como fuente del XML para pólizas; no duplica almacenamiento.

## 7. Auditoría (reutilizar)
- `audit_logs` genérica: `entity_type` libre, `old_values`/`new_values jsonb`, `reason`, `ip`, `user_agent`.
  ContaCheck escribe sus eventos aquí (`entity_type = 'contacheck_poliza'`, etc.), sin tabla nueva.

## Resumen de decisiones bloqueantes (para Juan)
1. `regimen_fiscal` → `companies`.
2. Party master (`parties`) para terceros.
3. Cuenta bancaria autoritativa.
4. Catálogo único `accounting_accounts` (+ migrar campos de v2, deprecar v2, arreglar FK de `expenses`).
