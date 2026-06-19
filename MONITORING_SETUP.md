# 📊 MONITORING & LOGGING SETUP

**Fecha:** 2026-06-19  
**Objetivo:** Detección de errores + performance monitoring

---

## 🎯 STACK RECOMENDADO

```
ERRORS:        Sentry
LOGS:          Vercel Logs / Supabase Logs
METRICS:       Vercel Analytics
UPTIME:        Uptime Robot (free)
DASHBOARDS:    Grafana (libre/cloud)
```

---

## 🔴 SENTRY (Error Tracking)

### Setup

```bash
npm install @sentry/nextjs
```

**next.config.js:**
```javascript
const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(
  {
    // nextjs config...
  },
  {
    org: "tu-org",
    project: "check-suite",
    authToken: process.env.SENTRY_AUTH_TOKEN,
  }
);
```

**sentry.client.config.js:**
```javascript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: [
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  tracesSampleRate: 0.1,  // 10% sampling
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,  // Grabar todos los errores
  environment: process.env.NODE_ENV,
});
```

**Uso:**
```typescript
import * as Sentry from "@sentry/nextjs";

try {
  // código
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      component: "CheckoutForm",
      action: "stripe_payment",
    },
    extra: {
      userId: user.id,
      amount: totalAmount,
    },
  });
}
```

---

## 📝 STRUCTURED LOGGING

**utils/logger.ts:**
```typescript
interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
  userId?: string;
  component?: string;
  metadata?: Record<string, any>;
}

export async function log(entry: LogEntry) {
  const message = {
    ...entry,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  };

  // En desarrollo: console
  if (process.env.NODE_ENV === 'development') {
    console[entry.level](JSON.stringify(message, null, 2));
  } else {
    // En producción: Sentry + Vercel
    if (entry.level === 'error') {
      Sentry.captureMessage(entry.message, 'error');
    }
  }

  // Guardar en Supabase (optional)
  await supabase.from('logs').insert(message);
}

// Uso
await log({
  level: 'info',
  message: 'Invoice created',
  component: 'CobraCheck',
  context: { invoiceId, clientId },
  userId: session.user.id,
});
```

---

## 📈 ALERTS

**Alerts a configurar en Sentry:**

```
1. Error rate > 1% en últimas 24h
2. Crash rate > 0.5%
3. Performance: P95 latency > 3s
4. Database: Slow queries > 1s
5. API: 5xx errors
```

**Notificación:** Email + Slack

---

## 🔍 PERFORMANCE MONITORING

**Vercel Analytics (integrado):**

```typescript
// Automático con Next.js App Router
// Mide: LCP, FID, CLS, etc.

// Manual:
import { reportWebVitals } from 'next/vitals'

export function reportWebVitals(metric: any) {
  console.log(metric);  // {name, value, rating, delta, id, navigationType, attribution}
}
```

---

## 📱 HEALTH CHECKS

**Crear endpoint /api/health:**

```typescript
// app/api/health/route.ts
export async function GET(req: NextRequest) {
  try {
    // Verificar DB
    const { count } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });

    // Verificar servicios externos (Stripe, etc)
    const stripeOk = !!process.env.STRIPE_SECRET_KEY;

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: count !== null ? 'ok' : 'error',
      stripe: stripeOk ? 'ok' : 'error',
      uptime: process.uptime(),
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: error.message },
      { status: 503 }
    );
  }
}
```

---

## ⏱️ UPTIME MONITORING

**Uptime Robot (Free):**
1. Ir a uptimerobot.com
2. Click "Monitor New URL"
3. URL: https://tu-app/api/health
4. Interval: 5 min
5. Alert: Email
6. Set notifications

---

## 📊 DASHBOARD (Grafana Cloud)

**Crear en https://grafana.cloud:**

```
Paneles:
├─ Error Rate (última hora)
├─ API Latency (P50, P95, P99)
├─ Database Query Time
├─ Active Users (concurrent)
├─ Stripe Payments (últimas 24h)
└─ Uptime %
```

---

## 📋 CHECKLIST

- [ ] Setup Sentry (20 min)
- [ ] Integrar logger (15 min)
- [ ] Configurar alerts (10 min)
- [ ] Health check endpoint (10 min)
- [ ] Uptime Robot (5 min)
- [ ] Grafana Cloud (15 min)

**Total:** ~1.5 horas

---

**Monitoring ready para producción**
