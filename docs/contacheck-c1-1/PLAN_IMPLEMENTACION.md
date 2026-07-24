# ContaCheck · C1.1 — Plan de Implementación

> Secuencia por etapas (§17), niveles de automatización (§16) y pruebas obligatorias (§18). Aditivo y
> reversible. No hay migraciones aquí; es el diseño ejecutable.

## Gate previo
Verificar objetos reales en prod (no `schema_migrations`, ver `DRIFT_AUDIT_2026-07-22.md`): filas en
`accounting_accounts_v2`; existencia de `cobra_collections`/`cobra_commissions` (migración revertida
`20260708000001:4-10`); FK de `expenses.accounting_account_id` a v1; esquema de `accounting_vouchers`
(`20260705130000`). Ratificaciones de negocio ya dadas en C1.1.

## §16 — Niveles de automatización de una póliza
| Nivel | Criterio objetivo |
|---|---|
| `AUTO_POST` | regla única y específica + cuenta activa + período abierto + balance OK + (si `requires_cfdi`) CFDI presente + tercero resuelto + dimensiones obligatorias presentes + sin duplicado (idempotencia) |
| `AUTO_APPROVE` | como AUTO_POST pero la póliza queda `approved` esperando corrida de posteo (política de la empresa) |
| `REVIEW_REQUIRED` | importe extraordinario (umbral), tercero nuevo, o clasificación por IA de baja confianza |
| `CONFIGURATION_REQUIRED` | **regla ausente**, **dos reglas misma prioridad/especificidad** (ambigua), cuenta ausente/inactiva, dimensión obligatoria ausente, CFDI requerido ausente, impuesto inconsistente, tercero no identificado |
| `REJECTED` | período cerrado (va a corrección en período abierto), movimiento bancario duplicado, inventario negativo (`allow_negative_inventory=false` `20260712080000:49`), balance imposible |

## §17 — Secuencia por etapas

### Etapa 1 — Infraestructura mínima (aditiva)
- **Cambios:** catálogo autoritativo v1 (+cols fiscales de v2); ampliar `accounting_vouchers` (encabezado);
  `accounting_voucher_lines`; `accounting_periods`; `accounting_source_links`; estados/ciclo; `idempotency_key`
  por empresa; reversas (self-FK); feature flags.
- **Dependencias:** gate previo.
- **Riesgos:** bajos (todo `ADD COLUMN NULL`/tablas nuevas). Colisión `account_type` → `account_type_norm`.
- **Pruebas:** balance CHECK; RLS multiempresa; inmutabilidad `posted`; idempotencia unique por empresa.
- **Rollback:** DROP tablas nuevas / columnas NULL.
- **Avance si:** esquema ampliado sin regresión en los 2 writers actuales (`conciliacion/page.tsx:187`,
  `useFacturaCheck.ts:423`).

### Etapa 2 — Piloto técnico BancoCheck
- **Cambios:** motor de reglas (mín. viable) + adaptador BancoCheck que propone/persiste vía contrato;
  conciliación con `accounting_source_links`; VoBo reusando gate de `bancocheck_approve_suggestion`
  (`20260712050000`).
- **Dependencias:** Etapa 1.
- **Riesgos:** doble contabilización → idempotencia; cuentas hardcodeadas → motor.
- **Pruebas:** contrato balanceado; no-duplicidad; VoBo; reversa; concurrencia.
- **Rollback:** flag off; propuestas `cancelled`.
- **Avance si:** N movimientos → pólizas correctas sin tocar BancoCheck.

### Etapa 3 — Piloto funcional GastoCheck
- **Cambios:** adaptador que dispara en `authorized`; vista de origen normalizada (cuenta v1 + montos con
  prioridad `receipts`); IVA/retención como líneas; conciliación del pago (`accounts_payable.paid`) vía Banco.
- **Dependencias:** Etapas 1–2; cerrar gap `reembolsos`→`closed`.
- **Riesgos:** montos triplicados/divergentes; retenciones solo en `receipts`.
- **Pruebas:** gasto con/sin CFDI; con/sin `receipt_id`; anticipo; impuestos; conciliación pago.
- **Rollback:** flag por módulo.
- **Avance si:** gasto→póliza correcta + conciliación.

### Etapa 4 — CobraCheck
- **Cambios:** adaptador ingreso/CxC/cobro. **Requiere primero** cerrar brechas de datos: retenciones, moneda,
  nota de crédito (ausentes en `cobra_invoices`, grep confirmado) y reversa de pago (sin trigger DELETE).
- **Dependencias:** Etapas 1–3 + verificación de `cobra_collections`/`cobra_commissions` en prod.
- **Riesgos:** comisión hardcodeada 3% (`route.ts:130`) ignora `company_members.commission_rate`.
- **Pruebas:** devengo, cobro total/parcial, cancelación, nota de crédito.
- **Rollback:** flag.
- **Avance si:** ciclo CxC contabiliza correcto.

### Etapa 5 — NóminaCheck
- **Cambios:** adaptador provisión (`approved`) / pago (`paid_at`) / cancelación. Aprovecha
  `suggested_account_debit/credit` (`20260722210000:107-108`) y `nomi_tax_withholdings.account_code` (`:133`).
- **Dependencias:** Fase 1B de Nómina (UI); Etapas 1–2.
- **Riesgos:** PII — usar `nomi_employees.id`/`rfc_hash`, nunca RFC en claro; sin RPC de reversa post-pago.
- **Pruebas:** provisión con retenciones; pago; cancelación; sin exposición de PII.
- **Rollback:** flag.
- **Avance si:** provisión+pago contabilizan sin PII.

### Etapa 6 — Inventarios
- **Cambios:** **FUTURA** — requiere lógica de valuación/COGS (hoy solo en el esquema `inv_*` **descartado**,
  `inv_valuations.cost_of_goods_sold` `20260708000003:138`; el esquema vivo `inventory_movements` no tiene COGS).
- **Dependencias:** Etapas 1–5 + diseño de valuación (PEPS/promedio).
- **Riesgos:** doble fuente de costo; método de valuación no definido.
- **Pruebas:** entrada/salida/merma/ajuste → COGS.
- **Rollback:** flag.
- **Avance si:** movimientos de inventario producen COGS correcto.

## §18 — Pruebas obligatorias (diseño)
| Prueba | Qué valida | Referencia |
|---|---|---|
| Balance cargo-abono | `Σdebit=Σcredit` | `CHECK` (`20260705130000:89`) |
| Idempotencia | misma llave no duplica | índice único por empresa (patrón `inventory_movements` `20260712080000:43`) |
| Concurrencia | 2 procesos → 1 póliza | constraint BD, no solo app |
| Multiempresa / RLS | aislamiento `company_id` | RLS `accounting_vouchers` (`:127-139`) |
| Período cerrado | rechazo/deriva a período abierto | `accounting_periods` (nuevo) |
| Cuenta inactiva | excepción | `accounting_accounts.active` |
| Regla ausente / ambigua | `CONFIGURATION_REQUIRED` | motor de reglas |
| Reversa | contra-asiento, no edición | ciclo estados |
| Doble contabilización bancaria | Banco concilia, no duplica | `accounting_source_links` |
| Cambio posterior | `source_version`+reversa+corregida | idempotencia |
| Moneda extranjera | `currency`+`exchange_rate` | contrato |
| Impuestos | IVA/retención como líneas | contrato §2 |
| Dimensiones | obligatoriedad por regla/cuenta | `expense_category_rules.required_field` (`20260608000003:314`) |
| Trazabilidad | `accounting_source_links` completo | — |
| Inmutabilidad | `posted` no editable | trigger + RLS |
| Feature flag | on/off por módulo/empresa | — |
| Rollback | reversión de etapa sin pérdida | por etapa |

## Reversibilidad
Etapas 1–6 son aditivas/flag. Retiro de legado (`accounting_accounts_v2`, `accounting_entries`,
`generate_accounting_entries`, `export_policy_*`) es una **fase final aparte**, con evidencia de 0 dependencias
y 0 filas en prod. La contabilidad nunca se edita/borra: se corrige por reversa.
