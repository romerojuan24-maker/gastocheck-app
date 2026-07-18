# Verificación del schema en Supabase

## Instrucciones generales

1. Acceder a [supabase.com](https://supabase.com) → Tu proyecto Supabase correcto
2. Click en "SQL Editor" (sidebar izquierdo)
3. Ejecutar el bloque de consultas completo abajo (puedes copiar todo junto)
4. Guardar resultados literales de CADA consulta
5. NO asumir columnas ni aplicar migraciones sin diagnosticar primero

---

## Bloque de consultas — Ejecutar todo junto

```sql
-- A. Valores reales del enum member_role
SELECT
  n.nspname AS enum_schema,
  t.typname AS enum_name,
  e.enumlabel AS enum_value,
  e.enumsortorder
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE t.typname = 'member_role'
ORDER BY e.enumsortorder;

-- B. Estructura real de tabla de migraciones (sin asumir columnas)
SELECT
  column_name,
  data_type,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'supabase_migrations'
  AND table_name = 'schema_migrations'
ORDER BY ordinal_position;

-- C. Registro de migración 20260609000001 (sin asumir columnas)
SELECT *
FROM supabase_migrations.schema_migrations
WHERE version = '20260609000001';

-- D. Tipo real de company_members.role
SELECT
  table_schema,
  table_name,
  column_name,
  data_type,
  udt_schema,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'company_members'
  AND column_name = 'role';

-- E. Políticas RLS sobre companies y company_members
SELECT
  schemaname,
  tablename,
  policyname,
  roles AS postgres_roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('companies', 'company_members')
ORDER BY tablename, policyname;

-- F. Confirmar que RLS está habilitado en tablas críticas
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('companies', 'company_members');
```

---

## Qué significa cada resultado

### Query A: Enum member_role
**Buscar:** ¿Aparece `'admin'` en la lista?
- **Sí:** Migración 20260609 se ejecutó ✅
- **No:** Migración está pendiente o falló ⚠️

### Query B: Estructura de schema_migrations
**Observar:** Columnas reales (probablemente solo `version`, `name`, `installed_on`, etc.)
- Usá esta información para Query C, no asumas columnas

### Query C: Migración 20260609000001
**Buscar:** ¿Existe una fila con `version = '20260609000001'`?
- **Sí:** Migración fue registrada (puede estar pendiente o completada)
- **No:** Migración no está en historial

**Nota:** La existencia de la fila indica registro. No confundas con "aplicada correctamente".

### Query D: Tipo de company_members.role
**Buscar:** `udt_name = 'member_role'` (enum type)
- **Correcto:** Columna es del tipo enum ✅
- **Otro:** Tipo diverge del esperado ⚠️

### Query E: Políticas RLS
**Nota importante:** `roles` contiene roles PostgreSQL (`authenticated`, `anon`, `public`), NO roles de negocio (`admin`, `owner`).

**Revisar:** 
- ¿Existen políticas FOR INSERT/UPDATE/SELECT/DELETE?
- Examinar `qual` y `with_check` para lógica que valida roles de aplicación
- Buscar funciones auxiliares invocadas (ej: `auth.uid()`, `current_user_company_id()`)
- Determinar si la lógica permite acceso a `admin`

**Incompleto si:**
- No hay políticas
- RLS deshabilitado
- `qual`/`with_check` evalúan solo `auth.uid()` sin validar role de aplicación

### Query F: Estado de RLS
**Buscar:** `rls_enabled = true` para companies y company_members
- **Ambas sí:** RLS está activo ✅
- **Alguna no:** RLS incompleto ⚠️

---

## Diagnóstico según resultados

### Escenario NORMAL ✅
Queries A-F muestran:
- A: `'admin'` presente en enum
- B: schema_migrations tabla tiene estructura estándar
- C: versión 20260609000001 existe
- D: company_members.role es enum type
- E: Existen políticas RLS que mencionan admin
- F: RLS está habilitado en ambas tablas

**Conclusión:**
- La migración posterior sí agrega `'admin'`
- El enum es compatible con `create-company`
- Las políticas reconocen `admin`
- **PERO:** Esto solo confirma compatibilidad estática
- Falta: prueba end-to-end, flujo atómico, atomicidad de inserciones

**ADM-001:** Permanece E2 (schema compatible, integración no verificada)
- Queries A-F confirman compatibilidad estática
- Falta: código frontend conectado, Edge Function invocada, persistencia real
- E3 requiere: inspección código-BD-persistencia
- E4 requiere: ejecución real exitosa
**Siguiente paso:** Ejecutar prueba end-to-end (si A-F es normal)

### Escenario: `admin` NO aparece en Query A ⚠️
- **Diagnóstico requerido:**
  1. ¿Query C muestra fila con versión 20260609000001?
     - Sí: Migración en historial pero no aplicada. Posibles causas: rollback manual, BD clonada sin migración, error en ejecución
     - No: Migración nunca fue ejecutada
  2. Comparar con historial de migraciones posteriores
     - ¿20260610+, 20260611+, etc. existen y se ejecutaron?
     - Si las posteriores se ejecutaron, ¿por qué 20260609 no?

**NO aplicar migración automáticamente.** Primera acción: diagnosticar divergencia.

**Posibles remedios (después de diagnóstico):**
- Si migración nunca ejecutó: aplicar manualmente desde Supabase Migration UI
- Si hay divergencia: contactar Supabase support o restaurar desde backup
- Si BD fue clonada: ejecutar migraciones pendientes en el clone

**ADM-001:** Permanece E2, Bloqueado por divergencia schema/historial

### Escenario: RLS deshabilitado o incompleto (Query E/F) ⚠️
- **Impacto:** create-company puede insertar empresa, pero RLS puede bloquear lectura posterior
- **Diagnóstico:** ¿Qué roles están en las políticas? ¿Incluyen 'admin'?
- **ADM-001:** E2, Riesgo de seguridad / permisos incorrectos

---

## Prueba end-to-end de `create-company` (Solo después de diagnóstico normal)

Si las queries confirman que `'admin'` existe y la migración se aplicó:

### Via curl (reemplazar valores):

```bash
# 1. Obtener access token del usuario autenticado
# (usar Supabase Auth UI o API)
TOKEN="eyJhbGc..."

# 2. Ejecutar create-company
curl -X POST \
  https://<PROJECT_ID>.supabase.co/functions/v1/create-company \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"company_name": "Test Company E2E"}'

# Esperado: { "ok": true, "company_id": "...", "trial_ends_at": "...", ... }
```

### Via Supabase UI:

1. Crear usuario de prueba en Authentication
2. Copiar token de sesión
3. Ir a SQL Editor → nueva query:

```sql
-- Verificar que user + empresa + membresía se crearon
SELECT
  c.id AS company_id,
  c.name,
  c.plan,
  c.trial_ends_at,
  cm.user_id,
  cm.role,
  cm.status
FROM companies c
JOIN company_members cm ON c.id = cm.company_id
WHERE c.created_by = 'TEST_USER_ID'
ORDER BY c.created_at DESC
LIMIT 1;
```

---

## Después de ejecutar las consultas

### Documentar resultados

Crear archivo: `docs/supabase-verification-results.md`

Con:
- Fecha, hora, proyecto Supabase, entorno
- Resultados literales de cada query (A-F)
- Diagnóstico: ¿escenario NORMAL, NO APARECE, o RLS INCOMPLETO?
- Clasificación final de ADM-001: E2 vs E3
- Próximos pasos confirmados

### ADM-001 — Clasificación final según diagnóstico

**E2 (Pendiente verificación)** si:
- Enum `admin` NO aparece
- Historial de migraciones tiene divergencia
- RLS está deshabilitado o incompleto

**E3 (Integración inspeccionada)** si:
- Enum tiene `admin`
- Migración 20260609 está registrada y aplicada
- RLS está habilitado y reconoce `admin`
- Tipos de columna son correctos

**E4+ (End-to-end probado)** si:
- E3 + prueba real de create-company exitosa
- Empresa y membresía creadas correctamente
- Trial_ends_at asignado correctamente
- Usuario puede ver empresa (RLS)
- Usuario NO puede ver otra empresa

### Lo que esta verificación NO confirma

Aunque E3 o E4 se alcancen, quedan pendientes:

- ¿Es `admin` el rol correcto para creador de empresa?
- ¿Están documentadas las diferencias entre `admin`, `owner`, `superadmin`?
- ¿El resto del sistema distingue estos roles correctamente?
- ¿Qué pasa si la inserción en company_members falla tras crear empresa? (inconsistencia)
- ¿Las políticas RLS permiten que `admin` ejecute todas las acciones esperadas?

Estas preguntas son **posteriores** a esta verificación.

