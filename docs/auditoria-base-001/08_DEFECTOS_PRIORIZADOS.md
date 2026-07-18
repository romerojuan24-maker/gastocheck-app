# AUDITORÍA BASE 001 — DEFECTOS PRIORIZADOS
**Listado ordenado por impacto y severidad**

---

## MATRIZ COMPLETA

| ID | Severidad | Producto | Módulo | Hallazgo | Archivo | Línea | Impacto | Corrección | Bloqueador |
|----|-----------|----------|--------|----------|---------|-------|---------|-----------|-----------|
| AUD-001 | P0 | GastoCheck | Advisor | Advisor IA TODO no implementado | supabase/functions/advisor-ask/index.ts | 45 | Usuario no puede usar Advisor | Implementar Anthropic/OpenAI API | ✅ SÍ |
| AUD-002 | P0 | GastoCheck | Demo | Página demo no guarda datos | apps/web/app/demo/page.tsx | 31 | Usuario engañado sobre persistencia | Ocultar o hacer operativa | ✅ SÍ |
| AUD-003 | P1 | GastoCheck | Rutas | Datos SEED de rutas falsas | supabase/migrations/20260618100000_seed_mock_routes.sql | 29-59 | Datos demo permanecen en producción | Mover seeds a archivo separado | ✅ SÍ |
| AUD-004 | P1 | BD | Schema | Rol 'admin' en policies pero no en enum | supabase/migrations/20260617600000_fix_rls_and_seed_categories.sql | 8,14 | Asignación de admin falla en BD | Agregar 'admin' a member_role enum | ✅ SÍ |
| AUD-005 | P1 | CobraCheck | Rutas | Daily_routes contiene datos de prueba CDMX | supabase/migrations/20260618100000_seed_mock_routes.sql | 35 | Usuarios ven rutas falsas | Limpiar datos después de init | ⚠️ PARCIAL |
| AUD-006 | P1 | BD | Migraciones | Migraciones duplicadas/conflictivas | supabase/migrations/ | Varias | Deploy puede fallar en rerun | Consolidar y limpiar | ✅ SÍ |
| AUD-007 | P2 | GastoCheck | Escaneo | OCR requiere GEMINI_API_KEY no documentado | supabase/functions/ocr-extract/index.ts | 9,75 | Sin API key devuelve error 500 | Documentar requisito | ❌ NO |
| AUD-008 | P2 | BancoCheck | Auto-match | Auto-match sin revisión visual | supabase/functions/bancocheck-auto-match/index.ts | 188-211 | Matching erróneo pasa silenciosamente | Agregar revisión manual antes de confirmar | ✅ PROBABLEMENTE |
| AUD-009 | P2 | FlujoCheck | Proyección | Proyección de cash flow sin validación | supabase/functions/proyectar-flujo-efectivo/index.ts | — | Decisiones basadas en datos incorrectos | Documentar supuestos y rango de confianza | ✅ PROBABLEMENTE |
| AUD-010 | P2 | Exportación | Excel | Export-excel no testeado end-to-end | supabase/functions/export-excel/index.ts | — | Formato incorrecto silencioso | Testing y documentación | ❌ NO |
| AUD-011 | P2 | Exportación | ZIP | Export-zip no testeado | supabase/functions/export-zip/index.ts | — | Archivos corruptos posibles | Testing | ❌ NO |
| AUD-012 | P3 | Documentación | README | README dice Fase 0/1 pero hay 111 migraciones | README.md | — | Documentación desactualizada | Actualizar README con estado real | ❌ NO |
| AUD-013 | P3 | Documentación | README | README dice Claude 3.5 Sonnet pero es Gemini 2.5 | README.md | 51 | Stack desactualizado | Actualizar stack en README | ❌ NO |
| AUD-014 | P3 | Inventory | Inventario | InventarioCheck implementado pero no testeado | apps/web/app/(dashboard)/inventariocheck/ | — | Funcionalidad incierta | Testing completo | ❌ NO |
| AUD-015 | P3 | Payments | Cuentas por pagar | Cuentas por pagar endpoint unclear | apps/web/app/api/ | — | Implementación incierta | Clarificar flujo y testing | ❌ NO |

---

## DEFECTOS P0 — BLOQUEADORES DE LANZAMIENTO

### 1. AUD-001: Advisor IA TODO no implementado

**Severidad:** P0  
**Estado:** BLOQUEADOR CRÍTICO  
**Alcance:** Todo usuario que intente usar /advisor

**Descripción:**
La función Edge `advisor-ask` contiene TODO pendiente en línea 45. La función no integra API de Anthropic o OpenAI. Si usuario consulta Advisor, recibe error o respuesta vacía.

**Archivos Afectados:**
- `supabase/functions/advisor-ask/index.ts:45`
- `apps/web/app/(dashboard)/advisor/page.tsx`

**Corrección:**
1. Implementar integración con Anthropic API (recomendado) o OpenAI
2. Pasar datos anonimizados
3. Testear flujo completo
4. **Esfuerzo:** 4-6 horas

**Prueba de Aceptación:**
```
- Abrir /advisor
- Hacer pregunta: "¿Cuál fue mi gasto promedio?"
- Debe retornar respuesta válida (no error, no vacío)
```

---

### 2. AUD-002: Página /demo engaña al usuario

**Severidad:** P0  
**Estado:** BLOQUEADOR CRÍTICO  
**Alcance:** Usuarios que naveguen a /demo

**Descripción:**
Página `/demo` importa catálogo contable pero no persiste en BD. Usuario puede pensar que guardó pero los datos desaparecen. Mensaje dice "(DEMO - no se guardan en BD)" pero el contexto puede confundir.

**Archivos Afectados:**
- `apps/web/app/demo/page.tsx:31`

**Opciones de Corrección:**
A. Ocultar `/demo` del menú (2 horas)
B. Hacer realmente operativa (4-6 horas)

**Recomendación:** Opción A (ocultar) para lanzamiento rápido.

**Prueba de Aceptación:**
- /demo no visible en menú
- URL directa redirige a /gastocheck o muestra 404

---

### 3. AUD-003: Datos SEED de rutas falsas en BD

**Severidad:** P0  
**Estado:** BLOQUEADOR CRÍTICO  
**Alcance:** Módulo CobraCheck, vistas de rutas

**Descripción:**
Migración `20260618100000_seed_mock_routes.sql` inserta rutas falsas (coordenadas hardcodeadas de CDMX) en `daily_routes` para los primeros 3 miembros activos. Aunque usa `ON CONFLICT DO NOTHING`, los datos permanecen en BD y son visibles para usuarios.

**Archivos Afectados:**
- `supabase/migrations/20260618100000_seed_mock_routes.sql:29-59`

**Corrección:**
1. Crear archivo separado `supabase/seeds/sample-routes.sql` (solo para desarrollo)
2. Eliminar INSERT de migración de producción
3. Documentar que seeds deben ejecutarse SOLO en dev
4. Agregar migration `20260719000000_clean_demo_routes.sql` para limpiar producción
5. **Esfuerzo:** 2-3 horas

**Prueba de Aceptación:**
```
- Sin ejecutar seed
- daily_routes debe estar vacía en producción
- Usuarios no ven rutas falsas
```

---

### 4. AUD-004: Rol 'admin' en policies pero no en enum

**Severidad:** P0  
**Estado:** BLOQUEADOR CRÍTICO  
**Alcance:** Asignación de permisos

**Descripción:**
Migración `20260617600000` agrega `'admin'` a RLS policies pero el enum `member_role` en `20260606000001_init.sql` NO incluye 'admin'. Si se intenta asignar rol 'admin' a un usuario, la BD rechazará el INSERT.

**Archivos Afectados:**
- `supabase/migrations/20260606000001_init.sql:9` (enum definition)
- `supabase/migrations/20260617600000_fix_rls_and_seed_categories.sql:8,14` (policy using 'admin')

**Corrección:**
1. Agregar 'admin' al enum en migración nueva
   ```sql
   ALTER TYPE member_role ADD VALUE 'admin' AFTER 'accountant';
   ```
2. **Esfuerzo:** 30 minutos

**Prueba de Aceptación:**
```sql
INSERT INTO company_members (company_id, user_id, role, status)
VALUES (uuid, uuid, 'admin', 'active');
-- Debe funcionar (no error)
```

---

## DEFECTOS P1 — CRÍTICOS

Consultar AUD-005 a AUD-006 en tabla anterior.

**Resumen:**
- AUD-005: Datos demo en rutas (fuga de información)
- AUD-006: Migraciones conflictivas (deploy fallará en rerun)

**Acción:** Corregir antes de lanzamiento.

---

## DEFECTOS P2 — IMPORTANTES

- AUD-007: OCR sin documentación de requisito
- AUD-008: BancoCheck sin revisión visual
- AUD-009: FlujoCheck sin validación
- AUD-010, AUD-011: Exportaciones no testeadas

**Acción:** Resolver en fase de testing, antes de lanzamiento.

---

## DEFECTOS P3 — MEJORAS

- AUD-012 a AUD-015: Documentación, testing, clarificación

**Acción:** Post-lanzamiento.

---

## RESUMEN DE ESFUERZOS

| Severidad | Cantidad | Esfuerzo Total | Ruta Crítica |
|-----------|----------|---|---|
| P0 | 4 | 7-11 horas | ✅ BLOQUEADOR |
| P1 | 2 | 3-4 horas | ✅ BLOQUEADOR |
| P2 | 7 | 4-6 horas | ⚠️ IMPORTANTE |
| P3 | 4 | 2-3 horas | ❌ POST-LAUNCH |

**Total para lanzamiento:** 14-19 horas de desarrollo + testing

