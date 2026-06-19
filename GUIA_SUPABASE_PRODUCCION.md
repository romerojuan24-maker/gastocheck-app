# GUÍA: SETUP SUPABASE PRODUCCIÓN

**Fecha:** 2026-06-19  
**Objetivo:** Crear base de datos producción con migraciones + test data  
**Tiempo estimado:** 1 hora  

---

## FASE 1: CREAR SUPABASE PRODUCCIÓN (10 min)

### Pasos:

1. **Ir a Supabase Dashboard:**
   ```
   https://app.supabase.com/
   ```

2. **Login:**
   - Usa tu cuenta Google (romero.juan24@gmail.com)

3. **Crear nuevo proyecto:**
   - Click "+ New Project"
   - Organization: (seleccionar la existente)
   - Name: `gastocheck-production`
   - Database Password: (generar contraseña fuerte)
   - Region: `us-east-1` (o la más cercana a tus usuarios)
   - Click "Create new project"

4. **Esperar a que se cree (2-3 minutos)**
   - Verás "Setting up your database..."
   - Cuando termine, irá a Settings

5. **Copiar credenciales de producción:**
   - Ir a Settings → API
   - Copiar:
     ```
     Project URL: https://[prod-project-id].supabase.co
     Anon Key: eyJhbGci...
     Service Role Key: eyJhbGci... (usar solo en backend)
     ```
   - Guardar en un archivo seguro (los usarás después)

✅ **VERIFICAR:** Proyecto producción creado en Supabase

---

## FASE 2: EJECUTAR MIGRACIONES (10 min)

### Opción A: Via Supabase CLI (Recomendado)

1. **Instalar Supabase CLI:**
   ```bash
   npm install -g supabase
   ```

2. **Login en Supabase:**
   ```bash
   supabase login
   # Se abrirá navegador
   # Login con Google (romero.juan24@gmail.com)
   # Copiar token que aparezca
   # Pegar en terminal
   ```

3. **Ejecutar migraciones:**
   ```bash
   cd C:\Users\admin\Documents\gastocheck-app
   supabase db push --project-ref [prod-project-id]
   # Reemplaza [prod-project-id] con el ID de tu proyecto producción
   # Ejemplo: supabase db push --project-ref xyzabc123
   ```

4. **Verificar:**
   - Debería mostrar: "Pushing migrations..." → "✓ Done"
   - Todas las 54 migraciones se ejecutarán

### Opción B: Via Supabase Dashboard (Manual)

1. **Ir a SQL Editor:**
   - Tu proyecto producción → SQL Editor

2. **Copiar las migraciones:**
   - Ir a `supabase/migrations/` en tu proyecto local
   - Hay 54 archivos `.sql`
   - Copiar cada uno y ejecutar en Supabase SQL Editor

⚠️ **NOTA:** Opción A (CLI) es mucho más rápida

✅ **VERIFICAR:** En Supabase Dashboard, ir a Database → Tables
- Debería haber ~40 tables: users, companies, cobra_clients, cobra_invoices, bank_transactions, etc.

---

## FASE 3: CREAR USUARIOS EN AUTH (10 min)

### Pasos:

1. **Ir a Authentication → Users:**
   - Tu proyecto producción → Authentication → Users
   - Click "+ Add user"

2. **Crear usuario test:**
   - Email: `testadmin@gastocheck.com`
   - Password: `TestPass123!`
   - Auto generate password: NO (marcar si quieres que sea automática)
   - Click "Create user"

3. **Copiar User ID:**
   - Verás la fila del usuario creado
   - Copiar el `User ID` (UUID largo)
   - Guardar para el próximo paso

✅ **VERIFICAR:** Usuario aparece en lista de Authentication → Users

---

## FASE 4: SEED DATA (15 min)

### Pasos:

1. **Ir a SQL Editor:**
   - Tu proyecto producción → SQL Editor
   - Click "+ New Query"

2. **Copiar el SQL seed script:**
   - Ver archivo: `SUPABASE_SEED_DATA.sql` (está en el repo)
   - Copiar TODO el contenido

3. **Pegar en SQL Editor:**
   - Pegar en la ventana de SQL
   - **IMPORTANTE:** Reemplaza placeholders:
     - Donde dice `[COMPANY_ID]`: reemplaza con el ID que aparezca en primer INSERT
     - Donde dice `[USER_ID]`: reemplaza con el User ID del paso anterior
     - Donde dice `[ACCOUNT_ID]`: reemplaza con el ID que aparezca en INSERT de bank_accounts

4. **Ejecutar query:**
   - Click "Run" o Ctrl+Enter
   - Debería mostrar: "Query executed successfully"

5. **Verificar datos creados:**
   - Ir a Database → Tables
   - Click en `cobra_clients`
   - Debería haber 5 clientes de test
   - Click en `cobra_invoices`
   - Debería haber 6 facturas

✅ **VERIFICAR:** Ver datos en Database → Tables

---

## FASE 5: VALIDAR RLS (Row Level Security) (10 min)

### Pasos:

1. **Verificar RLS está habilitado:**
   - Ir a Database → Authentication → Policies
   - Debería haber policies para cada tabla

2. **Test: Usuario A no puede ver datos de Usuario B**
   - Este es un test conceptual (requiere 2 usuarios diferentes)
   - Por ahora, solo verificar que policies existen

3. **Verificar en SQL:**
   ```sql
   -- En SQL Editor de tu proyecto producción:
   SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;
   -- Debería mostrar un montón de tablas con RLS habilitado
   ```

✅ **VERIFICAR:** RLS policies existen en todas las tablas críticas

---

## FASE 6: CONFIGURAR BACKUPS (5 min)

### Pasos:

1. **Ir a Settings → Backups:**
   - Tu proyecto producción → Settings → Backups

2. **Habilitar automated backups:**
   - Toggle "Enable automated backups"
   - Frequency: "Daily" (o según necesites)
   - Retention: "7 days" (o más)

3. **Crear primer backup manual:**
   - Click "Create backup"
   - Nombre: `initial-prod-backup`

✅ **VERIFICAR:** Backup aparece en lista

---

## FASE 7: CONFIGURAR VARIABLES DE ENTORNO PARA PRODUCCIÓN

Una vez todo esté listo en Supabase, vas a usar estas credenciales:

### Para `.env.production` (web):
```bash
# Supabase Producción
NEXT_PUBLIC_SUPABASE_URL=https://[prod-project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key-copiado-arriba]

# Otros (mantenidos de desarrollo)
NEXT_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_live_...
NODE_ENV=production
```

### Para `EXPO_PUBLIC_SUPABASE_URL` (mobile):
```bash
# Mobile usa las MISMAS credenciales Supabase que web
EXPO_PUBLIC_SUPABASE_URL=https://[prod-project-id].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
```

---

## ✅ CHECKLIST FINAL

- [ ] Proyecto producción creado en Supabase
- [ ] Project URL copiado (https://[prod-project-id].supabase.co)
- [ ] Anon Key copiado
- [ ] Migraciones ejecutadas (54 tables creadas)
- [ ] Usuario test creado en Auth (testadmin@gastocheck.com)
- [ ] Seed data insertado (5 clientes, 6 facturas, 5 transacciones)
- [ ] RLS policies verificadas
- [ ] Automated backups habilitados
- [ ] Variables de entorno actualizadas en `.env.production`

---

## 🚨 PROBLEMAS COMUNES

**P: "Permission denied" al ejecutar migraciones**
- ✅ Verificar que usaste `supabase login` primero
- ✅ Verificar [prod-project-id] es correcto
- ✅ Verificar usuario tiene permisos en Supabase

**P: "Table already exists"**
- ✅ Las migraciones ya se ejecutaron (idempotentes)
- ✅ Safe to retry

**P: "RLS policy blocking select"**
- ✅ Esto es NORMAL si estás viendo datos de otra empresa
- ✅ Confirm que solo tu usuario ve sus datos

---

## 📋 PRÓXIMO PASO

Una vez hayas completado FASE 1-7:
1. ✅ Supabase producción creada
2. ✅ Migraciones ejecutadas
3. ✅ Test data insertado
4. ✅ RLS validado

**ENTONCES:** Pasar a **TESTING EN PC** (FASE 3)

Ver: `CHECKLIST_EXECUTION_2026_06_19.md` → FASE 3
