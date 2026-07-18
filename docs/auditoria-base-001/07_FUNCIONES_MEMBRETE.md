# AUDITORÍA BASE 001 — FUNCIONES DE MEMBRETE
**Funciones visibles que NO operan completamente**

---

## LISTADO POR SEVERIDAD

### 🔴 P0 — BLOQUEADOR

#### AUD-MB-001: Advisor (IA) — TODO no implementado

**Ubicación:**
- Componente: `apps/web/app/(dashboard)/advisor/page.tsx`
- Edge Function: `supabase/functions/advisor-ask/index.ts:45`

**Promesa:**
"Asistente IA que responde preguntas sobre gastos, tendencias, anomalías"

**Falla:**
```typescript
// TODO: Integrar Anthropic/OpenAI aquí usando solo agregados anonimizados
```

**Comportamiento:**
- Usuario abre `/advisor`
- Escribe pregunta
- Llama `advisor-ask` Edge Function
- Función no tiene lógica, devuelve error o respuesta vacía

**Evidencia:**
Línea 45 de `supabase/functions/advisor-ask/index.ts` contiene TODO pendiente.
El resto de la función existe pero falta la integración con API.

**Corrección:**
1. Implementar llamada a Anthropic API o OpenAI
2. Pasar datos anonimizados
3. Retornar respuesta estructurada

**Bloqueador:** Sí. Usuario no puede usar Advisor.

---

#### AUD-MB-002: Página /demo — No persiste datos

**Ubicación:**
- `apps/web/app/demo/page.tsx:31`
- `apps/web/app/(dashboard)/gastocheck/nuevo-comprobante/page.tsx`

**Promesa:**
"Importar catálogo de cuentas y clasificar gastos"

**Falla:**
```typescript
setMessage(`✅ ${accounts.length} cuentas cargadas (DEMO - no se guardan en BD)`)
```

**Comportamiento:**
- Usuario sube archivo CSV/Excel
- Sistema muestra "✅ X cuentas cargadas"
- Datos NO se guardan en BD
- Usuario piensa que funcionó pero no hay persistencia

**Evidencia:**
Línea 31 de `apps/web/app/demo/page.tsx` dice explícitamente "(DEMO - no se guardan en BD)"

**Corrección:**
Opción A: Ocultar página /demo del menú
Opción B: Hacer realmente operativa

**Bloqueador:** Parcial. Usuario puede ser engañado pero se le advierte.

---

### 🟠 P1 — CRÍTICO

#### AUD-MB-003: Datos SEED de prueba en BD

**Ubicación:**
- `supabase/migrations/20260618100000_seed_mock_routes.sql`
- `supabase/migrations/20260618400000_seed_team_members.sql`
- `supabase/migrations/20260617600000_fix_rls_and_seed_categories.sql`

**Promesa:**
"Rutas reales del equipo con GPS y horarios"

**Falla:**
```sql
INSERT INTO daily_routes (...) VALUES (
  v_user_id, v_company_id,
  jsonb_build_array(
    jsonb_build_object('lat', 19.4326, 'lng', -99.1332, 'ts', v_today || 'T08:00:00Z', 'note', 'Inicio jornada'),
    ...
  ),
  12.4  -- km hardcodeados
)
ON CONFLICT (user_id, route_date) DO NOTHING;
```

**Comportamiento:**
- Se ejecutan migraciones
- Se insertan rutas falsas de CDMX (coordinates hardcodeadas)
- Usuario ve rutas que no existen
- `ON CONFLICT DO NOTHING` significa que rutas reales NO se sobrescriben

**Evidencia:**
- Líneas 29-59 de `20260618100000_seed_mock_routes.sql`
- Coordenadas: 19.4326, -99.1332 (Reforma, CDMX)

**Impacto:**
- Datos demo contamina BD de producción
- Es visible para todos los usuarios de la empresa
- No hay manera de eliminarlos programáticamente

**Corrección:**
1. Mover seeds a archivo separado (`seeds/sample-routes.sql`)
2. Documentar que deben ejecutarse SOLO en desarrollo
3. Agregar migration para limpiar datos si existen en producción

**Bloqueador:** Sí. Datos falsos en producción son inaceptables.

---

#### AUD-MB-004: Datos categorizados sin funcionalidad

**Ubicación:**
- `supabase/migrations/20260608000004_category_templates.sql`
- `supabase/migrations/20260617600000_fix_rls_and_seed_categories.sql:18-39`

**Promesa:**
"Categorías de gastos precargadas y automáticamente asignadas"

**Falla:**
Las categorías se siembran pero:
1. Usuario no puede verlas en UI (no verificado)
2. Se asignan automáticamente pero sin confirmación
3. No hay edit/override en pantalla

**Corrección:**
Verificar si se muestran en UI y permiten override.

**Bloqueador:** Probablemente no.

---

### 🟡 P2 — IMPORTANTE

#### AUD-MB-005: Exportación Excel sin validación

**Ubicación:**
- `supabase/functions/export-excel/index.ts`
- `apps/web/app/api/*/route.ts` (varias)

**Promesa:**
"Exportar datos a Excel con formato contable"

**Estado:**
Función Edge existe pero:
1. No está verificado que genere Excel válido
2. No hay error handling para archivos grandes
3. Formato no está documentado

**Bloqueador:** No (pero riesgo de error en producción).

---

#### AUD-MB-006: BancoCheck auto-match sin validación visual

**Ubicación:**
- `supabase/functions/bancocheck-auto-match/index.ts:188-211`

**Promesa:**
"Matching automático de transacciones bancarias a gastos"

**Falla:**
La función existe pero:
1. No hay revisión visual del matching
2. Usuarios pueden no notificar errores
3. Matching incorrecto causa desconciertos contables

**Corrección:**
Agregar revisión visual y aprobación manual antes de confirmar.

**Bloqueador:** Probablemente (matching erróneo = datos corruptos).

---

#### AUD-MB-007: Flujo de cash flow sin validación de precisión

**Ubicación:**
- `supabase/functions/proyectar-flujo-efectivo/index.ts`
- `/api/flujocheck/proyeccion`

**Promesa:**
"Proyección de flujo de caja a 90 días"

**Estado:**
Edge Function existe pero:
1. Método de cálculo no verificado
2. Supuestos no documentados
3. No hay rango de confianza

**Bloqueador:** Probablemente (decisiones basadas en datos incorrectos).

---

## RESUMEN TABULAR

| ID | Función | Severidad | Tipo | Bloqueador |
|----|---------| ----------| -----| -----------|
| AUD-MB-001 | Advisor (IA) | P0 | TODO | ✅ SÍ |
| AUD-MB-002 | Página /demo | P0 | Simulada | ⚠️ PARCIAL |
| AUD-MB-003 | Datos SEED routes | P1 | Contaminación | ✅ SÍ |
| AUD-MB-004 | Categorías seed | P1 | Contaminación | ⚠️ PROBABLEMENTE |
| AUD-MB-005 | Exportación Excel | P2 | No testeado | ❌ NO |
| AUD-MB-006 | BancoCheck auto-match | P2 | No verificado | ✅ PROBABLEMENTE |
| AUD-MB-007 | Flujo cash flow | P2 | No validado | ✅ PROBABLEMENTE |

---

## IMPACTO AGREGADO

**Funciones completamente NO operativas:** 1 (Advisor)
**Funciones parcialmente NO operativas:** 3 (Demo, BancoCheck, Flujo)
**Contaminación de datos:** 2 (Seeds de rutas y categorías)
**Falta documentación/validación:** 3

**Riesgo Global:** ALTO
**Recomendación:** NO lanzar a producción sin resolver P0 y P1.

