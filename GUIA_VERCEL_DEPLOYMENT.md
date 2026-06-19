# GUÍA: DEPLOYMENT A VERCEL

**Fecha:** 2026-06-19  
**Objetivo:** Deploy web a Vercel en 15 minutos  
**Tiempo estimado:** 15 minutos  

---

## FASE 1: CREAR CUENTA VERCEL (5 min)

### Pasos:

1. **Ir a Vercel:**
   ```
   https://vercel.com/
   ```

2. **Sign up:**
   - Click "Sign Up"
   - Opción recomendada: "Continue with GitHub"
   - Usa tu GitHub (si no tienes, crear primero)

3. **Autorizar Vercel:**
   - GitHub pedirá permiso
   - Click "Authorize Vercel"

4. **Completar signup:**
   - Nombre: Tu nombre
   - Email: romero.juan24@gmail.com
   - Click "Continue"

✅ **VERIFICAR:** Vercel dashboard abierto (https://vercel.com/dashboard)

---

## FASE 2: CONECTAR REPOSITORIO GITHUB (5 min)

### Pasos:

1. **En Vercel Dashboard:**
   - Click "+ New Project"

2. **Seleccionar repositorio:**
   - Buscar: "gastocheck-app" (o el nombre de tu repo)
   - Click en el repo

3. **Configurar proyecto:**
   - Framework Preset: "Next.js"
   - Root Directory: `apps/web` (IMPORTANTE)
   - Build Command: `npm run build`
   - Output Directory: `.next`

4. **Configurar variables de entorno:**
   - Scroll down → "Environment Variables"
   - Agregar TODAS las variables de `.env.production`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://[prod-project-id].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
   NEXT_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... (o pk_test_ para MVP)
   STRIPE_SECRET_KEY=sk_live_... (o sk_test_ para MVP)
   ```

5. **Deploying:**
   - Click "Deploy"
   - Vercel iniciará build (3-5 min)
   - Verás progreso en tiempo real

✅ **VERIFICAR:** Build completa sin errores

---

## FASE 3: VERIFICAR DEPLOYMENT (5 min)

### Pasos:

1. **Una vez completado:**
   - Vercel mostrará URL: `https://[tu-proyecto].vercel.app`
   - Click en ella para abrir

2. **Testear en navegador:**
   - [ ] Página carga en < 2 segundos
   - [ ] Logo/UI visible
   - [ ] No hay errores en consola (F12 → Console)

3. **Testear login:**
   - [ ] Ir a `/login`
   - [ ] Ingresar: testadmin@gastocheck.com / TestPass123!
   - [ ] ✅ Redirige a `/hoy` (dashboard)

4. **Testear Advisor IA:**
   - [ ] Ir a `/advisor`
   - [ ] Hacer pregunta: "¿Me alcanza dinero?"
   - [ ] ✅ Responde en 2-3 segundos (si ANTHROPIC_API_KEY está configurada)

✅ **VERIFICAR:** Deploy funciona correctamente

---

## FASE 4: CONFIGURAR CI/CD (Automático)

Vercel automáticamente configura CI/CD cuando conectas GitHub:

- ✅ Cada push a `main` → auto deploy
- ✅ Cada PR → preview deployment
- ✅ Rollback automático si hay error

**No necesitas hacer nada más.** Es automático.

---

## 🔧 CONFIGURAR DOMINIO PERSONALIZADO (Opcional, futuro)

Si quieres usar tu propio dominio (ej: gastocheck.com):

1. **En Vercel Dashboard:**
   - Tu proyecto → Settings → Domains
   - Click "+ Add Domain"
   - Ingresar dominio: `gastocheck.com`
   - Vercel te dará instrucciones DNS

2. **En registrador de dominio:**
   - Donde compraste el dominio
   - Actualizar registros DNS según instrucciones Vercel
   - Esperar 24-48h para que se propague

---

## ✅ CHECKLIST FINAL

- [ ] Cuenta Vercel creada
- [ ] Repo GitHub conectado
- [ ] Root directory es `apps/web`
- [ ] Variables de entorno configuradas
- [ ] Build exitoso
- [ ] URL: https://[tu-proyecto].vercel.app funciona
- [ ] Login funciona
- [ ] Advisor responde (si API key está)

---

## 🚨 PROBLEMAS COMUNES

**P: Build failed "Module not found"**
- ✅ Verificar que Root Directory es `apps/web`
- ✅ Verificar `package.json` existe en `apps/web`
- ✅ Reintentar deploy

**P: "Cannot find module '@gastocheck/shared'"**
- ✅ Verificar pnpm workspace está bien configurado
- ✅ Ejecutar `pnpm install` en local
- ✅ Push cambios a GitHub

**P: Env variables no se cargan**
- ✅ Nombres deben estar EXACTOS
- ✅ Si empieza con `NEXT_PUBLIC_`, es pública (okay)
- ✅ Si no tiene prefijo, es privada (solo en servidor)
- ✅ Reiniciar deploy después de agregar variables

**P: Page loads but shows error**
- ✅ F12 → Console para ver el error específico
- ✅ Si es API key: verificar que está en Vercel env vars
- ✅ Si es Supabase: verificar URL y keys son de PRODUCCIÓN

---

## 📋 PRÓXIMO PASO

Una vez hayas completado deployment a Vercel:
1. ✅ Web está en: https://[tu-proyecto].vercel.app
2. ✅ Login funciona
3. ✅ APIs conectadas (si keys están en env vars)

**ENTONCES:** Pasar a **GUIA_EAS_MOBILE_DEPLOYMENT.md**
