# ContaCheck · C2A — Catálogo Autoritativo y Motor de Reglas

> §12 ampliación de `accounting_accounts`; §13 tablas del motor de reglas. Especificación para C2B.

## 1. Ampliación de `accounting_accounts` (§12) — ALTER aditivo
Base: `20260606000001_init.sql:96-104` + `20260615300000:5-7`. Absorbe **solo** los atributos útiles de v2
(`20260623000001:32-40`), clasificados en propios de la cuenta vs defaults sobrescribibles por regla.

### Propios de la cuenta (columnas nuevas)
| Campo | Tipo | Nullable | Default | Restricción | Origen |
|---|---|---|---|---|---|
| `nature` | text | sí | — | CHECK `('deudora','acreedora')` | v2 `:34` |
| `account_type_norm` | text | sí | — | CHECK `('activo','pasivo','patrimonio','ingreso','egreso','costo')` | v2 `:32` (col nueva, NO pisa `account_type` libre de v1 `init:101`) |
| `sub_type` | text | sí | — | — | v2 `:33` |
| `level` | integer | ✅ existe | `1` | — | `20260615300000:6` |
| `parent_code` | text | ✅ existe | — | — | `20260615300000:7` |
| `is_postable` | boolean | sí | `true` | cuentas de detalle afectables; las de agrupación `false` | NUEVO |
| `sat_grouping_code` | varchar(10) | sí | — | CodAgrupador SAT (contab. electrónica) | NUEVO (brecha C1) |
| `currency_code` | varchar(3) | sí | — | cuando la cuenta es monomoneda | NUEVO |
| `active` | boolean | ✅ existe | `true` | — | `init:102` |

### Defaults, no absolutos (sobrescribibles por regla)
| Campo | Tipo | Default | Nota |
|---|---|---|---|
| `default_is_deductible` | boolean | `true` | v2 `is_deductible` `:35`; una regla de operación puede sobrescribir |
| `default_requires_cfdi` | boolean | `true` | v2 `requires_cfdi` `:36` |
| `default_tax_treatment` | text | NULL | tratamiento fiscal por defecto |

**Compatibilidad/backfill/congelamiento:**
- Todo `ADD COLUMN … NULL`/default → no rompe los 9 consumidores de v1.
- **Backfill:** si hay filas en v2 en prod (a verificar), mapear por `(company_id, code)` → poblar
  `nature/account_type_norm/…` en v1. Si v2 está vacío (probable), no hay backfill.
- **Congelamiento de v2:** documental + (opcional) **trigger de aviso** que registre en `audit_logs` cualquier
  nuevo `INSERT` en `accounting_accounts_v2` (detección de referencias nuevas). No se borra v2 en C2A/C2B.
- **Retiro futuro:** fase posterior, tras 0 filas y 0 dependencias.

## 2. Motor de reglas (§13) — tablas NUEVAS

### `accounting_rules`
`id, company_id, name, module varchar(50), event_type varchar(48), concept text, priority integer NOT NULL
DEFAULT 100, is_default boolean DEFAULT false, status text CHECK('draft','active','inactive') DEFAULT 'draft',
valid_from date, valid_to date, active_version_id uuid, created_by, created_at, updated_at`.

### `accounting_rule_versions`
`id, rule_id FK, version integer, status text CHECK('draft','published','archived'), published_by, published_at,
notes text, created_at`. La póliza guarda `rule_version_id` (trazabilidad + rollback).

### `accounting_rule_conditions` (AND dentro de una versión)
`id, rule_version_id FK, dimension varchar(40), operator varchar(12) CHECK('eq','in','neq','gt','lt','exists',
'null'), value_text text, value_num numeric, value_set text[]`.
**Dimensiones de condición** (todas opcionales): `company, module, event_type, category, supplier, client,
employee, product, warehouse, branch, cost_center, project, tax_treatment, payment_form, currency`.
`specificity` = nº de condiciones no nulas (calculado, desempata prioridad).

### `accounting_rule_outputs` (líneas plantilla cargo/abono)
`id, rule_version_id FK, line_number integer, side text CHECK('debit','credit'), account_selector jsonb
(código fijo | por categoría vía accounting_category_map | por dimensión), amount_source text CHECK('subtotal',
'iva','retencion_iva','retencion_isr','ieps','total','custom'), tax_code, dimension_requirements text[],
requires_review boolean DEFAULT false, metadata jsonb`.

## 3. Resolución + garantías (§13)
- **Resolución:** filtrar reglas `active`+vigentes a `accounting_date` → casar condiciones → ordenar por
  `specificity` desc, `priority` desc.
- **Dos reglas igualmente específicas** → **excepción "ambigua"** → `pending_configuration` (no adivina).
- **Publicación de regla inválida** bloqueada por validación en `accounting_publish_rule`: (a) toda cuenta de
  `account_selector` existe, `active`, `is_postable`; (b) el conjunto de outputs **balancea** (Σdebit=Σcredit por
  construcción o marcado como parcial que otra regla completa); (c) sin `amount_source` inexistente.
- **Cuentas inactivas** → publicación rechazada; en runtime → excepción.
- **Reglas sin balance** → no publicables.
- **Reglas circulares** → no aplica (las reglas no referencian otras reglas; salida directa a cuentas).
- **Cambios retroactivos** → prohibidos: una versión publicada es inmutable; cambios = versión nueva; las
  pólizas `posted` conservan su `rule_version_id`.

## 4. Simulador conceptual (§13)
`accounting_simulate_rules(company_id, sample_movements[])` — dry-run que aplica la versión (draft o active) a
movimientos de muestra/históricos, **sin persistir**, devolviendo por movimiento: regla ganadora, líneas
resultantes, balance, y excepciones (`pending_configuration`/cuenta inactiva). Requisito antes de publicar.
