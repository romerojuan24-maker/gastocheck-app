# ContaCheck · C2A — Dimensiones, Parties y Perfil Fiscal

> §14 dimensiones por línea (recomendación); §15 `parties`/`party_links`; §16 `company_tax_profiles`.

## 1. Dimensiones por línea (§14)

### Estado actual (evidencia)
- Solo header: `cost_centers` (`20260606000001:115-122`, enum `cost_center_type` `:15`), `expenses.cost_center_id`
  (`init:169`), `receipts.cost_center_id` (`20260608000003:158`). **Sin dimensión por línea.**
- Multidimensión operativa: `expense_tags`/`receipt_tags`, `tag_type` incl. agro rancho/lote/cultivo/temporada
  (`20260608000003:278-279`). No hay `parcela` (≈`lote`).
- `inventory_locations.type` (`20260712080000:12-13`); `nomi_scope_rules.scope_type` (`20260722210000:267-269`).

### Alternativas (§14)
- **A — columnas frecuentes + JSON:** rápido, pero balanza-por-dimensión y filtros arbitrarios sufren; JSON no
  indexa bien las combinaciones; viola "no JSON para lo consultable".
- **B — tabla normalizada `accounting_line_dimensions`.**

### Recomendación: **Alternativa B (normalizada) + columnas denormalizadas calientes**
Las 2 dimensiones más consultadas (`cost_center_id`, `party_id`) se guardan **también** como columnas en
`accounting_voucher_lines` (para balanza rápida); el resto en `accounting_line_dimensions`:

`accounting_line_dimensions`: `id, company_id, line_id FK RESTRICT, dimension_type varchar(40), dimension_ref_id
uuid NULL, dimension_value text NULL, created_at`. `UNIQUE(line_id, dimension_type)` (una por tipo por línea).
- `dimension_type`: `cost_center, branch, department, project, business_unit, employee, client, supplier,
  product, warehouse, asset, rancho, lote_parcela, cultivo, temporada, custom_tag`.
- `dimension_ref_id` apunta a la tabla operativa existente (no duplica): `cost_centers.id`,
  `inventory_locations.id`, `inventory_products.id`, `parties.id`, o el `expense_tags.id` (agro).
- `dimension_value` para etiquetas libres.

**Rendimiento/reportes:** índices `(company_id, dimension_type, dimension_ref_id)` y
`(line_id)`. Balanza por dimensión = join líneas↔dimensiones. Las columnas calientes evitan el join en los
reportes más comunes.
**Compatibilidad `expense_tags`/`receipt_tags`:** las dimensiones agro se **referencian** (por `tag_id`), no se
copian; el adaptador GastoCheck mapea tags → `accounting_line_dimensions`.
**Obligatoriedad:** por regla (`accounting_rule_outputs.dimension_requirements`) o por cuenta; ausencia →
`pending_configuration`.

## 2. `parties` (§15) — NUEVA (greenfield)
| Campo | Tipo | Nullable | Restricción |
|---|---|---|---|
| `id` | uuid PK | no | — |
| `company_id` | uuid | no | FK companies RESTRICT |
| `party_type` | text | no | CHECK `('persona_fisica','persona_moral','extranjero','generico')` |
| `display_name` | text | no | — |
| `legal_name` | text | sí | razón social |
| `rfc_normalized` | text | sí | `upper(trim())`; NULL permitido |
| `tax_id_hash` | text | sí | HMAC ciego (reconcilia con nómina vía `nomi_blind_hash` `20260722210000:24`) |
| `tax_id_last4` | text | sí | enmascarado |
| `regimen_fiscal` | varchar(10) | sí | catálogo SAT |
| `codigo_postal` | varchar(10) | sí | — |
| `country_code` | varchar(3) | no | `'MEX'` |
| `email` | text | sí | — |
| `status` | text | no | CHECK `('active','inactive','merged')` DEFAULT 'active' |
| `merged_into_party_id` | uuid | sí | self-FK (fusión) |
| `source` | text | sí | constancia/ocr/manual |
| `created_at`/`updated_at` | timestamptz | — | — |

**Dedup:** `UNIQUE(company_id, rfc_normalized) WHERE rfc_normalized IS NOT NULL AND status<>'merged'`; fallback
`(company_id, lower(display_name))`; special-case `XAXX010101000`/`XEXX010101000` (party_type `generico`, sin
unicidad).
**Privacidad/RFC:** para empleados **no** se guarda RFC en claro; solo `tax_id_hash`/`tax_id_last4`
(`nomi_employees` cifra `20260722210000:49-51`). Para proveedores/clientes plaintext modules, `rfc_normalized`
se puede guardar (ya está en claro en `suppliers`/`cfdi_clients`).

## 3. `party_links` (§15) — NUEVA
`id, company_id, party_id FK RESTRICT, module varchar(50), entity_table varchar(64), entity_id uuid, role
varchar(24) CHECK('cliente','proveedor','empleado','contraparte','acreedor','deudor'), valid_from date,
valid_to date, is_active boolean DEFAULT true, created_at`.
`UNIQUE(company_id, module, entity_table, entity_id, role)`.
- Vincula sin mover: cada módulo conserva su tabla; `party_id` opcional (patrón `bank_transactions.
  linked_client_id/linked_supplier_id`, `20260721100000:17,19`).
- **Fusiones:** marcar `parties.status='merged'`+`merged_into_party_id`; repuntar `party_links`; **pólizas
  `posted` conservan snapshot** (no cambian). **Deshacer fusión:** nuevo `party_id`, re-vincular.
- **Cross-company:** `parties` es por empresa; una misma persona en 2 empresas = 2 `parties` (aislamiento RLS).

## 4. `company_tax_profiles` (§16) — NUEVA
| Campo | Tipo | Nullable | Restricción |
|---|---|---|---|
| `id` | uuid PK | no | — |
| `company_id` | uuid | no | FK companies RESTRICT |
| `rfc` | text | no | — |
| `legal_name` | text | no | razón social fiscal |
| `regimen_fiscal` | varchar(10) | no | catálogo SAT (**cierra D3**; hoy solo en `cfdi_provider_configs:73`) |
| `codigo_postal_fiscal` | varchar(10) | no | — |
| `country_code` | varchar(3) | no | `'MEX'` |
| `functional_currency` | varchar(3) | no | `'MXN'` |
| `cfdi_provider_config_id` | uuid | sí | FK `cfdi_provider_configs` (vínculo a CSD, **sin copiar secretos**) |
| `valid_from` | date | no | — |
| `valid_to` | date | sí | NULL = vigente |
| `status` | text | no | CHECK('active','superseded') |
| `version` | integer | no | `1` |
| `created_by`/`created_at` | — | — | auditoría |

`UNIQUE(company_id, valid_from)`; a lo más un `status='active'` con `valid_to IS NULL` por empresa.
**Secretos CSD:** permanecen cifrados en `cfdi_provider_configs` (`csd_*_enc`, `20260618300002:76-78`;
`20260706010000`); el perfil solo referencia. **Snapshot en póliza:** `accounting_vouchers.tax_profile_snapshot`
(jsonb) copia `rfc/legal_name/regimen_fiscal/codigo_postal_fiscal/functional_currency` **vigentes a la fecha
contable** → inmutable ante cambios posteriores del perfil.
