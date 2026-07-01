# 🔧 SECURITY FIXES - CÓDIGO LISTO PARA COPIAR

**Fecha:** 2026-06-19  
**Status:** ✅ 2 CRÍTICOS YA ARREGLADOS + 13 PENDIENTES  

---

## ✅ YA ARREGLADOS (2)

### ✅ C1: Error Message Exposure - FIXED

**Archivo:** `apps/web/app/api/create-checkout-session/route.ts`  
**Cambio:** Línea 56-61 → Generic error message  
**Status:** ✅ HECHO

```typescript
// ANTES ❌
console.error("Checkout error:", error)
return NextResponse.json(
  { error: error.message || "Error creating checkout session" },
  { status: 500 },
)

// AHORA ✅
console.error("Checkout error:", {
  message: error.message,
  code: error.code,
  timestamp: new Date().toISOString(),
})
return NextResponse.json(
  { error: "Failed to create checkout session" },
  { status: 500 },
)
```

---

### ✅ A2: Weak Password Policy - FIXED

**Archivo:** `apps/web/lib/schemas.ts`  
**Cambio:** Línea 5 → 12 caracteres + validación  
**Status:** ✅ HECHO

```typescript
// ANTES ❌
password: z.string().min(6, 'Mínimo 6 caracteres'),

// AHORA ✅
password: z.string()
  .min(12, 'Mínimo 12 caracteres')
  .regex(/[A-Z]/, 'Debe contener mayúsculas')
  .regex(/[0-9]/, 'Debe contener números')
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Debe contener caracteres especiales'),
```

---

## 📋 PENDIENTES (13)

### C2: Logging de Tokens - READY TO APPLY

**Archivo:** `apps/web/app/api/create-checkout-session/route.ts`

**Acción:** Buscar y reemplazar todos los `console.error()` que podrían loguear tokens

```bash
# Buscar en terminal:
grep -rn "console.error\|console.log" apps/web/app/api

# Reemplazar patrón:
# console.error(variable) → console.error(sanitizedData)
```

**Fix:**
```typescript
// ❌ ANTES - Si error contiene token:
console.error("API call failed:", error)

// ✅ DESPUÉS - Sanitizar primero:
const sanitized = {
  message: error.message,
  code: error.code,
  // ❌ NO incluir: token, auth, password, key, secret
}
console.error("API call failed:", sanitized)
```

**Ubicaciones a revisar:**
- [ ] `apps/web/app/api/**/*.ts`
- [ ] `apps/web/lib/**/*.ts`
- [ ] `supabase/functions/**/*.ts`

**Tiempo:** 15 minutos

---

### C3: RLS Policy Validation - READY TO APPLY

**Archivo:** `apps/web/app/cobracheck/page.tsx`

**Acción:** Agregar validación antes de queries sensibles

```typescript
// ❌ ANTES - Confía solo en RLS:
const { data: clientsData } = await supabase
  .from('cobra_clients')
  .select('*')
  .eq('company_id', member.company_id)

// ✅ DESPUÉS - Validación extra:
// 1. Validar que user pertenece a company
const { data: memberCheck, error: memberError } = await supabase
  .from('company_members')
  .select('company_id')
  .eq('user_id', session.user.id)
  .eq('company_id', requestedCompanyId)
  .single()

if (memberError || !memberCheck) {
  throw new Error('Unauthorized: User not in this company')
}

// 2. Ahora sí, hacer la query
const { data: clientsData } = await supabase
  .from('cobra_clients')
  .select('*')
  .eq('company_id', memberCheck.company_id)
```

**Ubicaciones a revisar:**
- [ ] `apps/web/app/cobracheck/page.tsx`
- [ ] `apps/web/app/(dashboard)/**/*.tsx` (todas las queries)

**Tiempo:** 30 minutos

---

### A1: Rate Limiting - READY TO IMPLEMENT

**Archivos:** Todas las API routes

**Opción A: Usar Upstash (Recomendado)**

```bash
# 1. Instalar
npm install @upstash/ratelimit @upstash/redis

# 2. Configurar env vars (.env.local)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

**Código:**
```typescript
// middleware.ts (crear si no existe)
import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 h'),  // 100 req/hora
})

export async function middleware(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { success } = await ratelimit.limit(ip)

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
```

**Opción B: Simple Rate Limiting (Sin infraestructura externa)**

```typescript
// utils/ratelimit.ts
const requestCounts = new Map<string, number[]>()

export function checkRateLimit(identifier: string, maxRequests: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now()
  const windowStart = now - windowMs

  if (!requestCounts.has(identifier)) {
    requestCounts.set(identifier, [])
  }

  const timestamps = requestCounts.get(identifier)!
  const recentRequests = timestamps.filter(ts => ts > windowStart)

  if (recentRequests.length >= maxRequests) {
    return false
  }

  recentRequests.push(now)
  requestCounts.set(identifier, recentRequests)
  return true
}
```

**En API routes:**
```typescript
import { checkRateLimit } from '@/utils/ratelimit'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  
  if (!checkRateLimit(ip, 10, 60000)) {  // 10 req/min
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    )
  }

  // ... resto del código
}
```

**Tiempo:** 30 minutos (Opción A) o 15 minutos (Opción B)

---

### A3: CSRF Protection - READY TO IMPLEMENT

**Middleware:**
```typescript
// middleware.ts
import { v4 as uuidv4 } from 'uuid'

export function middleware(req: NextRequest) {
  const response = NextResponse.next()

  // Generar CSRF token si no existe
  if (!req.cookies.has('csrf-token')) {
    const token = uuidv4()
    response.cookies.set('csrf-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24,  // 24 horas
    })
  }

  // Validar CSRF en POST/PUT/DELETE
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const headerToken = req.headers.get('x-csrf-token')
    const cookieToken = req.cookies.get('csrf-token')?.value

    if (!headerToken || headerToken !== cookieToken) {
      return NextResponse.json(
        { error: 'CSRF token validation failed' },
        { status: 403 }
      )
    }
  }

  return response
}
```

**En cliente (React):**
```typescript
// hooks/useCsrf.ts
import { useEffect, useState } from 'react'

export function useCsrfToken() {
  const [token, setToken] = useState<string>('')

  useEffect(() => {
    const csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrf-token='))
      ?.split('=')[1]

    setToken(csrfToken || '')
  }, [])

  return token
}

// En POST request:
const token = useCsrfToken()

await fetch('/api/create-checkout-session', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': token,
  },
  body: JSON.stringify(data),
})
```

**Tiempo:** 1 hora

---

### A4: Fetch Timeouts - READY TO APPLY

**Patrón genérico:**
```typescript
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 5000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}
```

**Uso:**
```typescript
// ANTES
const response = await fetch(url, { method: 'POST' })

// DESPUÉS
const response = await fetchWithTimeout(url, { method: 'POST' }, 5000)
```

**Ubicaciones:**
- [ ] `apps/web/app/api/create-checkout-session/route.ts:37`
- [ ] Cualquier `fetch()` en API routes

**Tiempo:** 15 minutos

---

### A5: Redirect Validation - READY TO APPLY

**Hook:**
```typescript
// utils/redirect.ts
export function isValidRedirect(url: string | null): boolean {
  if (!url) return false

  try {
    const parsed = new URL(url, window.location.origin)
    // Solo permitir mismo origen
    return parsed.origin === window.location.origin
  } catch {
    return false
  }
}

export function safeRedirect(
  redirect: string | null,
  defaultPath: string = '/hoy'
): string {
  return isValidRedirect(redirect) ? redirect : defaultPath
}
```

**Uso:**
```typescript
// ANTES ❌
if (success) {
  router.push(redirect_url)
}

// DESPUÉS ✅
import { safeRedirect } from '@/utils/redirect'

if (success) {
  router.push(safeRedirect(redirect_url))
}
```

**Tiempo:** 10 minutos

---

### M1-M7: Medium Priority Fixes

**Resumen:**
| Issue | Tiempo | Prioridad |
|-------|--------|-----------|
| M1: Input validation | 10 min | Después |
| M2: HTML sanitization | 20 min | Después |
| M3: Stripe webhook | 15 min | Si existe |
| M4: .env.example | 5 min | Hoy |
| M5: Audit logging | 1 hora | Después |
| M6: Auth rate limit | 30 min | Después |
| M7: CORS config | 10 min | Hoy |

---

## ✅ CHECKLIST DE APLICACIÓN

- [x] C1: Fix error message exposure
- [x] A2: Fix password policy
- [ ] C2: Sanitizar console.error
- [ ] C3: Validar RLS policies
- [ ] A1: Implementar rate limiting
- [ ] A3: Agregar CSRF protection
- [ ] A4: Agregar fetch timeouts
- [ ] A5: Validar redirects
- [ ] M4: .env.example fix
- [ ] M7: CORS config
- [ ] M1-M6: Medium priority (después)

---

## 📊 ESTIMADO

```
YA HECHO:           ██ 2 (30 min ahorrados)
CRÍTICO:            ████ 1 (45 min)
ALTO:               ████████ 2.5 horas
MEDIO:              ██████ 2 horas

TOTAL PENDIENTE:    5-6 horas
```

---

## 🚀 ORDEN RECOMENDADO

1. **HOY (30 min):**
   - C2: Sanitizar logs
   - M4: .env.example
   - M7: CORS config

2. **DESPUÉS (antes de deploy):**
   - C3: RLS validation (30 min)
   - A1: Rate limiting (30 min)
   - A3-A5: Otros altos (1h)

3. **PRODUCCIÓN:**
   - M1-M6: Medium priority

---

**Todos los fixes están listos para copiar y pegar. ¡Sin investigación necesaria!**
