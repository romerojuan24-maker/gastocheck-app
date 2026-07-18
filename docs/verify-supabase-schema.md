# Verificación del schema en Supabase

## Ejecutar estas 3 consultas SQL en Supabase SQL Editor

**Instrucciones:**
1. Acceder a [supabase.com](https://supabase.com) → Tu proyecto
2. Click en "SQL Editor" (sidebar izquierdo)
3. Crear query nueva
4. Copiar CADA consulta abajo y ejecutar individualmente
5. Guardar resultados literales

---

## Query 1: Verificar estado del enum `member_role`

```sql
SELECT
  t.typname AS enum_name,
  e.enumlabel AS enum_value,
  e.enumsortorder AS sort_order
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'member_role'
ORDER BY e.enumsortorder;
```

**Esperado:** Debe incluir `'admin'` en la lista de valores.

**Resultado actual:** [EJECUTAR Y PEGAR AQUÍ]

---

## Query 2: Verificar historial de migraciones

```sql
SELECT
  version,
  description,
  installed_on,
  success
FROM supabase_migrations.schema_migrations
WHERE version = '20260609000001'
ORDER BY version DESC;
```

**Esperado:** Debe mostrar que la migración fue instalada exitosamente.

**Resultado actual:** [EJECUTAR Y PEGAR AQUÍ]

---

## Query 3: Verificar tipo de columna `company_members.role`

```sql
SELECT
  table_schema,
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'company_members'
  AND column_name = 'role';
```

**Esperado:** `udt_name` debe ser `'member_role'` (enum type).

**Resultado actual:** [EJECUTAR Y PEGAR AQUÍ]

---

## Clasificación según resultados

### Caso A: Queries 1-3 muestran `'admin'` + migración aplicada ✅
- **Conclusión:** Schema está correcto. `create-company` debería funcionar.
- **ADM-001:** Reclasificar a E3 o E4 según prueba end-to-end.
- **Acción:** Ejecutar prueba real de create-company.

### Caso B: Query 1 NO muestra `'admin'` ❌
- **Conclusión:** Migración no fue aplicada o falló.
- **ADM-001:** Permanece E2, Pendiente Verificación.
- **Acción:** Aplicar migración `20260609000001_enum_roles.sql` manualmente en Supabase.

### Caso C: Query 2 falla o muestra fila incompleta ⚠️
- **Conclusión:** Histórico de migraciones corrupto o inconsistente.
- **ADM-001:** E2, Bloqueado por divergencia BD/historial.
- **Acción:** Investigar estado de Supabase y backups.

---

## Prueba end-to-end de `create-company` (Caso A)

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

## Documentar hallazgos

Una vez ejecutadas las 3 consultas, crear documento:
`docs/supabase-verification-results.md`

Con:
- Fecha y hora de verificación
- Resultados literales de cada query
- Caso (A/B/C)
- Conclusión sobre ADM-001
- Próximos pasos

