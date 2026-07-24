# ContaCheck · C1 — Decisiones Arquitectónicas (ADRs)

> Fase de **diseño verificable**. Solo lectura: no se escriben migraciones, no se modifica código, no se
> aplica a producción. Cada decisión es un ADR con evidencia `archivo:línea`. Donde falta ratificación de
> negocio de Juan, el ADR queda **Propuesto**, no Aceptado.

Índice de ADRs:
- ADR-001 · Catálogo contable autoritativo
- ADR-002 · Tratamiento de `accounting_accounts_v2`
- ADR-003 · Referencia contable en GastoCheck (lectura normalizada no invasiva)
- ADR-004 · Motor de asientos / pólizas: qué se reutiliza
- ADR-005 · `accounting_vouchers` como tabla definitiva de pólizas
- ADR-006 · Modelo transversal de terceros (`parties` + `party_links`)
- ADR-007 · Autoridad de cuentas bancarias
- ADR-008 · Perfil fiscal empresarial versionado
- ADR-009 · Modelo de integración no invasiva (adaptadores por evento)
- ADR-010 · Piloto de primer adaptador

---

## ADR-001 — Catálogo contable autoritativo = `accounting_accounts` (v1)
**Estado:** Aceptado (evidencia concluyente).
**Contexto:** Existen dos catálogos: `accounting_accounts` (v1, `20260606000001_init.sql:96-104`) y
`accounting_accounts_v2` (`20260623000001_gastocheck_contabilidad_integration.sql:27-42`).
**Opciones:** (A) v1 autoritativo; (B) v2 autoritativo; (C) fusionar en tabla nueva.
**Decisión recomendada:** **(A) v1 es autoritativo.**
**Evidencia:**
- v1 tiene **todos** los consumidores de app (9 puntos móvil+web) y las **3 FK reales**: `expenses.accounting_account_id` (`20260615300000_accounting_columns.sql:11`), `bank_transactions.accounting_account_id` (`20260721100000_bancocheck_clasificacion_contable.sql:15`), `receipts.accounting_account_id` (`20260630000001_fix_reembolsos_receipts_columns.sql:6`), más `expense_categories.default_account_id` (`20260606000001_init.sql:111`).
- v1 tiene **jerarquía** usada por la UI: `level`/`parent_code` (`20260615300000_accounting_columns.sql:5-7`), consumida en `apps/mobile/app/catalogo-cuentas.tsx:70`.
- La UI de alta/importación de catálogo escribe **v1** (`catalogo-cuentas.tsx:125`, `catalogo-import-modal.tsx:89`).
- **v2 tiene 0 consumidores de aplicación** (grep de `accounting_accounts_v2` en `apps/` y `supabase/functions/` = 0).
**Consecuencias:** ContaCheck referencia v1 en su núcleo. No se crea catálogo nuevo.
**Compatibilidad:** No destructiva. v1 ya vive y no cambia su identidad.
**Riesgos:** v1 carece de semántica fiscal (ver ADR-002).
**Rollback:** N/A (no hay cambio de datos; es una elección de referencia).
**Trabajo futuro:** Portar columnas fiscales de v2 (ADR-002).

---

## ADR-002 — Tratamiento de `accounting_accounts_v2` = congelar + absorber columnas fiscales en v1
**Estado:** Propuesto (requiere ratificación).
**Contexto:** v2 aporta semántica fiscal exclusiva que v1 no tiene, pero está huérfano.
**Opciones:** (A) borrar v2; (B) congelar v2 y portar sus columnas útiles a v1 como opcionales; (C) dejarlo tal cual.
**Decisión recomendada:** **(B) congelar v2 (no borrar) + añadir a v1 columnas opcionales** `account_type_norm`
(con CHECK SAT), `nature`, `is_deductible`, `requires_cfdi`, `sub_type`.
**Evidencia:**
- Columnas exclusivas de v2: `account_type` con CHECK `activo/pasivo/patrimonio/ingreso/egreso/costo` (`20260623000001:32`), `nature` deudora/acreedora (`:34`), `is_deductible` (`:35`), `requires_cfdi` (`:36`), `sub_type` (`:33`).
- v1 `account_type` es `text` libre sin CHECK (`20260606000001_init.sql:101`).
- v2 sin seed y sin escritores de app (grep `INSERT INTO accounting_accounts_v2` = 0).
**Consecuencias:** v1 gana semántica fiscal sin perder jerarquía; v2 queda como legado congelado (sin escritores nuevos).
**Compatibilidad:** Aditiva (`ADD COLUMN ... NULL`). No rompe consumidores de v1.
**Riesgos:** Colisión de nombre `account_type` (libre en v1 vs CHECK en v2) → usar columna nueva `account_type_norm` para no romper datos v1 existentes.
**Rollback:** Las columnas nuevas son `NULL`-ables; se pueden ignorar. v2 nunca se tocó.
**Trabajo futuro:** Retiro formal de v2 tras confirmar 0 filas en prod (fase de retiro, ver plan de transición).

---

## ADR-003 — GastoCheck: lectura de cuenta normalizada sin tocar el módulo
**Estado:** Propuesto.
**Contexto:** `expenses.accounting_account_id` apunta a **v1** (FK viva, `20260615300000:11`); el intento de
apuntar a v2 (`20260623000001:62`) fue **no-op** por `ADD COLUMN IF NOT EXISTS` sobre columna preexistente.
Además existe `expenses.accounting_account_code` desnormalizado (`20260615300000:12`).
**Opciones:** (A) renombrar/limpiar campos ya; (B) vista/función adaptadora de solo lectura que normalice;
(C) tabla de equivalencias.
**Decisión recomendada:** **(B) vista adaptadora de solo lectura** (`contacheck_expense_account_v`) que
resuelva la cuenta única desde `accounting_account_id`→v1 con fallback a `accounting_account_code`, sin
alterar `expenses`.
**Evidencia:** FK viva a v1 (`20260615300000:11`); code desnormalizado (`:12`); el motor DB actual asume v2
y por eso está roto (ver ADR-004).
**Consecuencias:** ContaCheck lee una cuenta consistente aunque GastoCheck conserve su estructura.
**Compatibilidad:** 100% no invasiva (solo `CREATE VIEW`, sin ALTER a `expenses`).
**Riesgos:** Divergencia entre `accounting_account_id` y `accounting_account_code` → la vista valida y marca conflicto.
**Rollback:** `DROP VIEW`.
**Trabajo futuro:** Limpieza posterior del campo desnormalizado (fase de migración de referencias).

---

## ADR-004 — Motor de pólizas: reutilizar reglas de `poliza.ts`, reemplazar el motor DB roto
**Estado:** Propuesto.
**Contexto:** Hay dos "motores": (1) `apps/web/lib/poliza.ts` — librería TS **pura de cliente**, no persiste;
(2) `generate_accounting_entries` / `export_policy_*` en SQL (`20260623000001:157-296`).
**Evidencia de estado real:**
- `poliza.ts` es librería pura (no DB, no transacción, no idempotencia); su cabecera dice "para CobraCheck"
  (`apps/web/lib/poliza.ts:1`) y sirve a CobraCheck (`generatePolizaFromPayment:43`) y BancoCheck
  (`generatePolizaFromBankMatches:177`). **Bug:** un cobro de cliente se marca `tipo:'EGRESO'` con Banco al
  HABER (`:52,62-68`) — signo invertido para un ingreso. El mapeo de cuentas `CATEGORY_ACCOUNT` está
  **hardcodeado** (`:140-152`) y duplicado con el móvil.
- El motor SQL está **estructuralmente roto**: `generate_accounting_entries` hace
  `LEFT JOIN accounting_accounts_v2 aa ON e.accounting_account_id = aa.id` (`20260623000001:180`) pero ese
  campo contiene ids de **v1** → NULL → `INSERT` con `account_id` NULL falla (columna NOT NULL, `:79`).
  Contrapartida hardcodeada `'1010'` buscada **en v2** (`:209`). Sin líneas separadas de IVA/retención.
- Ningún caller de `generate_accounting_entries`/`export_policy_*` en `apps/` ni `functions/` (grep = 0).
**Decisión recomendada:** **Reutilizar las REGLAS de partida doble de `poliza.ts` (probadas: split IVA 16%
en `splitBankFeeIVA:164`, líneas balanceadas) como especificación del motor de ContaCheck**, extraídas a
`packages/shared`; **descartar el motor SQL roto** (`generate_accounting_entries`) para el flujo nuevo (no
borrarlo en C1); el nuevo motor persiste en `accounting_vouchers` (ADR-005) leyendo v1 (ADR-001), con
contrapartida **configurable** y **IVA/retención como líneas separadas**.
**Consecuencias:** Se conserva el conocimiento de reglas ya validado, se elimina el acoplamiento roto a v2.
**Compatibilidad:** No invasiva (extracción a shared + tabla existente `accounting_vouchers`).
**Riesgos:** Corregir el signo del cobro (bug `poliza.ts:52`) al portar las reglas.
**Rollback:** Conceptual — el motor nuevo es aditivo.
**Trabajo futuro:** Deprecar `generate_accounting_entries`/`export_policy_*` tras el corte.

Clasificación de piezas (según §5 del prompt):
| Pieza | Veredicto |
|---|---|
| Reglas de líneas balanceadas + validación debe=haber (`poliza.ts:92-101,109-121`) | REUTILIZABLE CON EXTRACCIÓN |
| `splitBankFeeIVA` (IVA acreditable 16%) (`poliza.ts:164-168`) | REUTILIZABLE CON EXTRACCIÓN |
| `CATEGORY_ACCOUNT` hardcodeado (`poliza.ts:140-152`) | INSEGURA/INCOMPLETA (mover a servidor + `accounting_category_map`) |
| `generatePolizaFromBankMatches` (2 líneas por movimiento) (`poliza.ts:177-259`) | ESPECÍFICA DE BANCOCHECK (referencia para adaptador) |
| `generatePolizaFromPayment` (`poliza.ts:43-104`) | INSEGURA (signo invertido) |
| `generate_accounting_entries` / `export_policy_*` (SQL) | OBSOLETA/ROTA |

---

## ADR-005 — `accounting_vouchers` = tabla definitiva de pólizas de ContaCheck (ampliar, no reemplazar)
**Estado:** Propuesto.
**Contexto:** `accounting_vouchers` (`20260705130000_bancocheck_reconciliation_tables.sql:66-90`) ya modela
pólizas con multi-origen y balance.
**Evidencia (lo que ya tiene):** `company_id` (`:68`), `voucher_number UNIQUE` (`:70`), `voucher_type`
CHECK INCOME/EXPENSE/TRANSFER (`:71`), `source_module` (`:73`), **`source_ids UUID[]`** multi-origen (`:74`),
`total_debit`/`total_credit` (`:76-77`), `currency` (`:78`), `entries JSONB NOT NULL` (`:80`), export
tracking (`:82-84`), `status` CHECK draft/exported/reconciled (`:86`), **`CHECK (total_debit=total_credit)`**
(`:89`). RLS: SELECT miembro (`:129-131`), INSERT accountant/admin/owner/superadmin (`:133-139`); **sin
policy de UPDATE/DELETE** → efectivamente inmutable para `authenticated`.
**Lo que le falta (para preguntas §6):** `accounting_date`/período, `party_id` (tercero), fecha vs
`created_at`, referencia documental (CFDI), campo de **VoBo/aprobación** (solo hay `exported_by`), estado
`posted/contabilizado` vs `proposed`, **reversa/cancelación**, y líneas normalizadas (`entries` es JSONB, no
filas con FK a `accounting_accounts`).
**Decisión recomendada:** **Sí, es la tabla definitiva.** Ampliar de forma **aditiva**: añadir
`accounting_date`, `period_id`, `party_id` (ADR-006), `status` extendido (`proposed|posted|cancelled` como
columna nueva o CHECK ampliado), `approved_by`/`approved_at` (VoBo), `reverses_voucher_id` (reversa),
`document_ref`. Mantener `entries JSONB` como fuente y, opcionalmente, materializar líneas a una tabla
`accounting_voucher_lines` con FK a v1 para reportes (mayor/balanza).
**Respuestas §6:** (1) Sí. (2) período, fecha contable, tercero, VoBo, reversa, líneas normalizadas.
(3) `source_module`/`source_ids` mezclan trazabilidad con contenido — OK, se conserva. (4) cambios aditivos =
compatibles. (5) cambiar el CHECK de `status` o `entries` a NOT NULL distinto = potencialmente destructivo →
usar columnas nuevas. (6) Sí, se amplía sin reemplazar. (7) `status='proposed'` vs `'posted'`. (8) Bloquear
edición: no crear policy UPDATE (ya no existe) + trigger que rechace cambios si `status='posted'`. (9) Reversa
= nueva póliza espejo con `reverses_voucher_id`. (10) `source_ids UUID[]` ya soporta múltiples orígenes.
**Compatibilidad:** Aditiva. El `CHECK` de balance y la inmutabilidad ya son deseables.
**Riesgos:** `voucher_number UNIQUE` global (no por empresa) — revisar numeración por empresa/período.
**Rollback:** Columnas nuevas NULL-ables.
**Trabajo futuro:** Tabla de líneas normalizada + períodos (ADR en C2).

---

## ADR-006 — Modelo transversal de terceros = `parties` + `party_links` (no invasivo)
**Estado:** Propuesto (decisión de negocio de Juan pendiente; ver también decisión C0).
**Contexto:** No existe party master (grep de `parties`/`terceros`/`contactos` = 0 tablas). El mismo tercero
se duplica garantizadamente entre módulos.
**Evidencia:** Tablas siloadas sin clave compartida: `suppliers.rfc` **sin unicidad** (`20260608000003:59`
es índice no único), `cobra_clients.rfc` unicidad parcial `(company_id,rfc) WHERE rfc IS NOT NULL`
(`20260618200001:28-29`), `cfdi_clients` unicidad `(company_id,rfc)` + set fiscal completo
(`20260712070000:16-25`), `fleet_clients` **sin identidad fiscal** (`20260610000002:52-60`),
`nomi_employees` con **RFC cifrado + `rfc_hash`** (`20260722210000:49-51`, unicidad por
`(company_id,rfc_hash)` `:82`). Único enlace cross-módulo hoy: `bank_transactions.linked_client_id`/
`linked_supplier_id` (`20260721100000:17,19`).
**Decisión recomendada:** **`parties` (directorio canónico) + `party_links` (rol por módulo)**, no invasivo:
cada módulo **conserva su tabla** y gana un `party_id` **opcional** (patrón que ya usa `bank_transactions`).
`cfdi_clients` es la mejor plantilla de esquema (set SAT completo, `20260712070000:16-21`).
- **Campos mínimos `parties`:** `id`, `company_id`, `kind` (persona/moral), `rfc` (normalizado
  `upper(trim)`), `rfc_hash` (HMAC ciego, para reconciliar con nómina vía `nomi_blind_hash`,
  `20260722210000:24`), `razon_social`/`nombre`, `regimen_fiscal`, `codigo_postal`, `email`, `phone`,
  `status`, `created_at`.
- **`party_links`:** `party_id`, `module` (gasto/cobra/factura/nomina/banco), `entity_table`, `entity_id`,
  `role` (cliente/proveedor/empleado/contraparte), `is_active` → un mismo `party_id` puede ser cliente **y**
  proveedor **y** empleado sin borrar registros operativos.
- **Deduplicación:** clave primaria `(company_id, rfc_normalizado)`; para nómina, comparar por `rfc_hash`
  (RFC cifrado, no hay join en claro); fallback `(company_id, normalized_name)` cuando falta RFC
  (`suppliers.normalized_name` `20260608000003:40`); **special-case RFCs genéricos** `XAXX010101000`/`XEXX010101000`.
**Consecuencias:** Directorio único sin migrar datos operativos; reconciliación contable por tercero posible.
**Compatibilidad:** Aditiva (tabla nueva + columna `party_id` opcional por módulo). Nada se borra.
**Riesgos:** PII de nómina — `parties` NO debe guardar RFC de empleado en claro; se enlaza por `rfc_hash`
(ver ADR de seguridad C1).
**Rollback:** `DROP` de `parties`/`party_links`; las columnas `party_id` opcionales quedan NULL.
**Trabajo futuro:** Alta por Constancia de Situación Fiscal + OCR (decisión ya tomada por Juan) como fuente
de `parties`.

---

## ADR-007 — Autoridad de cuentas bancarias
**Estado:** Aceptado (evidencia concluyente) con un punto de negocio pendiente.
**Contexto:** `bank_accounts` (operativa) y `company_bank_accounts` (fiscal) coexisten sin FK entre sí.
**Decisión:** **`bank_accounts` = autoritativa operativa/contable** (única con `current_balance`
`20260618300000:12`, movimientos `bank_transactions` `:22`, y enlace contable
`bank_transactions.accounting_account_id` `20260721100000:15`); **`company_bank_accounts` = autoritativa
fiscal** (única con `clabe`+`account_holder` `20260629010000:9-10`, referenciada por `receipts.bank_account_id`
`:45-46`). **Puente explícito** a diseñar: columna opcional de correlación entre ambas.
**Evidencia:** ver `CONTACHECK_C1_CUENTAS_BANCARIAS.md` (tabla de autoridad por campo).
**Riesgos:** Datos maestros duplicados sin sincronizar (banco, last4, tipo, moneda). `is_primary` no existe
en ninguna → decisión de negocio: definir cuenta principal.
**Rollback:** El puente es una columna opcional; reversible.

---

## ADR-008 — Perfil fiscal empresarial versionado = `company_tax_profiles`
**Estado:** Propuesto.
**Contexto:** `companies` tiene `rfc` (`20260606000001_init.sql:41`) pero **no** `regimen_fiscal`, no
`codigo_postal` (solo `cp`, `20260614200000:6`), sin CSD, sin versionado. El régimen y los CSD cifrados viven
en `cfdi_provider_configs` (`20260618300002_facturacheck_schema.sql:71-78`).
**Decisión recomendada:** **No** añadir solo `regimen_fiscal` suelto a `companies`. Crear entidad
**versionada `company_tax_profiles`** (nombre libre, grep = 0) con vigencia (`valid_from`/`valid_to`,
`is_active`), `rfc`, `razon_social`, `regimen_fiscal`, `codigo_postal_fiscal`, `pais`, `moneda_funcional`,
consolidando la identidad hoy partida entre `companies` (`init:40-41`, dirección `20260614200000`/`400000`) y
`cfdi_provider_configs` (`20260618300002:71-74`). Los CSD siguen cifrados en su tabla (no se mueven), el
perfil referencia su vigencia.
**Consecuencias:** Fuente única de identidad fiscal, historizada (rotación de régimen/CSD).
**Compatibilidad:** Aditiva. `companies` no se rompe; sus columnas quedan como legado leído por el perfil.
**Riesgos:** Doble verdad temporal hasta migrar consumidores → capa de compatibilidad (vista `companies_fiscal_v`).
**Rollback:** `DROP` tabla nueva; `companies` intacto.

---

## ADR-009 — Integración no invasiva por adaptadores (ratifica C0)
**Estado:** Aceptado.
**Decisión:** Un adaptador por módulo traduce el **evento que ya confirma el hecho económico** (transición
de estado existente) al contrato normalizado; ContaCheck no modifica los módulos. Mecanismo inicial:
**vistas de solo lectura**; evaluar **trigger→outbox** solo donde importe la latencia. BancoCheck ya tiene un
punto de enganche natural en `bancocheck_approve_suggestion` (`20260712050000`).
**Evidencia/consecuencias/rollback:** ver `CONTACHECK_C1_COMPATIBILIDAD.md` y C0 doc 7.

---

## ADR-010 — Piloto de primer adaptador
**Estado:** Propuesto (matriz en `CONTACHECK_C1_RESUMEN_EJECUTIVO.md` §piloto).
**Decisión recomendada:** **BancoCheck**, por evidencia (ya clasifica a v1, ya tiene VoBo del contador, ya
trae la contrapartida bancaria para conciliación), sin alterar el módulo. Alternativas comparadas: GastoCheck
(motor propio pero roto) y NóminaCheck (limpio pero sin UI aún, Fase 1B).
