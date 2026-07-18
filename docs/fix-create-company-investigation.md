# Investigación: ADM-001 (Crear empresa) — Rol 'admin'

## Problema reportado en auditoría

**ADM-001** se clasificó como BLOQUEADO porque:
- `create-company/index.ts:84` intenta insertar `role: 'admin'`
- `supabase/migrations/20260606000001_init.sql:9` define enum con: `('owner','supervisor','spender','office','accountant')`
- 'admin' NO está en el enum inicial → Fallaría en BD

## Descubrimiento: Migración posterior agrega 'admin'

**Archivo:** `supabase/migrations/20260609000001_enum_roles.sql`

**Contenido:**
```sql
ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'admin'      AFTER 'office';
ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'superadmin' AFTER 'admin';
```

**Orden de ejecución:**
1. `20260606000001` — Enum inicial (sin 'admin')
2. `20260609000001` — AGREGA 'admin' ✅
3. `create-company` — Intenta usar 'admin' ← Debería funcionar

## Conclusión

La migración **SÍ agrega 'admin' antes** de que create-company intente usarlo.

**Por lo tanto:**
- Si BD está actualizada con todas las migraciones: ADM-001 debe funcionar
- Si BD está en estado antiguo: create-company falla

## Verificación requerida

1. ✅ Migración 20260609 agrega 'admin'
2. ⏳ Confirmar que `Supabase Live BD` ha ejecutado la migración
3. ⏳ Crear prueba de integración E2E para ADM-001
4. ⏳ Ejecutar prueba en dev/staging
5. ⏳ Elevar ADM-001 de BLOQUEADO a E4 si pasa

## Próximos pasos

- Crear test: `test/e2e/create-company.test.ts`
- Pasos:
  1. Autenticar usuario nuevo
  2. POST `/create-company` con nombre
  3. Verificar: company_id devuelto
  4. Verificar: row en companies table
  5. Verificar: row en company_members con role='admin'
  6. Verificar: trial_ends_at = hoje + 30 días
  7. Verificar: RLS permite que owner vea su propia empresa
  8. Verificar: RLS bloquea acceso a empresa ajena
  9. Verificar: rejeción de role inválido ('invalid_role')

## Resultado

**STATUS DEL HALLAZGO:** `RESOLVABLE` — No es un error en el código, es un problema de DB state o CI order.

**Acción:** Verificar BD actual + crear prueba E2E.

