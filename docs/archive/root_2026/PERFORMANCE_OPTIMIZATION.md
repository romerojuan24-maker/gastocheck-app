# ⚡ PERFORMANCE OPTIMIZATION GUIDE

**Fecha:** 2026-06-19  
**Target:** Lighthouse 80+ | Load time < 2s | Bundle < 500KB gzip

---

## 🎯 CURRENT STATE

```
Build size (estimated):
├─ Next.js:         ~100KB gzip
├─ React:           ~42KB gzip
├─ Dependencies:    ~200KB gzip
├─ App code:        ~50KB gzip
└─ TOTAL:          ~400KB gzip ✅

Load time (estimated):
├─ Initial HTML:    200ms
├─ JS execution:    400ms
├─ Hydration:       300ms
├─ API calls:       500ms
└─ TOTAL:          ~1.4s ✅

Lighthouse scores (estimated):
├─ Performance:     75-80
├─ Accessibility:   85-90
├─ Best Practices:  90-95
└─ SEO:             90-95
```

---

## 🚀 OPTIMIZACIONES RÁPIDAS (< 1 hora)

### O1: Code Splitting

**Problema:** Todo el código se carga upfront

**Solución:**
```typescript
// ✅ Dynamic imports para lazy loading
import dynamic from 'next/dynamic'

const AdvisorPanel = dynamic(() => import('./AdvisorPanel'), {
  loading: () => <div>Cargando...</div>,
  ssr: false,  // No renderizar en servidor
})

const CobraClientForm = dynamic(() => import('./CobraClientForm'), {
  loading: () => <Skeleton />,
})

export default function Dashboard() {
  return (
    <>
      <AdvisorPanel />  {/* Cargado en bg */}
      <CobraClientForm />  {/* Cargado en bg */}
    </>
  )
}
```

**Impacto:** -50-100KB del bundle inicial  
**Tiempo:** 20 minutos

---

### O2: Image Optimization

**Problema:** Imágenes grandes sin optimizar

**Solución:**
```typescript
// ❌ ANTES
<img src="/logo.png" alt="Logo" />

// ✅ DESPUÉS
import Image from 'next/image'

<Image
  src="/logo.png"
  alt="Logo"
  width={200}
  height={200}
  placeholder="blur"
  blurDataURL="data:image/..."
  quality={75}
/>
```

**Impacto:** -30% tamaño de imágenes  
**Tiempo:** 15 minutos

---

### O3: Remove Unused CSS

**Problema:** Tailwind sin purge

**Solución:**
```javascript
// tailwind.config.js
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    // ...
  },
}
```

**Impacto:** Automático con Tailwind v3  
**Tiempo:** 5 minutos

---

### O4: Bundle Analysis

**Herramienta:**
```bash
npm install --save-dev @next/bundle-analyzer

# next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer({
  // ... config
})

# Uso
ANALYZE=true npm run build
# Abre .next/server/chunks/ para ver qué ocupa espacio
```

**Impacto:** Identifica problemas  
**Tiempo:** 10 minutos

---

## 📊 OPTIMIZACIONES MEDIANAS (1-2 horas)

### O5: Database Query Optimization

**Identificar N+1 queries:**
```typescript
// ❌ N+1 problem
const clients = await supabase
  .from('cobra_clients')
  .select('*')
  .eq('company_id', companyId)

for (const client of clients) {
  const invoices = await supabase  // ❌ Query por cada cliente
    .from('cobra_invoices')
    .select('*')
    .eq('client_id', client.id)
}

// ✅ SOLUCIÓN: Usar joins
const clients = await supabase
  .from('cobra_clients')
  .select('*, invoices:cobra_invoices(*)')  // Join automático
  .eq('company_id', companyId)
```

**Impacto:** -80% queries de database  
**Tiempo:** 30 minutos

---

### O6: Caching Strategy

**Implementar:**
```typescript
// utils/cache.ts
const cache = new Map<string, { data: any; expiry: number }>()

export function setCacheEntry(key: string, data: any, ttl: number = 60000) {
  cache.set(key, { data, expiry: Date.now() + ttl })
}

export function getCacheEntry(key: string) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiry) {
    cache.delete(key)
    return null
  }
  return entry.data
}
```

**Uso:**
```typescript
export async function getClients(companyId: string) {
  const cached = getCacheEntry(`clients_${companyId}`)
  if (cached) return cached

  const data = await supabase
    .from('cobra_clients')
    .select('*')
    .eq('company_id', companyId)

  setCacheEntry(`clients_${companyId}`, data, 5 * 60 * 1000)  // 5 min TTL
  return data
}
```

**Impacto:** -40% API calls  
**Tiempo:** 1 hora

---

### O7: Client-side Rendering Optimization

**React.memo para componentes costosos:**
```typescript
// ❌ Re-renders innecesarios
export function ClientCard({ client }) {
  return <div>{client.name}</div>
}

// ✅ Memoized
export const ClientCard = React.memo(function ClientCard({ client }) {
  return <div>{client.name}</div>
}, (prev, next) => prev.client.id === next.client.id)
```

**Impacto:** -30% re-renders  
**Tiempo:** 30 minutos

---

## 🔍 MEDICIÓN

### Lighthouse Audit
```bash
npm install -g lighthouse

lighthouse https://tu-app.vercel.app \
  --view \
  --output-path=./lighthouse-report.html
```

### Performance Budget
```json
// performance-budget.json
[
  {
    "type": "bundle",
    "name": "main",
    "size": "400kb"
  },
  {
    "type": "element",
    "name": "script[src*='main']",
    "size": "100kb"
  }
]
```

---

## ✅ CHECKLIST

- [ ] O1: Code splitting (20 min)
- [ ] O2: Image optimization (15 min)
- [ ] O3: CSS purging (5 min)
- [ ] O4: Bundle analysis (10 min)
- [ ] O5: Database optimization (30 min)
- [ ] O6: Caching strategy (1 hour)
- [ ] O7: React.memo (30 min)

**Total:** ~2.5 horas (pero cosas fáciles primero)

---

## 🎯 TARGETS POR MÉTRICA

```
Metric                  Actual      Target    Priority
─────────────────────────────────────────────────
First Contentful Paint   ~1.2s      <1s       🟠 Alto
Largest Contentful Paint ~1.8s      <2.5s     🟢 OK
Cumulative Layout Shift  <0.1       <0.1      🟢 OK
Time to Interactive      ~1.4s      <3.5s     🟢 OK
Total Blocking Time      ~200ms     <300ms    🟡 Medio
```

---

**Próximo:** Implementar O1-O4 hoy, O5-O7 antes de producción
