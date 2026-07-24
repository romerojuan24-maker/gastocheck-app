# NóminaCheck · Fase Final — Auditoría Inicial (§1)

> Diagnóstico del estado real del módulo **antes de tocar código**, con evidencia `archivo:línea`. Sin
> suposiciones. Base: 3 auditorías paralelas del repo (esquema/backend, UI/móvil, API/Edge/pruebas).

## 0. Veredicto de estado
**NóminaCheck está en Fase 1A: es un *libro mayor* de nómina seguro (backend), NO un *motor* de nómina, y no
tiene interfaz.** Cubre ~10-15 % de lo que este spec de cierre exige. La mayor parte (§2–§24) está por construir.

## 1. Componentes TERMINADOS (desplegados en prod)
- **Esquema seguro `nomi_*`** — `20260722210000_nomicheck_secure_schema.sql` (única migración; 9 tablas + 1
  vista + 12 funciones): `nomi_employees` (`:39`), `nomi_payroll` (`:88`), `nomi_tax_withholdings` (`:125`),
  `nomi_attendance` (`:140`), `nomi_employee_bank_accounts` (`:156`), `nomi_capabilities` (`:182`),
  `nomi_role_capabilities` (`:203`), `nomi_user_capabilities` (`:239`), `nomi_user_scopes` (`:262`).
- **PII cifrada** (RFC/NSS/CURP: `encrypted_*`+`*_hash`+`*_last4`, `:49-57`) + banca cifrada (`:156-173`).
- **Modelo de autorización**: 16 capacidades (`:183-200`), `nomi_can` (`:281`), `nomi_in_scope` (`:313`),
  scopes por company/branch/department/cost_center/team/employee/self (`:267`).
- **RLS por operación** en las 9 tablas (`:377-385`); **sin DELETE físico** (`:375`); grants a nivel columna
  ocultan PII al cliente (`:453-493`).
- **Aprobación con segregación de funciones**: `nomi_approve_payroll` (`:621`) + guard (`:525`, calculador ≠
  aprobador salvo admin) + optimistic lock (`version`).
- **3 Edge Functions desplegadas**: `nomi-employee-pii` (escribe PII cifrada), `nomi-employee-identity` (único
  camino de descifrado, auditado), `nomi-bank-account` (banca cifrada). Endurecidas (JWT, límite de body,
  validación de formato, tenant check, auditoría con solo last4).
- **Integración de lectura**: vista `nomi_cashflow_commitments` (`:699`) consumida por FlujoCheck
  (`apps/web/app/api/flujocheck/dashboard/route.ts:185`; `apps/mobile/lib/flujocheck-logic.ts:177-200`).
- **Pruebas**: `NOMICHECK_1A_TESTS.sql` (suite RLS/capacidades, 42 asserts en disco).

## 2. Componentes PARCIALES
| Área | Qué hay | Qué falta | Evidencia |
|---|---|---|---|
| Expediente | núcleo + identidad fiscal cifrada | domicilio, contactos emergencia, fecha nacimiento, sexo, estado civil, nacionalidad, tipo contrato, tipo jornada, uso CFDI, centro de costo | `nomi_employees:39-77` |
| Asistencia | `nomi_attendance` (manual) | importación de checador (cero), horas por marcaje | `:140-151` |
| Horas extra | 1 columna `hours_overtime` | reglas dobles/triples/nocturnas/dominicales, cálculo de pago | `:147` |
| Vacaciones | solo estado `'vacaciones'` | saldos, acumulación LFT, solicitud/autorización, prima vacacional | `:145` |
| Incidencias | enum en `nomi_attendance` | catálogo dedicado + workflow de aprobación | `:145` |
| Contabilidad | `suggested_account_debit/credit` (`:107-108`), `export_accounting` cap (`:196`) | generador de póliza (usa contratos ContaCheck C2B) | — |
| Reportes | `nomi_payroll_summary` (agrega, no calcula) | recibos, acumulados, ISR/IMSS, costos por dimensión | `:667-691` |

## 3. Componentes AUSENTES (Fase 1B+ / no construidos)
- **Motor de cálculo ISR/IMSS/INFONAVIT/subsidio** — solo columnas de almacenamiento (`:101-102`), **cero
  fórmulas** en SQL o Edge Functions (grep confirmado). `nomi_payroll_summary` solo **suma** valores ya guardados.
- **Horarios, Turnos, Catálogo de conceptos** — sin objeto en ninguna migración.
- **Prenómina** — sin objeto; el `draft` de `nomi_payroll` es lo más cercano, sin workflow ni UI.
- **CFDI de nómina (complemento 1.2)** — no ligado; `timbrar-cfdi` es de factura general, sin referencia a nómina.
- **Dispersión bancaria** (BBVA/Banorte/Santander/SPEI) — solo puntero `paid_via_bank_transaction_id` (`:115`);
  sin generación de layout/lote.
- **UI completa** — **cero** pantallas web y móvil (no existe `nominacheck/` en `apps/`). Sin ruta de API web.
- **Portales** (empleado / supervisor) — inexistentes.
- **IA de análisis** — inexistente.

## 4. Duplicados / Obsoletos / Deuda / Mocks / Stubs / Código muerto
- **Duplicados:** ninguno dentro de NóminaCheck (el stub inseguro `20260708000004` fue **reemplazado y nunca se
  aplicó a prod**, header `:4`).
- **Mocks/stubs/TODO/FIXME dentro de `nomi-*`:** **cero** (grep confirmado; los mocks del repo son de otros
  módulos: `cobra-sat-validator`, `validate-batch-sat`, `advisor-ask`).
- **Deuda técnica identificada:**
  1. **`NOMI_HMAC_KEY` sin configurar en prod** → `nomi-employee-pii` responde 500 (escritura de PII dormida)
     (`NOMICHECK_1A_PRODUCTION_DEPLOYMENT.md:41-43,58-63`). *Acción de Juan.*
  2. **Discrepancia de pruebas:** el archivo en disco tiene **42 asserts**; los docs (`CIERRE.md:8`) reportan
     **53** — la suite expandida está descrita pero **no existe como archivo** (`ENTREGA.md:11,30`).
  3. **Rotación de llaves** documentada pero no implementada (`ENTREGA.md:60`).
  4. **Rate-limiting distribuido** pendiente de infra (`CIERRE.md:31-32`).
  5. **`tax_regime`** solo 3 valores (asalariado/honorarios/independiente, `:69`), **no** el catálogo SAT de régimen.
  6. **Drift histórico** de migraciones: el repo no es replayable limpio (`CIERRE.md:42-56`).

## 5. Conclusión de la auditoría
Fase 1A entregó una **base de seguridad y datos de primer nivel** (cifrado, capacidades, RLS, segregación,
auditoría) — mejor que muchos sistemas comerciales en ese eje. Pero **como producto de nómina no opera**: sin
motor de cálculo, sin conceptos, sin CFDI de nómina, sin dispersión y sin UI, no puede correr la nómina de una
empresa real. El cierre exige construir prácticamente todo el producto encima de esta base. Ver
`GAP_ANALYSIS_Y_RIESGOS.md` y `ROADMAP_CIERRE.md`.
