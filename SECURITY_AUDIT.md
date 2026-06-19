# 🔒 SECURITY AUDIT — CHECK SUITE MVP

**Fecha:** 2026-06-19  
**Evaluador:** Claude Code  
**Alcance:** Código MVP + configuración  
**Crítico:** 3 | Alto: 5 | Medio: 7  

---

## 📋 RESUMEN EJECUTIVO

| Severidad | Count | Ejemplos |
|-----------|-------|----------|
| 🔴 **CRÍTICO** | 3 | Exposición de errores, falta RLS en queries, logging de tokens |
| 🟠 **ALTO** | 5 | Falta rate limiting, CSRF missing, weak password policy |
| 🟡 **MEDIO** | 7 | Input validation débil, falta timeouts, secrets en console.log |
| 🟢 **BAJO** | 2 | Documentación, best practices |

**Status:** 🟡 FAIR - Funcional pero necesita fixes antes de producción

---

## 🔴 CRÍTICO (BLOQUEA PRODUCCIÓN)

### C1: Exposición de Error Messages en API

**Ubicación:** `apps/web/app/api/create-checkout-session/route.ts:61`

**Problema:**
```typescript
return NextResponse.json(
  { error: error.message || "Error creating checkout session" },
  { status: 500 },
)
// ❌ Expone información sensible del error
```

**Riesgo:** Atacante puede ver stack traces, paths, internals

**Solución:**
```typescript
// ✅ CORRECCIÓN
return NextResponse.json(
  { error: "Internal server error" },  // Genérico
  { status: 500 },
)

// Y loguear internamente:
console.error("Checkout error details:", {
  error: error.message,
  stack: error.stack,
  timestamp: new Date().toISOString(),
})
```

**Prioridad:** 🔴 CRÍTICO - Hacer antes de deploy  
**Tiempo:** 5 minutos

---

### C2: Logging de Tokens en Console

**Ubicación:** Múltiples archivos, ej `apps/web/app/api/create-checkout-session/route.ts:57`

**Problema:**
```typescript
console.error("Checkout error:", error)
// ❌ Si error contiene token Bearer, queda en logs
```

**Riesgo:** Token de autenticación en logs públicos/CI

**Solución:**
```typescript
// ✅ CORRECCIÓN
const sanitizedError = {
  message: error.message,
  code: error.code,
  // ❌ NO incluir error.token, error.auth, etc.
}
console.error("Checkout error:", sanitizedError)
```

**Prioridad:** 🔴 CRÍTICO  
**Tiempo:** 10 minutos (buscar todos los console.error)

---

### C3: RLS Policies No Validadas en Queries

**Ubicación:** `apps/web/app/cobracheck/page.tsx:35-39`

**Problema:**
```typescript
const { data: clientsData } = await supabase
  .from('cobra_clients')
  .select('*')
  .eq('company_id', member.company_id)  // ❌ RLS debería bloquearlo
  // Pero si RLS falla, la query igual retorna datos
```

**Riesgo:** Si RLS policies se deshabilitan accidentalmente, todos ven todos los datos

**Solución:**
```typescript
// ✅ CORRECCIÓN: Validar que el usuario pertenece a company_id
const { data: member } = await supabase
  .from('company_members')
  .select('company_id')
  .eq('user_id', session.user.id)
  .single()  // ⬅️ Falla si usuario no en esta empresa

if (!member || member.company_id !== requestedCompanyId) {
  throw new Error('Unauthorized: User not in this company')
}
```

**Prioridad:** 🔴 CRÍTICO  
**Tiempo:** 20 minutos (auditar todas las queries)

---

## 🟠 ALTO (DEBE FIXEAR PRONTO)

### A1: Falta Rate Limiting

**Ubicación:** Todas las API routes

**Problema:**
```typescript
export async function POST(req: NextRequest) {
  // ❌ Sin rate limiting
  // Atacante puede bruteforcear checkout session
}
```

**Riesgo:** DDoS, brute force attacks, abuse de recursos

**Solución:**
```typescript
// ✅ Usar middleware con Upstash Redis
import { Ratelimit } from "@upstash/ratelimit"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 h"),  // 10 req/hora
})

export async function POST(req: NextRequest) {
  const identifier = req.headers.get("x-forwarded-for") || "unknown"
  const { success } = await ratelimit.limit(identifier)
  
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    )
  }
  // ... resto del código
}
```

**Prioridad:** 🟠 ALTO - Antes de producción  
**Tiempo:** 30 minutos (setup Upstash + middleware)

---

### A2: Weak Password Policy

**Ubicación:** `apps/web/lib/schemas.ts:5`

**Problema:**
```typescript
password: z.string().min(6, 'Mínimo 6 caracteres')
// ❌ 6 caracteres = demasiado débil
```

**Riesgo:** Passwords fáciles de bruteforcear

**Solución:**
```typescript
// ✅ CORRECCIÓN
password: z.string()
  .min(12, 'Mínimo 12 caracteres')
  .regex(/[A-Z]/, 'Debe contener mayúsculas')
  .regex(/[0-9]/, 'Debe contener números')
  .regex(/[!@#$%^&*]/, 'Debe contener caracteres especiales'),
```

**Prioridad:** 🟠 ALTO  
**Tiempo:** 5 minutos

---

### A3: Missing CSRF Protection

**Ubicación:** Todas las API routes

**Problema:**
```typescript
export async function POST(req: NextRequest) {
  // ❌ Sin CSRF token validation
  // Atacante puede hacer POST desde otro sitio
}
```

**Solución:**
```typescript
// ✅ En middleware:
const csrfToken = req.headers.get("x-csrf-token")
if (!csrfToken || csrfToken !== req.cookies.get("csrf-token")) {
  return NextResponse.json(
    { error: "CSRF validation failed" },
    { status: 403 }
  )
}
```

**Prioridad:** 🟠 ALTO  
**Tiempo:** 1 hora (implementar en todas las routes)

---

### A4: No Timeout en Fetch Calls

**Ubicación:** `apps/web/app/api/create-checkout-session/route.ts:37-47`

**Problema:**
```typescript
const response = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-checkout-session`,
  {
    method: "POST",
    // ❌ Sin timeout - puede colgar indefinidamente
  },
)
```

**Riesgo:** Hanging requests, server exhaustion

**Solución:**
```typescript
// ✅ CORRECCIÓN
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 5000)  // 5 seg timeout

const response = await fetch(url, {
  method: "POST",
  signal: controller.signal,
})

clearTimeout(timeoutId)
```

**Prioridad:** 🟠 ALTO  
**Tiempo:** 15 minutos

---

### A5: No Validation of Redirects

**Ubicación:** `apps/web/app` (múltiples)

**Problema:**
```typescript
router.push(redirect_url)  // ❌ Sin validar que es URL válida
// Atacante puede redirigir a phishing site
```

**Solución:**
```typescript
// ✅ CORRECCIÓN
function isValidRedirect(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin)
    // Solo permitir misma app
    return parsed.origin === window.location.origin
  } catch {
    return false
  }
}

if (isValidRedirect(redirect)) {
  router.push(redirect)
} else {
  router.push('/default-page')
}
```

**Prioridad:** 🟠 ALTO  
**Tiempo:** 10 minutos

---

## 🟡 MEDIO (DEBE FIXEAR ANTES DE MVP)

### M1: Input Validation Inconsistente

**Ubicación:** `apps/web/lib/schemas.ts`

**Problema:**
```typescript
email: z.string().email('Email inválido').optional()
// ❌ zod.string().email() es muy permisivo
// Acepta "a@b" que técnicamente es válido pero poco realista
```

**Solución:**
```typescript
// ✅ Más estricto
email: z.string()
  .email('Email inválido')
  .refine(e => e.includes('.'), 'Email debe incluir dominio')
  .refine(e => !e.endsWith('.'), 'Email no debe terminar en punto'),
```

**Prioridad:** 🟡 MEDIO  
**Tiempo:** 10 minutos

---

### M2: No Sanitization de HTML

**Ubicación:** Múltiples campos (name, description, etc)

**Problema:**
```typescript
name: z.string().min(3, 'Nombre requerido')
// ❌ Acepta HTML: "<img src=x onerror=alert('XSS')>"
```

**Solución:**
```typescript
// ✅ Usar DOMPurify o similar
import DOMPurify from 'isomorphic-dompurify'

name: z.string()
  .min(3, 'Nombre requerido')
  .refine(v => v === DOMPurify.sanitize(v), 'Caracteres inválidos'),
```

**Prioridad:** 🟡 MEDIO  
**Tiempo:** 20 minutos

---

### M3: No Authentication Check en Stripe Webhook

**Ubicación:** Webhook handlers (si existen)

**Problema:**
```typescript
export async function POST(req: NextRequest) {
  const event = await req.json()
  // ❌ Sin verificar firma de Stripe
  // Atacante puede fingir pagos
}
```

**Solución:**
```typescript
// ✅ Verificar firma
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const sig = req.headers.get('stripe-signature')!
const event = stripe.webhooks.constructEvent(
  await req.text(),
  sig,
  process.env.STRIPE_WEBHOOK_SECRET!
)

// Ahora sí confiar en event
```

**Prioridad:** 🟡 MEDIO (si hay webhooks)  
**Tiempo:** 15 minutos

---

### M4: Secrets Hardcoded Potencialmente

**Ubicación:** `.env.example` (prevención)

**Problema:**
```bash
# .env.example contiene valores reales (NUNCA hacer esto)
STRIPE_SECRET_KEY=sk_live_abc123
```

**Solución:**
```bash
# ✅ .env.example SOLO con placeholders
STRIPE_SECRET_KEY=your_stripe_secret_key_here
SUPABASE_URL=your_supabase_url_here
```

**Prioridad:** 🟡 MEDIO  
**Tiempo:** 5 minutos

---

### M5: No Audit Logging

**Ubicación:** Actions críticas (crear factura, aprobar, etc)

**Problema:**
```typescript
// No hay registro de quién hizo qué, cuándo
const { error } = await supabase
  .from('cobra_invoices')
  .insert({ /* ... */ })
// ❌ No se loguea la acción
```

**Solución:**
```typescript
// ✅ Agregar audit logging
await supabase
  .from('audit_logs')
  .insert({
    user_id: session.user.id,
    action: 'invoice_created',
    resource: 'cobra_invoices',
    resource_id: invoiceId,
    timestamp: new Date().toISOString(),
    details: { /* cambios */ }
  })
```

**Prioridad:** 🟡 MEDIO  
**Tiempo:** 1 hora (configurar audit)

---

### M6: No Rate Limiting en Auth

**Ubicación:** Login endpoint

**Problema:**
```typescript
// Sin rate limiting en login
// Atacante puede bruteforcear contraseñas
```

**Solución:**
```typescript
// ✅ Usar Supabase auth rate limiting o adicional middleware
const { count } = await supabase
  .from('login_attempts')
  .select('*', { count: 'exact' })
  .eq('email', email)
  .gte('timestamp', new Date(Date.now() - 15 * 60 * 1000))  // Últimos 15 min

if (count > 5) {
  return NextResponse.json(
    { error: "Too many login attempts" },
    { status: 429 }
  )
}
```

**Prioridad:** 🟡 MEDIO  
**Tiempo:** 30 minutos

---

### M7: CORS No Configurado

**Ubicación:** `next.config.js` o middleware

**Problema:**
```typescript
// ❌ Sin CORS headers
// Cualquier sitio puede llamar tus APIs
```

**Solución:**
```typescript
// ✅ En middleware o headers config
export async function middleware(req: NextRequest) {
  const response = new NextResponse()
  
  response.headers.set('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_APP_URL!)
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  return response
}
```

**Prioridad:** 🟡 MEDIO  
**Tiempo:** 10 minutos

---

## 🟢 BAJO (NICE TO HAVE)

### L1: Documentación de Security

**Recomendación:** Crear `SECURITY.md` con políticas de:
- Reporting de vulnerabilidades
- Security contact
- Supported versions

**Tiempo:** 20 minutos

---

### L2: Dependencias Outdated

**Recomendación:** 
```bash
npm audit
npm audit fix
```

**Tiempo:** 10 minutos

---

## ✅ CHECKLIST PRE-PRODUCCIÓN

- [ ] C1: Fix exposición de error messages
- [ ] C2: Remover logging de tokens
- [ ] C3: Auditar RLS policies
- [ ] A1: Implementar rate limiting
- [ ] A2: Aumentar password policy
- [ ] A3: Agregar CSRF protection
- [ ] A4: Agregar timeouts en fetch
- [ ] A5: Validar redirects
- [ ] M1: Input validation strict
- [ ] M2: HTML sanitization
- [ ] M3: Verificar Stripe webhook
- [ ] M4: Revisar .env.example
- [ ] M5: Audit logging
- [ ] M6: Rate limiting auth
- [ ] M7: CORS config

---

## 📊 TIMELINE

```
CRÍTICO (C1-C3)      ████ 30 minutos
ALTO (A1-A5)         ████████ 1.5 horas
MEDIO (M1-M7)        ██████████ 2 horas

TOTAL                ████████████████ 4 horas

RECOMENDACIÓN:
- Hoy: Fijar CRÍTICO (30 min)
- Mañana: Fijar ALTO (1.5h)
- Antes de deploy: Fijar MEDIO (2h)
```

---

## 🔐 DESPUÉS DE PRODUCCIÓN

Implementar también:
- [ ] Penetration testing
- [ ] Bug bounty program
- [ ] Security headers (Helmet.js)
- [ ] API rate limiting global
- [ ] Database encryption at rest
- [ ] Secrets rotation
- [ ] WAF (Web Application Firewall)

---

## 📞 REFERENCES

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Next.js Security: https://nextjs.org/docs/basic-features/security
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security

---

**Auditoría completada:** 2026-06-19  
**Próximo review:** Después de fixes  
**Status:** 🟡 FAIR - Funcional pero con issues de seguridad
