# CHECK SUITE — GUÍA DETALLADA: DE MVP A MERCADO

**Status:** 2026-06-18 | MVP 90% funcional | Falta: configuración + testing + deployment

---

## 📋 TABLA DE CONTENIDOS
1. [Configuración de APIs Externas](#configuración-de-apis)
2. [Variables de Entorno](#variables-de-entorno)
3. [Testing Completo (PC + Teléfono)](#testing-completo)
4. [Fixes Menores Encontrados](#fixes-menores)
5. [Deployment (Vercel + EAS)](#deployment)
6. [Flujos Críticos a Validar](#flujos-críticos)
7. [Checklist Pre-Mercado](#checklist-pre-mercado)

---

## 1. CONFIGURACIÓN DE APIs EXTERNAS

### 1.1 ANTHROPIC API (Advisor IA)

**QUÉ HACE:**
- Usuario pregunta al Advisor ("¿Me alcanza para pagar?")
- Claude analiza: clientes, cartera, saldo, proyecciones
- Devuelve recomendación financiera en 2-3 segundos

**PASOS:**
1. Ir a https://console.anthropic.com/
2. Sign up / Log in
3. Create API Key
4. Copiar a `.env.local`:
   ```
   NEXT_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...
   ```

**COSTO:** $0.003 / 1K input, $0.015 / 1K output
**TIEMPO:** 5 minutos

---

### 1.2 WHATSAPP BUSINESS API

**QUÉ HACE:**
- Cliente paga por WhatsApp: "Pagué $5000"
- Sistema auto-crea registro de pago
- Supervisor recibe notificación

**PASOS:**
1. Ir a https://www.whatsapp.com/business/
2. Sign up empresa + verificar RFC
3. Crear app en Meta Developers
4. Setup webhook URL
5. Copiar tokens a `.env`:
   ```
   WHATSAPP_VERIFY_TOKEN=token-aleatorio
   WHATSAPP_BUSINESS_ACCOUNT_ID=12345...
   WHATSAPP_API_TOKEN=EAAxx...
   ```

**COSTO:** Gratis primeros 1000 mensajes, después $0.04-0.08/msg
**TIEMPO:** 15 minutos (requiere verificación de empresa)

---

### 1.3 SAT CFDI VALIDATION (México)

**QUÉ HACE:**
- Usuario sube CFDI (factura XML)
- Sistema consulta SAT
- Muestra: vigente, cancelado, no encontrado

**PASOS:**
1. Obtener certificado digital SAT (https://www.gob.mx/sat)
2. Solicitar e-firma (2-5 días)
3. En `apps/web/lib/sat.ts`:
   ```
   SAT_CERT_PATH=./certs/cert.cer
   SAT_KEY_PATH=./certs/key.key
   SAT_KEY_PASSWORD=tu-password
   ```

**COSTO:** Gratis (servicio público México)
**TIEMPO:** 1-2 horas espera + 10 min config

---

### 1.4 STRIPE (Pagos SaaS)

**QUÉ HACE:**
- Usuario elige plan: Starter ($299/mes), Pro ($999/mes)
- Stripe cobra automáticamente
- Acceso desbloqueado a módulos

**PASOS:**
1. Crear cuenta Stripe: https://dashboard.stripe.com/register
2. Ir a Settings → API Keys
3. Copiar a `.env.production`:
   ```
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
4. Crear 3 Productos (Starter, Pro, Enterprise)
5. Copiar Price IDs

**COSTO:** 2.9% + $0.30 por transacción
**TIEMPO:** 20 minutos

---

## 2. VARIABLES DE ENTORNO

### 2.1 `.env.local` (Desarrollo)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://omhycwfjxynkfwywzwvz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
NEXT_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...
WHATSAPP_VERIFY_TOKEN=token-aleatorio
STRIPE_SECRET_KEY=sk_test_...
NODE_ENV=development
```

### 2.2 `.env.production` (Mercado)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://[production-project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[production-key]
NEXT_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_live_...
NODE_ENV=production
```

**TIEMPO:** 5 minutos

---

## 3. TESTING COMPLETO (PC + TELÉFONO)

### 3.1 Testing en PC (Navegador)

**USUARIO TEST:**
- Email: testadmin@gastocheck.com
- Password: TestPass123!
- Role: owner
- Company: TEST Inc.

**CREAR EN SUPABASE:**
```sql
-- Insert test user (via Auth UI)
-- Email: testadmin@gastocheck.com
-- Password: TestPass123!

-- Insert profile
INSERT INTO profiles (id, full_name) 
VALUES ('[user-id]', 'Test Admin');

-- Insert test company
INSERT INTO companies (legal_name, rfc, sector)
VALUES ('TEST Inc.', 'TEST123456789', 'Manufactura');

-- Insert company member
INSERT INTO company_members (user_id, company_id, role, status)
VALUES ('[user-id]', '[company-id]', 'owner', 'active');

-- Insert test clients
INSERT INTO cobra_clients (company_id, name, rfc, current_balance, risk_score)
VALUES 
  ('[company-id]', 'Cliente A', 'CLI001', 50000, 65),
  ('[company-id]', 'Cliente B', 'CLI002', 120000, 45);
```

**FLUJOS A TESTEAR:**

1. **Login**
   - [ ] Ir a http://localhost:3001/login
   - [ ] Ingresar email + password
   - [ ] ✅ Redirige a /hoy
   - [ ] ✅ Ver KPIs

2. **CobraCheck**
   - [ ] Ir a /cobracheck
   - [ ] ✅ Ver clientes + invoices vencidas
   - [ ] Click "+ Nuevo Cliente"
   - [ ] ✅ Modal abre
   - [ ] Ingresar datos
   - [ ] ✅ Cliente aparece en lista

3. **Advisor IA**
   - [ ] Ir a /advisor
   - [ ] Escribir pregunta: "¿Me alcanza dinero para pagar?"
   - [ ] ✅ Ver respuesta de Claude en 2-3 seg

4. **BancoCheck**
   - [ ] Ir a /bancocheck
   - [ ] ✅ Ver KPIs + tabs

5. **FlujoCheck**
   - [ ] Ir a /flujocheck
   - [ ] ✅ Ver proyección + risk badge

**TIEMPO:** 30 minutos

---

### 3.2 Testing en Teléfono (Mobile)

**BUILD:**
```bash
cd apps/mobile
npx eas build --platform all --local
# O usar Expo Go para testing rápido:
npx expo start --localhost
```

**FLUJOS A TESTEAR:**

1. **Login**
   - [ ] Abrir app
   - [ ] ✅ Login screen visible
   - [ ] Ingresar credentials
   - [ ] ✅ Dashboard

2. **Comprobantes**
   - [ ] Tab "Capturar"
   - [ ] ✅ Cámara abre
   - [ ] Capturar receipt
   - [ ] ✅ OCR procesa (2-3 seg)
   - [ ] ✅ Aparece en "Mis comprobantes"

3. **CobraCheck**
   - [ ] Tab "Cobracheck"
   - [ ] ✅ Ver clientes + scoring

4. **Offline**
   - [ ] Airplane mode ON
   - [ ] ✅ Datos anteriores visibles
   - [ ] Airplane mode OFF
   - [ ] ✅ Sync automático

**TIEMPO:** 45 minutos

---

## 4. FIXES MENORES EN QA

### 4.1 CobraCheck - Form de nuevo cliente

**PROBLEMA:** Validación no funciona bien

**FIX:** En `apps/web/app/cobracheck/page.tsx` línea 78:
```typescript
const handleAddClient = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  setNewClientError(null)
  try {
    const formData = new FormData(e.currentTarget)
    const name = formData.get('name') as string
    const rfc = formData.get('rfc') as string

    if (!name || name.length < 3) throw new Error('Nombre requerido (min 3)')
    if (!rfc || rfc.length < 12) throw new Error('RFC inválido')

    const { data: member } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('auth_id', session.user.id)
      .single()

    const { error } = await supabase.from('cobra_clients').insert({
      name,
      rfc,
      company_id: member.company_id
    })

    if (error) throw error
    setShowNewClient(false)
    loadData()
  } catch (err: any) {
    setNewClientError(err.message)
  }
}
```

**TIEMPO:** 10 minutos

---

### 4.2 Advisor IA - Fallback si no hay key

**FIX:** En `apps/web/lib/advisor.ts` línea 15:
```typescript
export async function askAdvisor(question: string, context: any) {
  if (!process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY) {
    return {
      answer: '⚠️ Advisor IA no configurado. Contacta al admin.',
      success: false
    };
  }
  // resto del código
}
```

**TIEMPO:** 5 minutos

---

## 5. DEPLOYMENT

### 5.1 Vercel (Web)

**PASOS:**
```bash
vercel link
# Configurar env vars en Vercel dashboard
vercel --prod
```

**URL:** https://tu-proyecto.vercel.app

**TIEMPO:** 15 minutos

---

### 5.2 EAS Build (Mobile)

**PASOS:**
```bash
eas login
cd apps/mobile
eas build --platform all --local
# Android APK: instalar en teléfono
# iOS: usar TestFlight
```

**TIEMPO:** 30 minutos (descarga dependencias)

---

## 6. FLUJOS CRÍTICOS A VALIDAR

### 6.1 Capturar → Exportar

1. Capturar receipt en mobile
2. ✅ OCR procesa
3. ✅ Aparece en /gastocheck
4. Aprobar (supervisor)
5. ✅ Mover a "aprobados"
6. Exportar a Excel
7. ✅ Descargar archivo

**TIEMPO:** 20 minutos

---

### 6.2 Cliente → Factura → Pago

1. /cobracheck → "+ Nuevo Cliente"
2. Crear factura $50,000
3. ✅ Aparece como "pending"
4. Registrar pago
5. ✅ Balance = $0
6. ✅ Risk score baja

**TIEMPO:** 15 minutos

---

### 6.3 BancoCheck → FlujoCheck

1. /bancocheck → Importar CSV
2. ✅ 10 transacciones en lista
3. Clasificar
4. /flujocheck
5. ✅ Ver saldo + proyección
6. /advisor → Pregunta
7. ✅ Ver respuesta

**TIEMPO:** 20 minutos

---

## 7. CHECKLIST PRE-MERCADO

### SEMANA 1: Configuración
- [ ] ANTHROPIC_API_KEY (5 min)
- [ ] WhatsApp Business (15 min)
- [ ] .env.production (5 min)
**Subtotal: 25 min**

### SEMANA 2: Testing
- [ ] Testing PC (30 min)
- [ ] Testing Mobile (45 min)
- [ ] Validar flujos críticos (60 min)
- [ ] Arreglar bugs (30 min)
**Subtotal: 2.5h**

### SEMANA 3: Deployment
- [ ] Deploy Vercel (15 min)
- [ ] Deploy EAS (30 min)
- [ ] Monitoring setup (30 min)
- [ ] Documentación (30 min)
**Subtotal: 1.75h**

---

## ✅ CRITERIOS DE ÉXITO

**LISTO CUANDO:**
- [ ] APIs configuradas y respondiendo
- [ ] Login funciona en PC y móvil
- [ ] Al menos 1 flujo crítico end-to-end funciona
- [ ] No hay errores en Sentry
- [ ] Mobile abre en < 2 segundos
- [ ] Datos persisten después de cerrar

**NO LISTO CUANDO:**
- [ ] APIs sin configurar
- [ ] Errores en tests
- [ ] Flujos interruptos
- [ ] Performance < 2s

---

**TIEMPO TOTAL: 6-8 HORAS (1 DÍA)**

**COSTO INICIAL: $20-100/mes en APIs**

**STATUS: 🟢 LISTO PARA EMPEZAR**
