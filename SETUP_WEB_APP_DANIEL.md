# 💻 WEB APP — SETUP Y ENGINEERING PARA DANIEL
**Fecha:** 29 de Junio 2026  
**Responsable:** Daniel  
**Versión:** v0.1.72  
**Tiempo estimado:** 2-4 horas

---

## 📋 CHECKLIST: QUÉ FALTA EN LA WEB APP

### ✅ YA IMPLEMENTADO (Juan completó)
- [x] Contador General Panel (`apps/web/app/(dashboard)/gastocheck/contador-general/page.tsx`)
- [x] Admin Assignment Panel (`apps/web/app/(dashboard)/admin/contador-assignment/page.tsx`)
- [x] Viáticos View (tabla de reportes)
- [x] Componentes UI (Card, Tabs, Table)
- [x] Integración Supabase básica

### 🟡 PENDIENTE: SETUP & CONFIGURATION

#### 1. Environment Variables (CRÍTICO)
**Archivo:** `apps/web/.env.local`

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://omhycwfjxynkfwywzwvz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_sSlEbsfs4842PDD8H050uQ_dhLbljxA

# Stripe (Juan pasa los valores)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=[PEDIRLE A JUAN]
STRIPE_SECRET_KEY=[PEDIRLE A JUAN]

# Google (si integra Google Sheets/Drive)
GOOGLE_CLIENT_ID=[OPCIONAL]
GOOGLE_CLIENT_SECRET=[OPCIONAL]
```

**TODO:** 
- [ ] Crear `.env.local` en `apps/web/`
- [ ] Pedir STRIPE_SECRET_KEY a Juan
- [ ] Verificar que SUPABASE_URL está correcto

---

#### 2. Database Migration (CRÍTICO)
**ANTES de que la web app funcione, ejecutar en Supabase:**

```sql
-- Archivo: supabase/migrations/20260627_perfilamiento_gastocheck_v1.sql
-- Ubicación: https://app.supabase.com → gastocheck-app → SQL Editor

-- Incluye:
-- ✅ ALTER TABLE expenses ADD created_by, updated_by
-- ✅ CREATE TABLE viaticos (nueva)
-- ✅ CREATE TABLE contador_general_assignments (nueva)
-- ✅ CREATE VIEWS (expenses_by_buyer, viaticos_by_person, executive_summary_daily)
-- ✅ UPDATE RLS POLICIES
```

**TODO:**
- [ ] Copiar TODO el contenido del archivo SQL
- [ ] Pegar en Supabase Studio
- [ ] Ejecutar (▶️)
- [ ] Verificar que no hay errores
- [ ] Confirmar que las vistas existen

---

#### 3. Stripe Integration (IMPORTANTE)
**Estado:**
- ✅ Productos creados en Stripe
- ✅ Webhook secret en config
- ⚠️ STRIPE_SECRET_KEY NO ESTÁ en .env

**TODO:**
- [ ] Pedir STRIPE_SECRET_KEY a Juan
- [ ] Agregarlo a `apps/web/.env.local`
- [ ] Verificar webhook en Stripe dashboard
- [ ] Testear subscripción (si implementa checkout)

---

#### 4. Routing Completo (VERIFICAR)
**Rutas que DEBE TENER la web:**

```
/auth/login                          ✅ (ya existe)
/auth/register                       ✅ (ya existe)
/gastocheck/contador-general         ✅ (Juan hizo)
/gastocheck/contador-general/details [⚠️ OPCIONAL]
/admin/contador-assignment           ✅ (Juan hizo)
/admin/settings                      [⚠️ OPCIONAL]
/reportes                            [⚠️ OPCIONAL]
/perfil                              [⚠️ OPCIONAL]
/viaticos                            ✅ (ver tabla)
```

**TODO:**
- [ ] Verificar que las rutas creadas por Juan funcionan
- [ ] Testear navegación entre ellas
- [ ] Agregar links en navbar/sidebar

---

#### 5. Authentication (VERIFICAR)
**Status:**
- ✅ Supabase auth configurado
- ✅ JWT tokens en cookies
- ⚠️ Role-based redirects NO VERIFICADOS

**TODO:**
- [ ] Probar login como `contador_general`
- [ ] Verificar que ve Contador General Panel
- [ ] Probar login como `admin`
- [ ] Verificar que ve Admin Assignment Panel
- [ ] Probar logout y redirect a login

---

#### 6. Database Queries (TESTEAR)
**Queries que la web DEBE hacer:**

```typescript
// Contador General Panel
SELECT * FROM executive_summary_daily WHERE company_id = ?
SELECT * FROM expenses_by_buyer WHERE company_id = ?
SELECT * FROM viaticos_by_person WHERE company_id = ?

// Admin Assignment
SELECT * FROM contador_general_assignments WHERE company_id = ?
INSERT INTO contador_general_assignments (company_id, contador_id)
UPDATE contador_general_assignments SET contador_id = ? WHERE id = ?
DELETE FROM contador_general_assignments WHERE id = ?
```

**TODO:**
- [ ] Ejecutar queries en Supabase SQL editor (verificar sintaxis)
- [ ] Testear en la web app (abrir panel, ver datos)
- [ ] Si falta data: insertar data de prueba

---

#### 7. UI/UX Refinements (NICE TO HAVE)
**Elementos a mejorar (post-MVP):**

- [ ] Agregar loading states (mientras carga data)
- [ ] Agregar error states (si falla query)
- [ ] Agregar empty states (si no hay data)
- [ ] Mejorar responsive (mobile view)
- [ ] Agregar dark mode (si user lo pide)
- [ ] Agregar tooltips/help text
- [ ] Agregar confirmación antes de borrar

---

#### 8. Testing (RECOMENDADO)
**Tests que DEBE escribir:**

```typescript
// contador-general.tsx
- [ ] Verifica que carga data correctamente
- [ ] Verifica que muestra KPIs
- [ ] Verifica que muestra tablas
- [ ] Verifica que tabs funcionan

// contador-assignment.tsx
- [ ] Verifica que lista asignaciones
- [ ] Verifica que asigna nuevo contador
- [ ] Verifica que actualiza
- [ ] Verifica que elimina
```

**Framework:** Jest (ya instalado)

---

#### 9. Performance (OPCIONAL)
**Para optimizar después:**

- [ ] Agregar pagination a tablas (si data > 100 rows)
- [ ] Agregar caching de queries
- [ ] Lazy-load componentes pesados
- [ ] Optimizar imágenes
- [ ] Minify CSS/JS (Next.js lo hace auto)

---

## 🚀 SETUP PASO A PASO (AHORA)

### PASO 1: Verificar dependencias (5 min)
```bash
cd C:\Users\admin\Documents\gastocheck-app
npm install
npm run build --workspace apps/web
```

**Si hay errores:** 
- Elimina `node_modules` y `package-lock.json`
- `npm install` nuevamente

---

### PASO 2: Crear `.env.local` (2 min)
**Archivo:** `apps/web/.env.local`

```env
# Supabase (ya verif by Juan)
NEXT_PUBLIC_SUPABASE_URL=https://omhycwfjxynkfwywzwvz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_sSlEbsfs4842PDD8H050uQ_dhLbljxA

# Stripe (PEDIR A JUAN)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_XXXXXXXXX
STRIPE_SECRET_KEY=sk_live_XXXXXXXXX
```

---

### PASO 3: Ejecutar SQL Migration (5 min)
```bash
# En Supabase Studio:
# 1. https://app.supabase.com → gastocheck-app
# 2. SQL Editor → New query
# 3. Copiar: supabase/migrations/20260627_perfilamiento_gastocheck_v1.sql
# 4. Ejecutar (▶️)
# 5. Verificar: ✅ Success
```

---

### PASO 4: Iniciar servidor (3 min)
```bash
cd C:\Users\admin\Documents\gastocheck-app
npm run dev --workspace apps/web
# Espera: ✓ ready - started server on 0.0.0.0:3000
```

**Abre:** http://localhost:3000/gastocheck/contador-general

---

### PASO 5: Testear (10 min)
**En navegador:**
- [ ] Login como contador_general
- [ ] Ve Contador General Panel
- [ ] Ve datos (KPIs, tablas)
- [ ] Tabs funcionan
- [ ] Logout funciona

---

### PASO 6: Testear Admin Panel (5 min)
**http://localhost:3000/admin/contador-assignment**
- [ ] Login como admin
- [ ] Ve lista de asignaciones
- [ ] Puede crear nueva asignación
- [ ] Puede actualizar
- [ ] Puede eliminar

---

## 🔴 BLOCKERS SI APARECEN

### Error: "Table 'contador_general_assignments' does not exist"
**Causa:** SQL migration no ejecutada
**Solución:** Ejecutar migration en Supabase (PASO 3)

### Error: "Cannot find module @/lib/supabase"
**Causa:** Ruta de import incorrecta
**Solución:** Verificar `tsconfig.json` paths:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### Error: "NEXT_PUBLIC_SUPABASE_URL is not defined"
**Causa:** .env.local no está configurado
**Solución:** Crear archivo `.env.local` en `apps/web/`

### Error: "401 Unauthorized" en queries
**Causa:** Token expirado o RLS policy rechaza
**Solución:** 
- Logout y login nuevamente
- Verificar que el usuario tiene role correcto en DB

---

## 📱 COMPARACIÓN: Mobile vs Web

| Aspecto | Mobile | Web |
|---------|--------|-----|
| Framework | React Native (Expo) | Next.js |
| Funcionalidad | Captura (OCR) + Consulta | Backoffice + Reportes |
| Users | Compradores + Viaticos | Contadores + Admin |
| Deploy | Google Play | ¿Vercel? ¿AWS? |
| Auth | Supabase | Supabase |
| Database | Supabase (mismo) | Supabase (mismo) |

---

## 🎯 DEFINIR ANTES DE DEPLOY

**Daniel debe decidir con Juan:**

1. **Dónde deployar la web?**
   - Vercel (recomendado para Next.js)
   - AWS (más control)
   - Azure
   - Railway

2. **Dominio:**
   - app.gastocheck.mx?
   - admin.gastocheck.mx?
   - gastocheck.app?

3. **SSL/HTTPS:**
   - Auto-renovado por Vercel/AWS
   - Manual (si AWS)

4. **CDN:**
   - Vercel Edge Network (auto)
   - Cloudflare (opcional)

5. **Database backup:**
   - Supabase lo hace (auto)
   - Configurar alertas

---

## ✅ CHECKLIST FINAL

- [ ] Dependencias instaladas
- [ ] .env.local configurado
- [ ] SQL migration ejecutada
- [ ] Servidor local funcionando
- [ ] Contador General Panel carga data
- [ ] Admin Panel funciona
- [ ] Login/logout funciona
- [ ] Tests pasan
- [ ] Deploy target definido
- [ ] Dominio decidido

---

## 📞 SI ALGO FALLA

**Contactar a Juan:**
- Error de Supabase
- Stripe keys
- Arquitectura decision
- Deploy questions

**Daniel resuelve:**
- UI bugs
- Performance
- Testing
- Routing

---

## ⏱️ TIMELINE

```
HOY (28 Jun):       ✅ Código completo
MAÑANA (29 Jun):    🟡 Daniel setup web + mobile publish
LUNES (1 Jul):      ✅ Web funcionando + esperando Google
MARTES (2 Jul):     ✅ Deploy web a staging
MIÉRCOLES (3 Jul):  ✅ Testing + bugfixes
NEXT WEEK:          🚀 Deploy production
```

---

**DOCUMENTO PARA DANIEL:** Seguir paso a paso, sin improvizar. Preguntar si algo no está claro.

