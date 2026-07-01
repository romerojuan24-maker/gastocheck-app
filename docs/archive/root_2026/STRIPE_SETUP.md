# Configuración Stripe — GastoCheck

## 📋 Claves Necesarias

Necesitas generar **4 claves principales** en Stripe para integrar pagos en GastoCheck:

### 1. **STRIPE_PUBLIC_KEY** (API Key Pública)
   - **Dónde va**: Frontend, visible públicamente (seguro)
   - **Para qué**: Crear elementos de pago en la app

### 2. **STRIPE_SECRET_KEY** (API Key Secreta)
   - **Dónde va**: Backend/Edge Functions, NUNCA en frontend
   - **Para qué**: Procesar pagos, validar transacciones, crear suscripciones

### 3. **STRIPE_WEBHOOK_SECRET** (Webhook Signing Secret)
   - **Dónde va**: Edge Function de webhooks
   - **Para qué**: Validar que los eventos de Stripe son auténticos

### 4. **STRIPE_RESTRICTED_API_KEY** (Restricted API Key - Opcional pero recomendado)
   - **Dónde va**: Frontend, con permisos limitados
   - **Para qué**: Seguridad adicional (limita qué puede hacer la clave)

---

## 🔧 Procedimiento Completo para Generar Claves

### **Paso 1: Crear cuenta Stripe**
1. Ve a https://dashboard.stripe.com
2. Regístrate con tu email de empresa
3. Completa verificación de identidad (2FA)
4. Acepta términos

### **Paso 2: Obtener API Keys (Public + Secret)**

#### Para **Desarrollo** (Test mode):
1. Dashboard → **Developers** (esquina superior izquierda)
2. **API keys** en el menú izquierdo
3. Asegúrate de estar en **Test mode** (switch superior derecho)
4. Verás:
   - **Publishable key**: Comienza con `pk_test_`
   - **Secret key**: Comienza con `sk_test_`
5. Haz clic en cada una → **Reveal** → Copia a un lugar seguro

#### Para **Producción** (Live mode):
1. Mismo proceso, pero activa **Live mode**
2. Verás:
   - **Publishable key**: Comienza con `pk_live_`
   - **Secret key**: Comienza con `sk_live_`
3. ⚠️ **NUNCA compartir la Secret Key en versionado ni públicamente**

### **Paso 3: Crear Webhook Signing Secret**

1. Dashboard → **Developers** → **Webhooks** (lado izquierdo)
2. Botón **"Add endpoint"**
3. URL del webhook: `https://tudominio.supabase.co/functions/v1/stripe-webhook`
   - Reemplaza `tudominio` con tu URL de Supabase
4. **Eventos a escuchar** (selecciona estos):
   - `payment_intent.succeeded` (pago completado)
   - `payment_intent.payment_failed` (pago fallido)
   - `customer.subscription.updated` (suscripción actualizada)
   - `customer.subscription.deleted` (suscripción cancelada)
   - `invoice.payment_succeeded` (factura pagada)
5. Click **"Add endpoint"**
6. Se abrirá la página del endpoint → **Reveal** → Copia el `Signing secret` (comienza con `whsec_`)

### **Paso 4: Crear API Key Restringida (Opcional)**

1. Dashboard → **Developers** → **API keys**
2. Botón **"Create restricted key"**
3. Nombre: `GastoCheck Frontend`
4. **Permisos** (habilita solo):
   - `payment_intents.read`
   - `payment_intents.create`
   - `customers.read`
5. Copia la clave (comienza con `rk_live_` o `rk_test_`)

---

## 📁 Dónde Guardar las Claves en GastoCheck

### **Archivo: `.env.local`** (gitignored, nunca versionado)
```env
# Stripe TEST (desarrollo)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST=pk_test_xxxxx
STRIPE_SECRET_KEY_TEST=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET_TEST=whsec_test_xxxxx

# Stripe LIVE (producción)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE=pk_live_xxxxx
STRIPE_SECRET_KEY_LIVE=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET_LIVE=whsec_live_xxxxx
```

### **Archivo: `.env.production`** (después de versionado, reemplaza valores)
```env
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
```

### **Supabase Secrets** (para Edge Functions)
```bash
# Via Supabase Dashboard → Project Settings → API
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxxxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_live_xxxxx
```

---

## ✅ Checklist de Configuración

- [ ] Cuenta Stripe creada
- [ ] API Keys (test) obtenidas y guardadas en `.env.local`
- [ ] Webhook endpoint configurado con URL correcta
- [ ] Webhook secret obtenido
- [ ] Edge Function `stripe-webhook` implementada
- [ ] Supabase secrets configurados (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)
- [ ] Frontend con `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] Testeado en TEST mode primero
- [ ] API Keys (live) obtenidas
- [ ] Variables de producción configuradas en EAS
- [ ] Webhook de producción configurado
- [ ] Probado en LIVE mode con tarjeta real

---

## 🧪 Testing

### Tarjetas de Prueba Stripe (TEST mode):
- **Éxito**: `4242 4242 4242 4242`
- **Fallo**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`
- Fecha: Cualquier futuro (ej: 12/26)
- CVC: Cualquier 3 dígitos

---

## 📚 Referencias

- Documentación oficial: https://stripe.com/docs/payments
- Dashboard: https://dashboard.stripe.com
- Webhook testing: https://stripe.com/docs/webhooks/test

---

## ⚠️ Seguridad

- ✅ Public keys: Safe en frontend
- ✅ Secret keys: SOLO en backend/Edge Functions
- ✅ Webhook secrets: SOLO en Edge Functions
- ❌ NUNCA commit claves a git
- ❌ NUNCA expongas secret keys en logs
- ❌ NUNCA compartas credenciales por chat

Usa `.env.local` y `.gitignore` siempre.
