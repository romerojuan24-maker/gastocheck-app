# 🔧 TROUBLESHOOTING - ERRORES COMUNES Y SOLUCIONES

**Última actualización:** 2026-06-19  
**Aplicable a:** CHECK SUITE MVP (GastoCheck + CobraCheck)

---

## 📋 TABLA DE CONTENIDOS
1. [Errores de Setup](#errores-de-setup)
2. [Errores de APIs](#errores-de-apis)
3. [Errores de Database](#errores-de-database)
4. [Errores de Testing](#errores-de-testing)
5. [Errores de Deployment](#errores-de-deployment)

---

## ERRORES DE SETUP

### Error: "Module not found: can't resolve '@gastocheck/shared'"

**Síntoma:**
```
Error: Can't resolve '@gastocheck/shared' in '/apps/web/app'
```

**Causa:** Workspace pnpm no está sincronizado

**Solución:**
```bash
cd C:\Users\admin\Documents\gastocheck-app
pnpm install  # Instalar todas las dependencias
pnpm -r build  # Build all packages
```

**Si sigue fallando:**
```bash
# Nuclear option: limpiar todo
pnpm -r clean  # Limpiar node_modules
pnpm install   # Reinstalar
```

---

### Error: "ENOENT: no such file or directory, open '.env.local'"

**Síntoma:**
```
Error: ENOENT: no such file or directory, open '.env.local'
```

**Causa:** `.env.local` no existe

**Solución:**
```bash
cd C:\Users\admin\Documents\gastocheck-app
# Copiar template
cp .env.example .env.local

# O crear manualmente:
# - Abrir: C:\Users\admin\Documents\gastocheck-app\.env.local
# - Copiar de .env.example
# - Actualizar valores
```

---

### Error: "npm ERR! workspaces not supported for global installs"

**Síntoma:**
```
npm ERR! workspaces not supported for global installs
```

**Causa:** Usando `npm` en lugar de `pnpm`

**Solución:**
```bash
# Usar pnpm (ya instalado globalmente)
pnpm install
pnpm run dev  # en lugar de npm run dev
```

---

## ERRORES DE APIs

### Error: "API key not found / undefined"

**Síntoma:**
```
Error: Cannot find property 'NEXT_PUBLIC_ANTHROPIC_API_KEY' is undefined
```

**Causa:** API key no está en `.env.local` o no se recargó

**Solución:**

1. **Verificar `.env.local` tiene la key:**
   ```bash
   cat .env.local | grep ANTHROPIC_API_KEY
   # Debería mostrar: NEXT_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...
   ```

2. **Reiniciar dev server:**
   ```bash
   # En terminal:
   Ctrl+C  # Detener npm run dev
   npm run dev  # Reiniciar
   ```

3. **Verificar no hay espacios extra:**
   ```bash
   # ❌ MALO:
   NEXT_PUBLIC_ANTHROPIC_API_KEY= sk-ant-...
   #                               ^ espacio aquí
   
   # ✅ BUENO:
   NEXT_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...
   ```

4. **Verificar archivo se guardó:**
   ```bash
   # En Windows:
   type .env.local | findstr ANTHROPIC
   ```

---

### Error: "Anthropic API returned 401 Unauthorized"

**Síntoma:**
```
Error: Anthropic API returned 401 Unauthorized
```

**Causa:** API key inválida o expirada

**Solución:**

1. **Verificar key es correcta:**
   - Ir a https://console.anthropic.com/
   - Settings → API Keys
   - Copiar nuevamente (puede haber expirado)

2. **Regenerar key si expiró:**
   - Click en la key
   - "Delete" → Confirmar
   - "+ Create Key"
   - Copiar nueva key a `.env.local`
   - Reiniciar: `npm run dev`

3. **Verificar no hay caracteres extras:**
   ```bash
   # Copy/paste puede agregar espacios o caracteres invisibles
   # Solución: pegar en editor de texto, limpiar, copiar de nuevo
   ```

---

### Error: "WhatsApp token invalid / expired"

**Síntoma:**
```
Error: WhatsApp token invalid or expired
```

**Solución:**

1. **Regenerar token en Meta:**
   - Ir a https://developers.facebook.com/
   - My Apps → Tu app → WhatsApp
   - Settings → System User
   - "Generate New Token"
   - Copiar a `.env.local`

2. **Verificar URL webhook es correcta:**
   ```
   Debe ser: https://[tu-dominio]/api/webhooks/whatsapp
   (en dev: http://localhost:3001/api/webhooks/whatsapp)
   ```

3. **Verificar WHATSAPP_VERIFY_TOKEN:**
   - Debe ser un string aleatorio que TÚ generaste
   - Debe coincidir en Meta Dashboard y `.env.local`

---

### Error: "Stripe webhook signature verification failed"

**Síntoma:**
```
Error: Webhook signature verification failed
```

**Causa:** STRIPE_WEBHOOK_SECRET no coincide

**Solución:**

1. **Obtener secret correcto:**
   - Ir a https://dashboard.stripe.com/
   - Developers → Webhooks
   - Click en el webhook
   - Copiar "Signing secret" (empieza con `whsec_...`)

2. **Actualizar `.env.local`:**
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

3. **Reiniciar server:**
   ```bash
   npm run dev
   ```

4. **Verificar URL webhook en Stripe:**
   - Debe ser exacta: `https://[tu-dominio]/api/webhooks/stripe`
   - Para dev: `http://localhost:3001/api/webhooks/stripe`

---

## ERRORES DE DATABASE

### Error: "Permission denied" al ejecutar migraciones Supabase

**Síntoma:**
```
Error: Permission denied for schema migrations
```

**Causa:** No estás logged in a Supabase CLI

**Solución:**

1. **Login en Supabase:**
   ```bash
   supabase logout
   supabase login
   # Se abrirá navegador
   # Login con Google (romero.juan24@gmail.com)
   # Copiar token que aparezca
   # Pegar en terminal
   ```

2. **Verificar estás logged:**
   ```bash
   supabase projects list
   # Debería mostrar tus proyectos
   ```

3. **Ejecutar migraciones nuevamente:**
   ```bash
   supabase db push --project-ref [proyecto-id]
   ```

---

### Error: "Table 'cobra_clients' already exists"

**Síntoma:**
```
Error: relation "cobra_clients" already exists
```

**Causa:** Las migraciones ya se ejecutaron

**Solución:**

**✅ Esto es NORMAL y SAFE.** Las migraciones son idempotentes.

Opciones:
1. **Ignorar el error** (las tablas ya existen, está bien)
2. **Reset DB (CUIDADO - borra datos):**
   ```bash
   # En Supabase SQL Editor:
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   
   # Luego ejecutar migraciones nuevamente
   supabase db push --project-ref [proyecto-id]
   ```

---

### Error: "RLS policy blocking select"

**Síntoma:**
```
Error: new row violates row level security policy
```

**Causa:** RLS está bloqueando porque estás viendo datos de otra empresa

**Solución:**

**✅ Esto es CORRECTO y ESPERADO.** RLS está protegiendo los datos.

Para testing:
1. **Verificar que estás logged con el usuario correcto:**
   ```bash
   # En http://localhost:3001
   # Click avatar → Ver email
   # Debe ser: testadmin@gastocheck.com
   ```

2. **Verificar que ese usuario pertenece a la empresa:**
   ```bash
   # En Supabase SQL Editor:
   SELECT * FROM company_members 
   WHERE user_id = '[tu-user-id]';
   # Debería devolver 1 fila
   ```

3. **Si RLS bloquea acceso legítimo:**
   ```bash
   # Temporalmente deshabilitar RLS (solo dev):
   # En Supabase: Database → Policies → Disable RLS
   # (No hacer esto en producción)
   ```

---

## ERRORES DE TESTING

### Error: "Cannot read property 'length' of undefined"

**Síntoma:**
```
TypeError: Cannot read property 'length' of undefined
```

**Causa:** Datos no están cargados correctamente

**Solución:**

1. **Verificar datos en Supabase:**
   ```bash
   # En Supabase SQL Editor:
   SELECT * FROM cobra_clients WHERE company_id = '[company-id]';
   # Debería devolver 5 filas
   ```

2. **Verificar query en código:**
   - Ver: `apps/web/app/cobracheck/page.tsx`
   - Línea: ~35-38
   - Debe tener: `.select('*')` y `.eq('company_id', member.company_id)`

3. **Verificar usuario logged:**
   - F12 → Console
   - Ver si hay error de autenticación

---

### Error: "Advisor IA no responde"

**Síntoma:**
```
Page carga pero no responde a preguntas
```

**Causa:** ANTHROPIC_API_KEY no está configurada

**Solución:**

1. **Verificar API key:**
   ```bash
   cat .env.local | grep ANTHROPIC_API_KEY
   # Debe mostrar valor no vacío
   ```

2. **Verificar en navegador:**
   - F12 → Network tab
   - Hacer pregunta en /advisor
   - Ver request a `/api/advisor`
   - Si error 500: API key inválida
   - Si timeout: API key válida pero no responde (Anthropic down)

3. **Solución:**
   ```bash
   # Regenerar key en https://console.anthropic.com/
   # Copiar a .env.local
   # Reiniciar: npm run dev
   # Intentar pregunta nuevamente
   ```

---

### Error: "Login falla con 'Unauthorized'"

**Síntoma:**
```
Error: Unauthorized access
```

**Causa:** Usuario no existe en Auth o credenciales incorrectas

**Solución:**

1. **Verificar usuario existe:**
   - Ir a Supabase Dashboard → Authentication → Users
   - Buscar: testadmin@gastocheck.com
   - Si no existe: crear manualmente

2. **Verificar contraseña:**
   - Password debe ser exacto: `TestPass123!`
   - Verificar mayúsculas/minúsculas

3. **Verificar usuario tiene perfil:**
   ```bash
   # En Supabase SQL Editor:
   SELECT * FROM profiles WHERE email = 'testadmin@gastocheck.com';
   # Debería devolver 1 fila
   ```

4. **Verificar usuario en company:**
   ```bash
   # En Supabase SQL Editor:
   SELECT * FROM company_members 
   WHERE user_id = '[user-id]';
   # Debería devolver al menos 1 fila
   ```

---

## ERRORES DE DEPLOYMENT

### Error: "Build failed on Vercel - Module not found"

**Síntoma:**
```
Build failed: Can't resolve '@gastocheck/shared'
```

**Causa:** Root directory no es `apps/web`

**Solución:**

1. **En Vercel Dashboard:**
   - Tu proyecto → Settings → Build & Development Settings
   - Root Directory: `apps/web` (EXACTO)
   - Click Save

2. **Redeploy:**
   - Click "Redeploy"
   - Esperar a que complete

---

### Error: "EAS build failed - out of memory"

**Síntoma:**
```
Build failed: out of memory
```

**Causa:** Servidor EAS sin memoria disponible

**Solución:**

```bash
# Retry la build (EAS asigna diferentes servidores)
eas build --platform android --profile preview

# Si sigue fallando:
# - Reducir tamaño de app
# - O usar Expo Go para testing (no requiere build)
npx expo start --localhost
```

---

### Error: "APK no se instala en teléfono"

**Síntoma:**
```
"App not installed" después de instalar APK
```

**Causa:** Arquitectura de teléfono no coincide

**Solución:**

1. **Verificar arquitectura del teléfono:**
   - Settings → About phone → Processor
   - Buscar: ARM64 (recomendado) o x86

2. **Descargar APK correcto:**
   ```bash
   # Android ARM64 (universal):
   eas build --platform android --profile preview
   # Debería funcionar en la mayoría
   ```

3. **Si sigue sin funcionar:**
   ```bash
   # Opción alternativa: Expo Go (sin build)
   npx expo start --localhost
   # Abrir Expo Go app en teléfono
   # Scan QR code
   ```

---

### Error: "TypeError: Cannot find module when using Sentry"

**Síntoma:**
```
Error: Cannot find module '@sentry/nextjs'
```

**Causa:** Sentry no está instalado

**Solución:**

```bash
# Sentry es opcional para MVP
# Para ahora, está deshabilitado
# (veremos en producción cuando los errores sean críticos)

# Si quieres habilitarlo:
cd apps/web
npm install @sentry/nextjs
# Luego configurar en next.config.js
```

---

## 🆘 OBTENER AYUDA ADICIONAL

Si el error no está aquí:

1. **Checa los logs completos:**
   ```bash
   # Terminal mostrará el error completo
   # Copiar TODO el output
   ```

2. **Busca en el código:**
   ```bash
   grep -r "error message" apps/
   # Ver dónde ocurre
   ```

3. **Verifica credenciales:**
   ```bash
   # Asegúrate que:
   # ✅ API keys son válidas
   # ✅ URLs son correctas
   # ✅ No hay espacios extra
   # ✅ Caracteres especiales están escapados
   ```

4. **Últimas opciones:**
   - Reset completo: `pnpm -r clean && pnpm install`
   - Nuclear option: Eliminar `node_modules` + `.next` + `pnpm-lock.yaml`
   - Contactar support (después de MVP)

---

**Última actualización:** 2026-06-19  
**Aplicable a:** MVP CHECK SUITE v1.0
