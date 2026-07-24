# Estado — ContaCheck y NóminaCheck (2026-07-24)

> Reporte consolidado. Honesto sobre lo hecho, lo pendiente y por qué "terminar" cada módulo no es de un solo paso.

---

## A) Incidente de seguridad (transversal) — CERRADO
- `service_role` de producción estaba **hardcodeada en GitHub** (viva). **Resuelto:** migrado a nuevas API keys
  (`sb_secret`/`sb_publishable`), 48 Edge Functions migradas (fallback), **legacy JWT keys deshabilitadas** → la
  llave filtrada quedó **invalidada**. Verificado: todo corre con las llaves nuevas. `NOMI_HMAC_KEY` (estaba vacía)
  **seteada**. Árbol de código limpio + gitleaks en CI.
- **Pendiente (higiene, sin urgencia):** `push --force` de la historia purgada (mirror ya reescrito, 0 tokens);
  hacerlo tras commitear el trabajo actual.

---

## B) ContaCheck

### Dónde va
Fases **C0 → C1 → C1.1 → C2A → C2B → C3A → C3A.1 → C3A.2** completadas (docs en `docs/contacheck-*`).
- **C2B (implementación):** ✅ 16 migraciones + rollback + suite **49/49** aplicadas y probadas en **PG17 local**.
  Núcleo contable: catálogo autoritativo, `accounting_vouchers` ampliada (41 cols), líneas, orígenes,
  idempotencia, reversas, periodos, dimensiones, motor de reglas, RPC (SECURITY DEFINER + search_path), RLS,
  feature flags (default LEGACY). Pilotos BancoCheck + GastoCheck probados.
- **C3A/C3A.1/C3A.2 (gate a producción):** paquete aislado `deploy/contacheck-c3b/` **validado en PG17**
  (preflight aborta ante drift, postflight 8/8). Verificado prod: baseline compatible, **0 pólizas**, v2 vacío,
  18 tablas C2B ausentes (sin colisión).

### Qué falta para "terminar"
1. **Desplegar C2B a prod (C3B)** — **desbloqueado ahora que el incidente de seguridad se cerró**. Requiere (de
   Juan, no puedo hacerlo yo): (a) correr `scripts/contacheck-c3a/05,06,07` en el SQL Editor (FK de expenses,
   colisiones, triggers/RLS); (b) confirmar **backup/PITR + snapshot previo**; (c) aplicar el paquete **aislado**
   (nunca `supabase db push`). Yo verifico después.
2. **Adaptadores por evento** (post-deploy): conectar GastoCheck (`authorized`→póliza), BancoCheck (conciliación),
   luego CobraCheck/NóminaCheck. Activación gradual por empresa (LEGACY→SHADOW→CONTACHECK).
3. **Cerrar equivalencia BancoCheck** `20260721100000` (FK/RPC 9-arg) antes de su adaptador.
4. **UI contable** (libro/pólizas/estados financieros) — fase posterior.
5. **Validación SAT real** (hoy `validate_cfdi_with_sat` es simulada) para acreditar IVA.

**Veredicto actual:** el motor contable está construido y probado; **falta el despliegue controlado a prod**
(acciones de Juan) y luego los adaptadores/UI. No es "un turno más".

---

## C) NóminaCheck

### Dónde va
**Fase 1A**: backend seguro `nomi_*` desplegado en prod (PII cifrada, 16 capacidades, RLS, segregación,
aprobación con optimistic lock). `NOMI_HMAC_KEY` ya seteada → escritura de PII operativa. **Sin UI, sin motor de
cálculo.** Cubre ~10-15% de un producto de nómina comercial.

### Decisión de Juan
**"Cierre comercial completo"** (equivalente a Aspel NOI / CONTPAQi). Es un build **grande, multi-fase**.

### Análisis de brechas vs. sistemas líderes (§27) — lo que FALTA
| Área | Estado | Falta para operar |
|---|---|---|
| Expediente empleado | Parcial | domicilio, contactos, fecha nac., tipo contrato/jornada, uso CFDI, centro de costo, documentos versionados |
| Asistencia / checadores | Parcial | capa de integración (ZKTeco/Hikvision/… vía CSV/API), normalización a modelo único |
| Horarios / Turnos | Ausente | fijo/flexible/rotativo/nocturno/12x12/24x24; descansos, tolerancias, festivos |
| Incidencias | Parcial | catálogo + workflow (permisos, incapacidades, vacaciones, home office) |
| Horas extra | Parcial | dobles/triples/nocturnas/dominicales (LFT) |
| Vacaciones | Ausente | saldos/acumulación (reforma 2023), prima vacacional |
| **Motor de cálculo** | **Ausente** | **ISR (art. 96 + subsidio), IMSS (SBC/SDI, cuotas, topes UMA), INFONAVIT, aguinaldo, PTU, finiquito/liquidación** |
| Conceptos de nómina | Ausente | catálogo configurable (percepciones/deducciones + tratamiento fiscal/IMSS/CFDI) |
| Prenómina | Ausente | generación, comparación, versionado, bitácora |
| **CFDI de nómina 1.2** | Ausente | complemento de nómina, timbrado por trabajador (vía convenio Facturama) |
| Dispersión bancaria | Ausente | layouts BBVA/Banorte/Santander/SPEI |
| Contabilización | Ausente | provisión/pago/retenciones → contratos ContaCheck |
| Portales empleado/supervisor | Ausente | recibos, vacaciones, aprobaciones |
| Reportes / Dashboard / IA | Ausente | recibos, acumulados, costos por dimensión, indicadores |

### Riesgos si se opera sin esto
- **Fiscal:** ISR/IMSS mal calculado = multas SAT/IMSS; CFDI de nómina mal timbrado = no deducible.
- **Laboral:** finiquitos/vacaciones mal = demandas.
- **Técnico:** sin motor, la nómina depende de que el usuario meta montos → no es producto.

### Roadmap propuesto (fases)
1. **N1 — Expediente + catálogos SAT** (régimen/contrato/jornada/riesgo puesto) + centro de costo.
2. **N2 — Motor de cálculo** ISR/IMSS/INFONAVIT/subsidio + tablas UMA/SMG por año (el corazón).
3. **N3 — Conceptos + Prenómina + Nómina** (semanal/quincenal/…); inmutable al aprobar.
4. **N4 — CFDI de nómina 1.2** (timbrado vía Facturama) + cancelación/sustitución.
5. **N5 — Dispersión** (layouts bancarios) + conciliación BancoCheck.
6. **N6 — Contabilización** (adaptador → ContaCheck).
7. **N7 — Asistencia/checadores + horarios/turnos/incidencias/vacaciones/horas extra**.
8. **N8 — Portales + Reportes + Dashboard + IA**.

**Veredicto:** NóminaCheck es hoy una base segura, **no un producto operable**. El "cierre comercial completo"
es un desarrollo por fases (semanas/meses). No puede terminarse en un turno; N2 (motor de cálculo) es el
siguiente paso de mayor valor.

---

## D) Qué se puede hacer YA (sin prod / sin Juan)
- **ContaCheck:** nada de despliegue (es de Juan). Sí puedo: cerrar la equivalencia BancoCheck en diseño, o
  empezar el **diseño del adaptador GastoCheck** (código que propone póliza en `SHADOW`).
- **NóminaCheck:** empezar **N1/N2** (expediente ampliado + motor de cálculo ISR/IMSS) — es la ruta crítica y
  no requiere prod.

**Recomendación:** desbloquear C3B con Juan (05/06/07 + backup) para dejar ContaCheck desplegado, y en paralelo
arrancar **NóminaCheck N2 (motor de cálculo)**, que es lo que convierte la base en producto.
