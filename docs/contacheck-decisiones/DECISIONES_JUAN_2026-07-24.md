# ContaCheck — Decisiones de alcance (Juan, 2026-07-24)

Respuestas a las 12 preguntas. Estas definen el alcance del build de contabilidad.

| # | Tema | Decisión | Implicación de build |
|---|---|---|---|
| 1 | **Despliegue C2B a prod** | **SÍ**, coordinar con Juan | Correr scripts read-only 05/06/07 + backup + aplicar paquete aislado `deploy/contacheck-c3b/` |
| 2 | **Catálogo de cuentas** | El **que el SAT autoriza** (código agrupador / Anexo 24). **Juan lo anexará** (pendiente de recibir). Deprecar v2. | Cargar catálogo con `sat_grouping_code`; UI de importación. Mientras: usar código agrupador SAT estándar |
| 3 | **Reglas de contabilización** | **Precargarlas** yo | Semilla de reglas por evento: gasto→6xxx+IVA acred+proveedor; cobro→bancos+clientes+IVA trasladado; nómina→sueldos+ISR+IMSS+INFONAVIT; comisión banco→gasto+IVA; etc. |
| 4 | **Terceros** | **Unificar** → `parties` | Directorio único cliente+proveedor+empleado con RFC; alta por Constancia fiscal + OCR; `party_id` opcional por módulo |
| 5 | **Cuentas bancarias** | **Varias cuentas con CLABE** | `company_bank_accounts` (CLABE/titular, fiscal) + `bank_accounts` (operativa/saldos); soporte multi-cuenta; contrapartida por cuenta |
| 6 | **Régimen fiscal** | **Todos, según el cliente** | `regimen_fiscal` configurable por empresa (perfil versionado `company_tax_profiles`); catálogo SAT de regímenes |
| 7 | **Alcance SAT** | **Ambos**: entregar al SAT **y** exportar a otros sistemas | Contabilidad electrónica (catálogo + balanza + pólizas **XML** mensual) **y** export CONTPAQi/Aspel/Excel |
| 8 | **Validación CFDI** | **Real en SAT** | Integrar validación SAT real (servicio/convenio); sustituir `validate_cfdi_with_sat` simulada |
| 9 | **Automatización** | **Por autorizar** (VoBo del contador, evitar basura) | Pólizas se generan en **borrador** → revisión/aprobación (segregación) → contabilizar. Nada auto-posted |
| 10 | **Cierre de periodo** | **SÍ** (mensual formal + anual) | Estados de periodo open/closed/locked; bloqueo de posteo; póliza de cierre; rol `contador_general` |
| 11 | **Multimoneda** | **SÍ** (MXN + USD) | `currency_code` + `exchange_rate` en pólizas/líneas; revaluación cambiaria |
| 12 | **Estados financieros** | **Balanza de comprobación, Diario de pólizas, Estado de resultados, Balance general, y comparativo vs presupuesto** | Reportes contables + módulo de presupuesto y comparativo |

## Roadmap ContaCheck (revisado con estas decisiones)
- **C3B — Desplegar C2B a prod** (base contable) — *autorizado (#1)*, con los pasos read-only + backup.
- **CT1 — Catálogo SAT + reglas precargadas + `parties` unificado** (#2, #3, #4).
- **CT2 — Adaptadores por evento** (Gasto/Banco/Cobro/Nómina) → pólizas en borrador (#9).
- **CT3 — Cierre de periodo + multimoneda** (#10, #11).
- **CT4 — Validación CFDI real** (#8).
- **CT5 — Contabilidad electrónica SAT** (catálogo+balanza+pólizas XML) + export CONTPAQi/Aspel (#7).
- **CT6 — Estados financieros + presupuesto** (balanza, diario, ER, BG, comparativo) (#12) + UI móvil/web.

## Pendiente de Juan
- **Anexar el catálogo de cuentas autorizado por el SAT** (#2) — no llegó el adjunto.
