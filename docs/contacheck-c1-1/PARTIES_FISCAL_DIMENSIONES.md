# ContaCheck · C1.1 — Parties, Perfil Fiscal y Dimensiones

> Cómo el contrato de póliza integra terceros, perfil fiscal vigente y dimensiones por línea, sin absorber
> tablas operativas. Ref. §13, §14, §15.

## A. PARTIES (§13)

### Vinculación por rol (no invasiva)
`parties` (canónico) + `party_links` (rol por módulo). Cada operación resuelve su `party_id` desde la tabla
operativa que ya usa; el módulo **conserva** su tabla:
| Rol | Tabla operativa (evidencia) | Enlace |
|---|---|---|
| proveedor | `suppliers` (`20260608000003:35`) | `party_links(role='proveedor')` + `party_id` opcional |
| cliente | `cobra_clients` (`20260618200001:10`), `cfdi_clients` (`20260712070000:13`) | idem |
| empleado | `nomi_employees` (`20260722210000:39`, PII cifrada) | por `rfc_hash` (`:50`), nunca RFC en claro |
| contraparte bancaria | `bank_transactions.linked_client_id/linked_supplier_id` (`20260721100000:17,19`) | ya apunta a cobra/suppliers |
| acreedor / deudor | `accounts_payable` / `cobra_clients` | `party_links` con rol |

### Comportamiento en casos límite
| Caso | Regla |
|---|---|
| No existe party | póliza se genera con snapshot de nombre/RFC del origen; `party_id` NULL; marca `party_pending` para vinculación posterior (no bloquea si la regla no exige tercero) |
| Duplicados | dedupe por `(company_id, rfc_normalizado)`; para nómina por `rfc_hash`; fallback `(company_id, normalized_name)` (`suppliers.normalized_name` `20260608000003:40`); special-case `XAXX010101000`/`XEXX010101000` |
| RFC coincidente | mismo `party_id`, nuevo `party_link` (rol adicional) |
| Una entidad, varios roles | un `party_id` con múltiples `party_links` |
| Fusión de parties | marcar duplicado, repuntar `party_links` al superviviente; **las pólizas ya posted conservan su snapshot** (no cambian) |
| Separación de fusión incorrecta | nuevo `party_id`, re-vincular `party_links`; pólizas históricas intactas por snapshot |

## B. PERFIL FISCAL VERSIONADO (§14)

### Cómo la póliza toma el perfil vigente
La póliza usa el perfil fiscal **vigente a su `accounting_date`** desde `company_tax_profiles` (C1 ADR-008;
tabla nueva, hoy inexistente — grep = 0), que consolida lo hoy partido entre `companies`
(`rfc` `20260606000001:41`, dirección `20260614200000`/`400000`) y `cfdi_provider_configs`
(`regimen_fiscal`/`csd_*` `20260618300002:73-78`).

**Snapshot obligatorio en la póliza:** `rfc`, `razon_social`, `regimen_fiscal`, `codigo_postal_fiscal`,
`moneda_funcional` **vigentes a la fecha contable** → si el perfil cambia después, la póliza histórica **no
cambia**. Se referencia `company_tax_profiles.id` (vigencia) pero se **copia** el valor.

**Separación de secretos:** los CSD (`csd_cert_enc/key_enc/pass_enc`, cifrados `20260706010000:9-27`)
**permanecen** en `cfdi_provider_configs`; el perfil solo guarda identidad + puntero de vigencia, **nunca**
secretos. La póliza no toca CSD.

## C. DIMENSIONES POR LÍNEA (§15)

### Qué existe hoy (evidencia)
- **Encabezado únicamente:** `cost_centers` (`20260606000001:115-122`), enum `cost_center_type`
  obra/ruta/proyecto/lote/cliente/unidad/sucursal/otro (`:15`), referenciado por `expenses.cost_center_id`
  (`init:169`), `receipts.cost_center_id` (`20260608000003:158`). **No hay dimensión a nivel de línea** en
  ninguna parte.
- **Multidimensión operativa:** `expense_tags`/`receipt_tags`, `tag_type` incl. AGRO
  (rancho/lote/cultivo/temporada/maquinaria/ruta/técnico/cliente/proyecto/unidad, `20260608000003:278-279`).
  **No existe `parcela`** (lo más cercano es `lote`).
- **Ubicaciones/almacén:** `inventory_locations.type` company/branch/warehouse/area/shelf/vehicle/employee/
  project/customer (`20260712080000:12-13`), self-FK `parent_id` (`:14`).
- **Nómina:** `nomi_employees.branch`/`department` (`20260722210000:66-67`); `nomi_scope_rules.scope_type`
  company/branch/department/cost_center/team/employee/self (`:267-269`) — el enum de dimensión más explícito.
- **Export libre:** `accounting_category_map.department_code`/`segment_code` (TEXT, `20260608000003:350-351`).

### Diseño de dimensiones por línea (no duplicar)
`accounting_voucher_lines.dimensions` como **referencias/mapeos**, no copias de las tablas operativas:
| Dimensión | Fuente de referencia |
|---|---|
| centro de costo | `cost_centers.id` |
| sucursal | `cost_center_type='sucursal'` / `nomi_employees.branch` / `inventory_locations(type=branch)` |
| proyecto | `cost_center_type='proyecto'` / tag `proyecto` |
| almacén | `inventory_locations.id` |
| empleado / proveedor / cliente | `party_id` (rol) |
| producto | `inventory_products.id` |
| agro (rancho/cultivo/lote/temporada) | `expense_tags` (tag_type) |
| activo | **FUTURA** (no hay tabla de activos) |

- **Obligatoriedad por regla o por cuenta:** una regla del motor o una cuenta puede exigir una dimensión
  (patrón ya presente en `expense_category_rules.required_field`, `20260608000003:314`). Si falta →
  excepción `CONFIGURATION_REQUIRED` (ver niveles de automatización).
- **No se obliga a los módulos a duplicar dimensiones:** la línea guarda `dimension_type` + `dimension_ref_id`
  apuntando a la tabla operativa existente.
