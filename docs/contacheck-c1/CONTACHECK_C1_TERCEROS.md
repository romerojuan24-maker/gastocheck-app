# ContaCheck · C1 — Modelo Transversal de Terceros

> Inventario de tablas de terceros y diseño no invasivo `parties` + `party_links`. Ref. ADR-006.

## 1. Hallazgo principal
**No existe party master.** Grep de `parties|terceros|contactos|beneficiarios|party_links|contrapartes` en
todo el repo = **0 definiciones de tabla**. Único enlace cross-módulo:
`bank_transactions.linked_client_id → cobra_clients` y `linked_supplier_id → suppliers`
(`20260721100000_bancocheck_clasificacion_contable.sql:17,19`).

## 2. Inventario por tabla (evidencia)

| Tabla | Módulo | Def | RFC | Unicidad RFC | Identidad fiscal |
|---|---|---|---|---|---|
| `suppliers` | GastoCheck | `20260608000003_receipts_schema.sql:35-59` | plano (`:41`) | **ninguna** (índice no único `:59`) | `name`, `normalized_name`, `rfc` |
| `cobra_clients` | CobraCheck | `20260618200001_cobra_check_tables.sql:10-25` (efectiva) | plano nullable (`:14`) | parcial `(company_id,rfc) WHERE rfc NOT NULL` (`:28-29`) | `name`, `rfc`, `email`, `contact_name` |
| `cfdi_clients` | FacturaCheck | `20260712070000_facturacheck_catalogos_y_relaciones.sql:13-26` | plano NOT NULL (`:16`) | `(company_id,rfc)` (`:25`) | **completo:** `razon_social`, `regimen_fiscal`, `codigo_postal`, `uso_cfdi` |
| `fleet_clients` | FleetCheck | `20260610000002_fleet_vertical.sql:52-60` | — | — | **ninguna** |
| `nomi_employees` | NóminaCheck | `20260722210000_nomicheck_secure_schema.sql:39-85` | **cifrado** (`encrypted_rfc`+`rfc_hash`+`rfc_last4` `:49-51`) | `(company_id, rfc_hash)` (`:82`) | cifrada; `tax_regime` es enum **laboral** (`:69`), no SAT |
| `expenses`/`receipts` | GastoCheck | `provider_name/rfc` texto libre (`init.sql:170-171`, `20260608000003:108-110`) | plano libre | — | ninguna |
| `cfdi_documents`/`cfdi_issue_requests` | FacturaCheck | `20260618300002:10-13,42-46` | plano libre (emisor+receptor) | — | free text |

**Drift a vigilar:** `cobra_clients` tiene una 2ª definición no-op (`20260618210000_cobracheck_complete.sql:6-31`)
con `rfc UNIQUE NOT NULL` más estricto que **nunca aplicó** (`IF NOT EXISTS`). Código que asuma RFC NOT NULL
global en cobra está equivocado contra el esquema vivo.

## 3. Matriz de campos duplicados
`name`/`razon_social`, `rfc` y `email` se repiten en ≥3 tablas dedicadas + 2 zonas de texto libre. Solo
`cfdi_clients` trae el set SAT completo (`razon_social`+`regimen_fiscal`+`codigo_postal`,
`20260712070000:17-20`) → **mejor plantilla** para el canónico. `nomi_employees` es el outlier (RFC cifrado +
`tax_regime` laboral).

## 4. ¿Se duplica el mismo tercero hoy? — **Sí, garantizado**
No hay clave ni FK compartida entre las tablas. Una persona que sea cliente (`cfdi_clients`), deudor
(`cobra_clients`) y proveedor (`suppliers`) existe como **3 filas inconexas** con RFC en claro capturado por
separado. `suppliers` ni siquiera tiene unicidad de RFC (`20260608000003:59`). `nomi_employees` no se puede
casar sin la clave HMAC (`rfc_hash`, `20260722210000:50`).

## 5. Diseño `parties` + `party_links` (no invasivo)
**Principio:** cada módulo conserva su tabla operativa y gana un `party_id` **opcional** (patrón ya usado por
`bank_transactions`). Nada se mueve ni se borra.

**`parties` (campos mínimos):** `id`, `company_id`, `kind` (fisica/moral), `rfc` (normalizado `upper(trim)`),
`rfc_hash` (HMAC ciego vía `nomi_blind_hash` `20260722210000:24`, para reconciliar con nómina sin descifrar),
`razon_social`/`nombre`, `regimen_fiscal`, `codigo_postal`, `email`, `phone`, `status`, `source`
(constancia/ocr/manual), `created_at`.

**`party_links`:** `party_id`, `module`, `entity_table`, `entity_id`, `role` (cliente/proveedor/empleado/
contraparte/acreedor/deudor), `is_active`. Un `party_id` puede tener múltiples roles simultáneos.

**Deduplicación:**
- Clave primaria: `(company_id, rfc_normalizado)` — ya de facto en `cobra_clients` (`20260618200001:28`),
  `cfdi_clients` (`20260712070000:25`), `nomi_employees` por hash (`20260722210000:82`).
- Nómina: comparar por `rfc_hash` (RFC cifrado, sin join en claro).
- Fallback sin RFC: `(company_id, normalized_name)` (`suppliers.normalized_name` `20260608000003:40`).
- **Special-case RFCs genéricos** `XAXX010101000`/`XEXX010101000` (colisionan).

**Vigencia / fusiones / separaciones:** `parties` con `status` + auditoría en `audit_logs`
(`entity_type='parties'`); fusión = marcar duplicado y repuntar `party_links`; separación = nuevo `party_id`.
No se borran registros operativos.

**PII:** `parties` **no** guarda RFC de empleado en claro; se enlaza a `nomi_employees` por `rfc_hash`. Ver
`CONTACHECK_C1_AUTORIDAD_DATOS.md` y seguridad.

## 6. Fuente de alta (decisión ya tomada por Juan)
Alta de `parties` importando **Constancia de Situación Fiscal + OCR** para autocompletar y evitar duplicados.
`cfdi_clients` (set SAT) es el destino natural de esos datos y la plantilla de `parties`.
