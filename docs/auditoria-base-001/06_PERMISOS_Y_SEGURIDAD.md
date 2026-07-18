# AUDITORÍA BASE 001 — PERMISOS Y SEGURIDAD
**Análisis de RLS, autenticación y control de acceso**

---

## 1. ARQUITECTURA DE AUTENTICACIÓN

### 1.1 Modelo Actual

**Multi-tenant:** company_id como separador de datos
**Auth:** Supabase Auth (JWT)
**RLS:** Row Level Security en Postgres

**Flujo:**
1. Usuario inicia sesión con email/password (Supabase Auth)
2. Obtiene JWT token
3. Supabase agrega Authorization header a todas las requests
4. RLS policies validan acceso row-level

### 1.2 Estructura de Roles

**Roles en sistema:**
- `owner` — Propietario de empresa
- `supervisor` — Autoriza gastos
- `spender` — Crea gastos
- `office` — Gestiona gastos administrativos
- `accountant` — Valida datos contables
- `admin` (ADICIONAL) — Detectado en línea 8 de migration 20260617600000

**Función RLS clave:**
```sql
-- Ubicación: 20260606000001_init.sql:71-76
create or replace function auth_role(p_company uuid)
returns member_role language sql security definer stable as $$
  select role from company_members m
  where m.company_id = p_company and m.user_id = auth.uid() and m.status = 'active'
  limit 1;
$$;
```

**Evaluación:** ✅ Correcta. Security definer evita recursión RLS.

---

## 2. ROL DE SEGURIDAD DE COMPANY_MEMBERS

### 2.1 Política de Control

**Tabla:** company_members

**Policies encontradas:**

```sql
-- 20260606000001_init.sql:327-328
create policy "self bootstrap member" on company_members
  for insert with check (user_id = auth.uid());
```

**Problema detectado:** ✅ Correcta
- Usuario puede insertarse a sí mismo pero no a otros
- Owner debe asignarse en app después

```sql
-- 20260606000001_init.sql:323-325  
create policy "owner manage members" on company_members
  for all using (auth_role(company_id) = 'owner')
  with check (auth_role(company_id) = 'owner');
```

**Evaluación:** ✅ Correcta
- Solo owner puede gestionar miembros
- Escalamiento de privilegios prevenido

---

## 3. AISLAMIENTO MULTI-TENANT

### 3.1 Test de Aislamiento Empresarial

**Escenario:** Usuario A (empresa 1) intenta leer datos de empresa 2

**Mecanismo RLS:**
```sql
-- 20260606000001_init.sql:362-365
create policy "read expenses" on expenses for select
  using (auth_is_member(company_id) and (auth_can_view_all(company_id) or spender_id = auth.uid()));
```

**Verificación:**
1. ✅ `auth_is_member(company_id)` valida que user pertenece a company
2. ✅ Si no pertenece, falla la policy
3. ✅ BD rechaza SELECT

**Resultado:** ✅ SEGURO

**Nota:** Esto funciona porque:
- RLS está HABILITADO en tabla expenses (línea 301)
- Policy usa security definer function
- No hay bypass de RLS en Edge Functions

---

## 3.2 Vulnerabilidad Detectada: auth_role() ASUME ACTIVO

```sql
-- 20260606000001_init.sql:71-76
create or replace function auth_role(p_company uuid)
returns member_role language sql security definer stable as $$
  select role from company_members m
  where m.company_id = p_company and m.user_id = auth.uid() and m.status = 'active'
  limit 1;
$$;
```

**Problema:** Si user es disabled (status != 'active'), auth_role() retorna NULL
**Comportamiento:** Policies que usan `auth_role(...) = 'owner'` fallan correctamente
**Evaluación:** ✅ Seguro. Status 'disabled' previene acceso.

---

## 4. GESTIÓN DE USUARIOS DESACTIVADOS

### 4.1 Tabla company_members

**Status:**
- 'active' — Usuario activo
- 'invited' — Invitación pendiente  
- 'disabled' — Usuario desactivado

**Ubicación:** 20260606000001_init.sql:10
```sql
create type member_status as enum ('active','invited','disabled');
```

**Policy en company_members:**
```sql
-- 20260606000001_init.sql:321-322
create policy "members read members" on company_members
  for select using (auth_is_member(company_id));
```

**Evaluación:** ✅ Seguro
- auth_is_member() solo cuenta 'active'
- Usuarios 'disabled' no pueden actuar

---

## 5. PERMISOS POR TABLA

### 5.1 Tabla: expenses

**Leer (SELECT):**
```sql
create policy "read expenses" on expenses for select
  using (auth_is_member(company_id) and (auth_can_view_all(company_id) or spender_id = auth.uid()));
```
- ✅ Owner/supervisor/office/accountant → ven todos
- ✅ Spender → ve solo sus gastos
- ✅ Non-members → ven nada

**Crear (INSERT):**
```sql
create policy "spender insert own expense" on expenses for insert
  with check (auth_is_member(company_id) and spender_id = auth.uid());
create policy "office insert expense" on expenses for insert
  with check (auth_role(company_id) in ('owner','supervisor','office'));
```
- ✅ Spender puede crear gastos propios
- ✅ Office/owner puede crear para otros
- ✅ Accountant NO puede crear

**Actualizar (UPDATE):**
```sql
create policy "update own draft expense" on expenses for update
  using (spender_id = auth.uid() and status in ('captured','pending_auth','observed'))
  with check (spender_id = auth.uid());
create policy "authorizer update expense" on expenses for update
  using (auth_can_authorize(company_id))
  with check (auth_can_authorize(company_id));
```
- ✅ Spender solo puede editar no autorizados
- ✅ Owner/supervisor pueden autorizar
- ✅ Máquina de estados protegida

**Evaluación:** ✅ SÓLIDA

---

### 5.2 Tabla: company_members

**Vulnerabilidad:** Invitation token sin rate limiting

**Ubicación:** 20260606000001_init.sql:228-239
```sql
create table invitations (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(16),'hex'),
  accepted boolean not null default false,
  expires_at timestamptz not null default now() + interval '14 days'
);
```

**Problema:** ❌ Token de invitación tiene expiry pero no rate limiting
**Riesgo:** Ataque de fuerza bruta si token es débil
**Mitigación:** Usar UUIDs (128-bit) es suficiente, pero debería documentarse

**Evaluación:** ⚠️ ACEPTABLE

---

### 5.3 Tabla: cfdi_data

**Políticas:**
```sql
create policy "read cfdi" on cfdi_data for select
  using (exists (select 1 from expenses e where e.id = expense_id
                 and auth_is_member(e.company_id)
                 and (auth_can_view_all(e.company_id) or e.spender_id = auth.uid())));
```
- ✅ Heredan seguridad del gasto padre
- ✅ No permite acceso directo

**Evaluación:** ✅ SÓLIDA

---

## 6. VULNERABILIDADES CONOCIDAS ARREGLADAS

### 6.1 XXE Protection

**Ubicación:** `supabase/functions/xml-parse/index.ts:31-42`
```typescript
// 🔒 FIX BUG #3: XXE Protection — rechaza XML con entity declarations
if (
  xml.includes('<!ENTITY') ||
  xml.includes('SYSTEM') ||
  xml.includes('PUBLIC') ||
  xml.includes('<!DOCTYPE')
) {
  return Response.json(
    { error: 'XML malformado: declaraciones de entidad no permitidas' },
    { status: 422 },
  );
}
```

**Evaluación:** ✅ CORRECTO
- Evita XML External Entity (XXE) attacks
- Rechaza entity declarations

---

### 6.2 Type Safety en Edge Functions

**Ubicación:** `supabase/functions/authorize-expense/index.ts:7-10`
```typescript
// 🟠 FIX BUG #11: Type guard para validar action
function isValidAction(action: unknown): action is ExpenseAction {
  return typeof action === 'string' && ['authorize', 'reject', 'submit', 'cancel'].includes(action);
}
```

**Evaluación:** ✅ CORRECTO
- Valida tipos en runtime
- Previene injection de acciones inválidas

---

## 7. MATRIZ DE RIESGOS

| Aspecto | Riesgo | Severidad | Mitigación |
|---------|--------|-----------|------------|
| Multi-tenant isolation | Fuga entre empresas | Alto | ✅ RLS sólido |
| Disabled users | Acceso después de disable | Bajo | ✅ Status validado |
| XXE attacks | Inyección XML | Medio | ✅ Protegido |
| Type injection | Acciones inválidas | Bajo | ✅ Type guards |
| Invitations | Fuerza bruta de token | Bajo | ✅ UUIDs 128-bit |
| Advisor API | Exposición de datos | Alto | ❌ TODO no implementado |
| STRIPE_SECRET | Exposición de clave | Crítico | ⚠️ Debe estar en env |
| GEMINI_API_KEY | Exposición de clave | Crítico | ⚠️ Debe estar en env |

---

## 8. PRUEBAS DE SEGURIDAD RECOMENDADAS

### Test 1: Escalamiento de privilegios
```sql
-- Como spender, intentar:
-- 1. Autorizar gasto ajeno (debe fallar)
-- 2. Cambiar rol de otro usuario (debe fallar)
-- 3. Ver gastos de otra empresa (debe fallar)
```

### Test 2: Acceso después de desactivación
```
-- Desactivar usuario
-- Intentar hacer request con token anterior
-- Debe fallar (auth_role retorna NULL)
```

### Test 3: XXE attack
```xml
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<foo>&xxe;</foo>
```
**Resultado esperado:** Error 422, no error del servidor

### Test 4: Multi-tenant breach
```
-- Como user A (company 1), intentar:
-- SELECT * FROM expenses WHERE company_id = company_2_id
-- Debe retornar 0 rows (RLS bloquea)
```

---

## 9. RESUMEN EJECUTIVO

| Categoría | Calificación |
|-----------|-------------|
| Multi-tenant isolation | ✅ SÓLIDA |
| Authentication | ✅ CORRECTA (Supabase Auth) |
| Role-based access control | ✅ IMPLEMENTADA |
| RLS policies | ✅ EXHAUSTIVAS |
| Vulnerability fixes | ✅ PRESENTES (XXE, type safety) |
| API key management | ⚠️ REQUIRES ENV |
| Disabled user handling | ✅ CORRECTO |
| **Overall Security** | **✅ BUENA** |

**Caveat:** Seguridad en policies es correcta, pero falta testing real (penetration testing).

---

## 10. BLOQUEADORES ENCONTRADOS

**Ninguno** en la capa de seguridad de RLS.

**Advertencias:**
1. No hay evidencia de testing de seguridad
2. Edge Functions deben validar nuevamente (defensa en profundidad)
3. Advisor sin implementación permite consulta a datos aggregados (bajo riesgo pero debe documentarse)

