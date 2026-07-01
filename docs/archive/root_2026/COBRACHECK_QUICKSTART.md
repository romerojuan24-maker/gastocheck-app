# CobraCheck — Quick Start

## Prerequisites

- Node 18+: `node --version`
- pnpm: `npm i -g pnpm`
- Same Supabase project as GastoCheck (DB migrations already executed)

## Setup (2 minutes)

### 1. Install dependencies

```bash
cd apps/cobra-mobile && pnpm install
cd ../cobra-web && pnpm install
```

### 2. Environment variables

**Already configured** in `.env.local` (using GastoCheck Supabase):
- `apps/cobra-mobile/.env.local` ✓
- `apps/cobra-web/.env.local` ✓

If you need to update them:
```bash
# Copy from GastoCheck
cp apps/mobile/.env.local apps/cobra-mobile/.env.local  # adjust if needed
```

### 3. Run both apps

**Terminal 1 — Mobile (Expo)**
```bash
cd apps/cobra-mobile
pnpm start

# In Expo CLI, press:
# 'w' for web preview (quickest)
# 'a' for Android emulator
# 'i' for iOS simulator
```

**Terminal 2 — Web (Next.js)**
```bash
cd apps/cobra-web
pnpm dev

# Open: http://localhost:3001
```

## Demo Login

**Mobile (Cobrador in field):**
- Email: `cobrador@test.com`
- Password: `Test1234!`

**Web (Admin dashboard):**
- Email: `admin@test.com`
- Password: `Test1234!`

## What You'll See

### Mobile App
- **Login screen** with OTA version badge (top-right)
- **4 tab navigation**: Clientes, Mi Ruta, Pagos, Historial
- **Clientes tab**: List ordered by risk score
  - Click client → see their invoices
- **Pagos tab**: Register payment with method (cash, transfer, check, card)
- **Historial tab**: Activity timeline
- **Ruta tab**: Today's route summary

### Web Dashboard
- **Dashboard**: 4 KPI cards (total cartera, vencida, esperado mes, pagado)
- **Reportes**: 
  - Cartera por antigüedad (0-30, 30-60, 60-90, 90+ days)
  - Tasa de pago (% collected)
- **Campañas**: WhatsApp campaign creator + responses
- **Cobradores**: Collector ranking with daily/monthly stats
- **Clientes**: Searchable client list with filters

## Database

All data comes from shared GastoCheck Supabase:
- Tables: `cobra_clients`, `cobra_invoices`, `cobra_payments`, etc.
- Views: `cobra_dashboard_summary`, `cobra_cobrador_stats`, `cobra_aging_view`
- Auth: JWT via `getSession()` (offline-compatible)

## Troubleshooting

### Expo won't start
```bash
cd apps/cobra-mobile
pnpm start -c  # clear cache
```

### Next.js port conflict
```bash
cd apps/cobra-web
pnpm dev -- -p 3002  # use different port
```

### Login fails
- Check `.env.local` has correct Supabase URL + key
- Ensure user exists in GastoCheck's `auth.users`
- User must have `company_members` entry with role "cobrador" or "admin"

### No data appears
- Migrate test data into `cobra_clients` table
- Or manually create via Supabase dashboard

## Next Steps

1. **Test flows**:
   - Login on mobile → see clients
   - Register payment → check it appears on web dashboard
   - Create campaign → send test WhatsApp

2. **Load test data** (from GastoCheck or manually):
   - Insert companies
   - Create users with `cobrador`/`admin` role
   - Populate `cobra_clients`, `cobra_invoices`

3. **Deploy** (when ready):
   - Mobile: `eas build` (Expo Application Services)
   - Web: `vercel deploy` (Vercel)

---

**Status**: MVP ready for UAT with live data
**Last updated**: 2026-06-18
