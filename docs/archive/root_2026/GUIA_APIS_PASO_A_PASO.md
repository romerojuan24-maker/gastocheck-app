# GUÍA PASO A PASO: OBTENER TODAS LAS APIs PARA MERCADO

**Fecha:** 2026-06-19  
**Objetivo:** Obtener 4 API keys en 1.5 horas  
**Status:** 🟢 LISTO PARA EMPEZAR

---

## 1️⃣ ANTHROPIC API KEY (5 MINUTOS)

**Dónde:** https://console.anthropic.com/

### Pasos:

1. **Abrir en navegador:**
   ```
   https://console.anthropic.com/
   ```

2. **Sign up (si no tienes cuenta):**
   - Email: romero.juan24@gmail.com
   - Password: (tu contraseña habitual)
   - O conectar con Google

3. **Una vez dentro:**
   - Ir a "API Keys" (en menu lateral izquierdo)
   - Click en "+ Create Key"
   - Nombre: "check-suite-dev"
   - Click "Create"

4. **Copiar la key:**
   - Click en el icono 📋 (copy)
   - Key empieza con `sk-ant-...`

5. **Guardar en `.env.local`:**
   ```bash
   cd C:\Users\admin\Documents\gastocheck-app
   ```
   
   Abrir `.env.local` (crear si no existe):
   ```bash
   NEXT_PUBLIC_ANTHROPIC_API_KEY=sk-ant-[AQUÍ_LA_KEY]
   ```

6. **Verificar que funciona:**
   ```bash
   cd apps/web
   npm run dev
   # Navegar a http://localhost:3001/advisor
   # Hacer una pregunta
   # Debe responder en 2-3 segundos
   ```

✅ **LISTO cuando:** Advisor IA responde preguntas

---

## 2️⃣ WHATSAPP BUSINESS API (15 MINUTOS)

**Dónde:** https://developers.facebook.com/

### Pasos:

1. **Abrir Facebook Developers:**
   ```
   https://developers.facebook.com/
   ```

2. **Sign up / Log in:**
   - Facebook account (si no tienes, crear una)
   - O usar Google Sign-In

3. **Crear una app:**
   - Ir a "My Apps" (top menu)
   - Click "Create App"
   - Seleccionar: "Business"
   - Nombre: "GastoCheck"
   - Click "Create App ID"

4. **Agregar WhatsApp Product:**
   - En tu app, ir a "Add Product"
   - Buscar "WhatsApp"
   - Click "Set Up"

5. **Configurar WhatsApp:**
   - En el dashboard de WhatsApp:
   - Ir a "Getting started"
   - Seleccionar: "Business Account" → "Create new"
   - O seleccionar una existente si tienes

6. **Obtener tokens:**
   - Ir a Settings → Business Accounts
   - Ver "Phone Number ID" y "Account ID"
   - Ir a Settings → System User
   - Crear nuevo System User o usar existente
   - Generar token permanente

7. **Copiar a `.env.local`:**
   ```bash
   WHATSAPP_VERIFY_TOKEN=token-aleatorio-que-generes
   WHATSAPP_BUSINESS_ACCOUNT_ID=123456789...
   WHATSAPP_PHONE_NUMBER_ID=987654321...
   WHATSAPP_API_TOKEN=EAAxx...
   ```

8. **Setup webhook (producción, opcional por ahora):**
   - Settings → Webhooks
   - Callback URL: `https://tu-dominio.com/api/webhooks/whatsapp`
   - Verify Token: (el que escribiste en paso 7)
   - Subscribe: messages, message_template_status_update

✅ **LISTO cuando:** Token está en `.env.local` y puedes verlo en browser

---

## 3️⃣ STRIPE API KEYS (TEST) (20 MINUTOS)

**Dónde:** https://dashboard.stripe.com/

### Pasos:

1. **Crear cuenta Stripe:**
   ```
   https://dashboard.stripe.com/register
   ```
   - Email: romero.juan24@gmail.com
   - Password: tu contraseña habitual
   - Seleccionar país: Mexico
   - Moneda: MXN (puedes usar USD para testing)

2. **Verificar account:**
   - Stripe enviará email de confirmación
   - Click en link
   - Verificar teléfono (SMS)

3. **Ir a API Keys:**
   - Menu izquierdo: "Developers" → "API Keys"
   - Puedes estar en "Test mode" o "Live mode"
   - **Para MVP, usar TEST KEYS** (los primeros que ves)

4. **Copiar test keys:**
   - **Publishable Key:** pk_test_... (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
   - **Secret Key:** sk_test_... (STRIPE_SECRET_KEY)

5. **Guardar en `.env.local`:**
   ```bash
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_SECRET_KEY=sk_test_...
   ```

6. **Crear webhook secret (para testing):**
   - Menu izquierdo: "Developers" → "Webhooks"
   - "Add endpoint"
   - URL: `http://localhost:3001/api/webhooks/stripe` (para dev)
   - Eventos: `invoice.payment_succeeded`, `customer.subscription.deleted`
   - Click "Create endpoint"
   - Ver "Signing secret" → copiar a `STRIPE_WEBHOOK_SECRET`

7. **Crear 3 productos (test):**
   - Menu: "Products" (izquierda)
   - "+ Add product"
   
   **Producto 1:**
   - Name: "Starter"
   - Price: $29 USD/mes (o equivalente)
   - Billing: Monthly
   - Save
   
   **Producto 2:**
   - Name: "Pro"
   - Price: $99 USD/mes
   - Billing: Monthly
   - Save
   
   **Producto 3:**
   - Name: "Enterprise"
   - Price: Custom / Manual
   - Save

8. **Copiar Price IDs:**
   - Ir a cada producto
   - Ver "Price ID" (empieza con `price_...`)
   - Guardar en base de datos o `.env`

✅ **LISTO cuando:** Puedes hacer un test charge en modo test

---

## 4️⃣ SAT CERTIFICATES (MÉXICO) - OPCIONAL PARA MVP

**Estado:** ⏳ RECOMENDACIÓN: DIFERIR para producción (MVP puede usar mock)

**Dónde:** https://www.gob.mx/sat

**Por qué diferir:**
- Esperar 2-5 días
- Requiere tener RFC personal/empresa
- MVP puede validar CFDI en mock (devuelve "vigente")

**Si quieres hacerlo ahora:**
1. Ir a https://www.gob.mx/sat
2. Buscar "Certificado Digital de Firma Electrónica"
3. Solicitar e-firma
4. Esperar confirmación por email
5. Descargar .cer y .key
6. Guardar en `./certs/` folder

---

## ✅ VERIFICACIÓN FINAL

Después de completar TODO, tu `.env.local` debería verse así:

```bash
# Supabase (ya tiene valores)
NEXT_PUBLIC_SUPABASE_URL=https://omhycwfjxynkfwywzwvz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...

# APIs Nuevas
NEXT_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...
WHATSAPP_VERIFY_TOKEN=token-aleatorio
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789
WHATSAPP_API_TOKEN=EAAxx...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
```

### Testear cada API:

1. **Anthropic:**
   ```bash
   cd apps/web
   npm run dev
   # Ir a http://localhost:3001/advisor
   # Preguntar algo
   # Debe responder
   ```

2. **Stripe (opcional):**
   ```bash
   # Ir a /checkout (cuando implementado)
   # Usar tarjeta test: 4242 4242 4242 4242
   # Mes/Año: cualquiera (futuro)
   # CVC: 123
   # Debe procesar pago test
   ```

3. **WhatsApp:**
   - ⏳ Testear en producción solo
   - Por ahora, solo verificar tokens están en `.env`

---

## ⏱️ TIEMPO ESTIMADO

| API | Tiempo | Dificultad |
|-----|--------|------------|
| Anthropic | 5 min | 🟢 Fácil |
| WhatsApp | 15 min | 🟡 Medio |
| Stripe | 20 min | 🟡 Medio |
| SAT | 0 min | 🔴 Diferir |
| **TOTAL** | **40 min** | |

---

## 🚨 ERRORES COMUNES

**Error 1:** "API key not found"
- ✅ Verificar `.env.local` existe
- ✅ Verificar key está pegada correctamente (sin espacios extra)
- ✅ Reiniciar dev server: `npm run dev`

**Error 2:** "WhatsApp token invalid"
- ✅ Verificar token no expiró (generalmente duran 60 días)
- ✅ Verificar no hay espacios en el token
- ✅ Crear nuevo token si expiró

**Error 3:** "Stripe webhook failed"
- ✅ Verificar webhook URL es correcta
- ✅ Verificar secret key está en `.env`
- ✅ Probar con `stripe listen` en local (tool de Stripe)

---

## 📋 PRÓXIMA FASE

Cuando hayas completado TODO anterior:
1. ✅ Archivo `.env.local` actualizado
2. ✅ Todas las APIs verificadas
3. ✅ Dev server corriendo sin errores

**ENTONCES:** Pasar a FASE 2 — Supabase Producción + Testing

Ver: `CHECKLIST_EXECUTION_2026_06_19.md` → FASE 2
