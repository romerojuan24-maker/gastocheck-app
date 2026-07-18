# AUDITORÍA BASE 002 — PERMISOS OPERATIVOS
**Análisis de permisos por rol: insuficientes, excesivos o incorrectos**

---

## PERMISOS POR ROL (Según apps/web/app/(dashboard)/configuracion/page.tsx:17-80)

### OWNER
- ✅ Crear empresa
- ✅ Invitar usuarios
- ✅ Ver todas las políticas
- ✅ Autorizar gastos
- ✅ Ver reportes
- ✅ Cambiar planes

**Verificación:** CORRECTO — Owner tiene acceso total

---

### ADMIN
- ✅ Crear usuarios
- ✅ Autorizar gastos
- ✅ Ver reportes
- ⚠️ ¿Cambiar roles de otros admins?
- ⚠️ ¿Acceso a billing?

**Verificación:** PARCIAL — Roles desconocidos

---

### ACCOUNTANT (Contador)
- ✅ Ver gastos
- ✅ Validar CFDI
- ✅ Ver reportes
- ⚠️ ¿Puede clasificar gastos?
- ⚠️ ¿Puede rechazar gastos?
- ✅ ¿Ver CxP/CxC?

**Verificación:** PARCIAL — Algunos permisos no verificados

---

### SUPERVISOR (Administrador subordinado)
- ⚠️ Funcionalidad no clara
- ⚠️ ¿Autoriza gastos?
- ⚠️ ¿Ve reportes?

**Verificación:** NO VERIFICABLE — Rol poco definido

---

### BUYER (Comprador)
- ✅ Crear gasto
- ✅ Subir recibos
- ⚠️ ¿Puede corregir datos después?
- ❌ NO PUEDE autorizar (correcto)

**Verificación:** CORRECTO — Permisos son restrictivos correctamente

---

### COLLECTOR (Cobranza)
- ⚠️ Funcionalidad no clara
- ⚠️ ¿Registrar pagos?
- ⚠️ ¿Registrar promesas?
- ⚠️ ¿Ver cartera completa?

**Verificación:** NO VERIFICABLE — Rol poco definido

---

## PROBLEMAS DE PERMISOS

| ID | Problema | Impacto | Severidad |
|----|----------|---------|-----------|
| PERM-001 | Rol SUPERVISOR poco definido | Confusión en estructura | 🟡 Media |
| PERM-002 | Rol COLLECTOR poco definido | Cobranza confundida | 🟡 Media |
| PERM-003 | Buyer puede editar datos? | Datos mutable sin auditoría clara | ⚠️ Posible |
| PERM-004 | ¿Quién rechaza gastos? | No está claro si es Admin o Accountant | 🟡 Media |
| PERM-005 | RLS policies vs enum | Enum falta 'admin' en migration | 🔴 CRÍTICA |

---

## VERIFICACIÓN RLS

**Archivo:** `supabase/migrations/20260617600000_fix_rls_and_seed_categories.sql:8,14`

```sql
-- Usa 'admin' en RLS policies pero:
WHERE role = 'admin'  -- Error: 'admin' no en enum member_role
```

**Estado:** CRÍTICA — Enum falta 'admin' en `20260606000001_init.sql:9`

