# AUDITORÍA BASE 001 — PLAN DE TRABAJO
**Check Suite / GastoCheck / CobraCheck**  
**Iniciada:** 2026-07-18  
**Estado:** En progreso

---

## DESCUBRIMIENTO INICIAL

El README describe un "MVP scaffold — Fase 0/1" pero el repositorio contiene:

### Estructura Real Encontrada
- **4 aplicaciones web/móvil:** 
  - apps/web (GastoCheck web)
  - apps/cobra-web (CobraCheck web)
  - apps/mobile (GastoCheck móvil)
  - apps/cobra-mobile (CobraCheck móvil)
  
- **111 migraciones de BD** que incluyen esquemas de:
  - GastoCheck (core)
  - CobraCheck (cobranza)
  - BancoCheck (reconciliación bancaria)
  - FlujoCheck (cash flow)
  - FacturaCheck (facturación)
  - InventarioCheck (inventario)
  - NomiCheck (nómina)
  - Advisor (IA)
  
- **54 Edge Functions** implementadas:
  - OCR, XML parsing, CFDI validation
  - WhatsApp, Email, notificaciones
  - Cobra scoring, collection workflows
  - Reconciliación automática
  - Advisor chatbot
  - BancoCheck auto-match
  - Y más...

### Discrepancia Crítica
La documentación dice "Fase 0/1" pero la BD tiene esquemas de 8+ módulos. Esto sugiere:
- ✅ Mucho código ha sido escrito
- ❓ Pero ¿qué está realmente operativo?
- ❓ ¿Qué está simulado?
- ❓ ¿Qué usa datos demo?

---

## FASES DE AUDITORÍA

### Fase 1: Mapeo Estructural ✅ EN CURSO
- [x] Identificar apps
- [x] Localizar migraciones
- [x] Contar Edge Functions
- [ ] Revisar primera migración base
- [ ] Revisar estructura de carpetas en web y mobile
- [ ] Crear mapa visual

**Objetivo:** Entender qué dice existir.

### Fase 2: Inventario de Funciones (PRÓXIMO)
- Rastrear todas las rutas en web
- Rastrear todas las pantallas en mobile
- Mapear menús visibles
- Crear matriz de botones → endpoints
- Clasificar por status de implementación

**Objetivo:** Entender qué es visible al usuario.

### Fase 3: Flujos End-to-End
- Inspeccionar código del flujo "crear empresa"
- Inspeccionar código del flujo "crear anticipo"
- Inspeccionar código del flujo "crear reembolso"
- Inspeccionar código del flujo "importar XML"
- Inspeccionar código del flujo "crear cuenta por cobrar"
- Y otros 25+ flujos

**Objetivo:** Separar ficción de realidad.

### Fase 4: Modelo de Datos
- Leer migraciones completas
- Mapear tablas y relaciones reales
- Identificar triggers y funciones
- Analizar RLS policies
- Detectar inconsistencias

**Objetivo:** Entender la fuente de verdad.

### Fase 5: Seguridad y Permisos
- Verificar aislamiento multi-tenant
- Revisar RLS en endpoints críticos
- Probar escalamiento de privilegios
- Validar auditoría y trazabilidad

**Objetivo:** Validar que los datos están protegidos.

### Fase 6: Defectos de Membrete
- Encontrar botones sin función
- Localizar datos demo en producción
- Identificar estados solo visuales
- Detectar integraciones simuladas

**Objetivo:** Crear lista de "esto parece funcionar pero no funciona".

### Fase 7: Síntesis
- Priorizar hallazgos
- Crear plan de corrección
- Generar checklist de lanzamiento
- Producir resumen ejecutivo

**Objetivo:** Responder las 10 preguntas finales.

---

## DOCUMENTOS ENTREGABLES

Ubicación: `docs/auditoria-base-001/`

| Documento | Fase | Prioridad | Status |
|-----------|------|-----------|--------|
| 00_PLAN_AUDITOR.md | 1 | 🔴 | ✅ EN PROGRESO |
| 01_MAPA_REPOSITORIO.md | 1 | 🔴 | ⏳ PENDIENTE |
| 02_MATRIZ_OPERATIVIDAD.md | 2 | 🔴 | ⏳ PENDIENTE |
| 03_FLUJOS_END_TO_END.md | 3 | 🔴 | ⏳ PENDIENTE |
| 04_MODELO_DATOS_ACTUAL.md | 4 | 🟠 | ⏳ PENDIENTE |
| 05_MODELO_OBJETIVO_CHECK_SUITE.md | 4 | 🟠 | ⏳ PENDIENTE |
| 06_PERMISOS_Y_SEGURIDAD.md | 5 | 🔴 | ⏳ PENDIENTE |
| 07_FUNCIONES_MEMBRETE.md | 6 | 🔴 | ⏳ PENDIENTE |
| 08_DEFECTOS_PRIORIZADOS.md | 6-7 | 🔴 | ⏳ PENDIENTE |
| 09_PLAN_CORRECCION.md | 7 | 🔴 | ⏳ PENDIENTE |
| 10_CRITERIOS_LANZAMIENTO.md | 7 | 🔴 | ⏳ PENDIENTE |
| 11_PREGUNTAS_PENDIENTES.md | 7 | 🟠 | ⏳ PENDIENTE |
| 00_RESUMEN_EJECUTIVO.md | 7 | 🔴 | ⏳ ÚLTIMO |

---

## HALLAZGOS PRELIMINARES

### Confirmado
- ✅ Estructura monorepo con 4 apps
- ✅ 111 migraciones (mucho más de MVP)
- ✅ 54 Edge Functions
- ✅ Está basado en Supabase (Auth, Storage, Functions)
- ✅ TypeScript en todo

### Sospecha P0 (Bloqueador)
- ❓ README dice Fase 0/1 pero BD sugiere Fase 3+
- ❓ Discrepancia entre documentación y código real
- ❓ Cantidad de migraciones sugiere historicidad (múltiples intentos/iteraciones)

### Preguntas Inmediatas
- ¿Cuál es la PRIMERA migración que debe ejecutarse?
- ¿Qué migraciones son independientes y cuáles tienen dependencias?
- ¿Hay datos hardcodeados o datos demo en Edge Functions?
- ¿Las migraciones son idempotentes o pueden causar errores en segunda ejecución?

---

## PRÓXIMOS PASOS

1. **Leer migración 20260606000001_init.sql** — Entender esquema base
2. **Mapear estructura de carpetas** — apps/web, apps/mobile
3. **Inventariar rutas principales** — pages en Next, screens en Expo
4. **Crear matriz borrador** — qué es visible vs. operativo
5. **Rastrear un flujo completo** — anticipo + comprobante + cierre

**Tiempo estimado:** 4-6 horas para Fase 1-2 completas.

---

## REGLAS DE TRABAJO (Reafirmadas)
- ❌ NO modificar código productivo
- ❌ NO ejecutar cambios destructivos
- ✅ SOLO crear documentación de auditoría
- ✅ CITAR archivos y líneas exactas
- ✅ DIFERENCIAR hechos de inferencias
- ✅ CLASIFICAR defectos por severidad (P0, P1, P2, P3)

