# CHECK SUITE — Setup completo para nueva PC
### Statika Electronics · Guía para Juan o Daniel
*Actualizado: 2026-07-02 · OTA 110 activa*

---

## DATOS CLAVE DEL PROYECTO (referencia rápida)

| Campo | Valor |
|-------|-------|
| GitHub repo | `https://github.com/romerojuan24-maker/gastocheck-app.git` |
| App name | CHECK SUITE |
| Expo slug (GastoCheck) | `gastocheck` |
| Expo slug (CobraCheck) | `cobracheck` |
| Expo owner | `juan.romero` |
| EAS Project ID (GastoCheck mobile) | `11c09583-5e21-46ad-8116-a2e13994570e` |
| EAS Project ID (CobraCheck mobile) | `d722de8e-a8f0-48bc-bcbf-8ca78e8fd9cb` |
| OTA Channel activo | `preview` |
| Supabase Project ID | `omhycwfjxynkfwywzwvz` |
| Supabase URL | `https://omhycwfjxynkfwywzwvz.supabase.co` |
| Bundle ID iOS | `com.gastocheck.app` |
| Package Android | `com.gastocheck.app` |
| Runtime version | `0.1.72` |

---

## 1. INSTALAR HERRAMIENTAS BASE

Abre **PowerShell como Administrador**:

### Node.js LTS (v22 recomendado)
```powershell
winget install OpenJS.NodeJS.LTS
# O descarga desde: https://nodejs.org → botón LTS

node --version   # v22.x o superior
npm --version    # 10.x o superior
```

### Git
```powershell
winget install Git.Git

# Configura tu identidad (usar la que corresponda)
git config --global user.name "Juan"
git config --global user.email "romero.juan24@gmail.com"
# — O para Daniel —
# git config --global user.name "Daniel"
# git config --global user.email "danielbenco1@gmail.com"
```

### pnpm (gestor de paquetes del proyecto — OBLIGATORIO)
```powershell
npm install -g pnpm@11

pnpm --version   # debe mostrar 11.x
```

> ⚠️ Este proyecto usa pnpm workspaces. NO uses `npm install` — no entiende
> los `workspace:*` de pnpm y rompe las dependencias internas.

### EAS CLI (para builds y OTA updates)
```powershell
npm install -g eas-cli

eas --version    # 12.x o superior
```

### Supabase CLI (para desplegar edge functions)
```powershell
npm install -g supabase

supabase --version
```

### VS Code (opcional pero recomendado)
```powershell
winget install Microsoft.VisualStudioCode
```

Extensiones útiles: `Prisma.prisma`, `bradlc.vscode-tailwindcss`,
`esbenp.prettier-vscode`, `ms-vscode.vscode-typescript-next`

---

## 2. CLONAR EL REPOSITORIO

```powershell
cd C:\Users\TU_USUARIO\Documents

git clone https://github.com/romerojuan24-maker/gastocheck-app.git

cd gastocheck-app
```

### Autenticar GitHub (primera vez)
```powershell
# Opción A — GitHub CLI (recomendado)
winget install GitHub.cli
gh auth login
# Selecciona: GitHub.com → HTTPS → Login with browser

# Opción B — Token personal
# https://github.com/settings/tokens → New classic token → scope: repo
# Úsalo como contraseña cuando Git lo pida
```

---

## 3. INSTALAR DEPENDENCIAS

```powershell
cd C:\Users\TU_USUARIO\Documents\gastocheck-app

pnpm install
```

> Instala todo el monorepo: web + mobile + cobra-web + cobra-mobile + packages/shared.
> Primera vez: ~3-5 minutos.

---

## 4. VARIABLES DE ENTORNO

### Web — `apps/web/.env.local`

```powershell
New-Item apps\web\.env.local -ItemType File -Force
```

Contenido exacto:
```env
NEXT_PUBLIC_SUPABASE_URL=https://omhycwfjxynkfwywzwvz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9taHljd2ZqeHlua2Z3eXd6d3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NzY0MjMsImV4cCI6MjA5NjM1MjQyM30.J9cmcQPAyuW7S9R7_3UDevYKAvLThSI6JWgHIl3Yj14
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9taHljd2ZqeHlua2Z3eXd6d3Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc3NjQyMywiZXhwIjoyMDk2MzUyNDIzfQ.mTSMLWCIOU_d8UNDNL8Dv40oJFUv8x9p3ceUQQbdvSU
```

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` es secreta — nunca subirla a GitHub.

### Mobile — `apps/mobile/.env.local`

```powershell
New-Item apps\mobile\.env.local -ItemType File -Force
```

Contenido:
```env
EXPO_PUBLIC_SUPABASE_URL=https://omhycwfjxynkfwywzwvz.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_sSlEbsfs4842PDD8H050uQ_dhLbljxA
```

---

## 5. SECRETOS EN SUPABASE (Edge Functions)

Los siguientes secrets deben estar configurados en:
**Supabase Dashboard → proyecto `omhycwfjxynkfwywzwvz` → Settings → Edge Functions**

| Secret | Para qué sirve | Dónde obtenerlo |
|--------|----------------|-----------------|
| `GEMINI_API_KEY` | OCR de tickets con Gemini 2.5 Flash | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `STRIPE_SECRET_KEY` | Pagos y suscripciones | Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | Webhook de Stripe | Stripe → Webhooks |
| `WHATSAPP_TOKEN` | Notificaciones WhatsApp | Meta for Developers |

> Si `GEMINI_API_KEY` no está configurado, el OCR de comprobantes falla
> silenciosamente — los receipts se guardan sin datos extraídos.

---

## 6. AUTENTICAR EXPO / EAS

```powershell
# Login con la cuenta de Expo
eas login
# Usuario: romero.juan24@gmail.com (cuenta principal juan.romero)

# Verificar
eas whoami
# Debe mostrar: juan.romero
```

---

## 7. VERIFICAR QUE TODO FUNCIONA

### Test 1 — Web (Next.js en puerto 3000)
```powershell
cd C:\Users\TU_USUARIO\Documents\gastocheck-app
pnpm run web
```
Abre http://localhost:3000 — debe mostrar pantalla de login.

Credenciales de prueba: `danielbenco1@gmail.com` / `CheckSuite2026!`

### Test 2 — Mobile (Expo)
```powershell
cd C:\Users\TU_USUARIO\Documents\gastocheck-app\apps\mobile
npx expo start --channel preview
```
Escanea el QR con Expo Go, o presiona `a` para Android emulador.

### Test 3 — TypeScript sin errores
```powershell
cd C:\Users\TU_USUARIO\Documents\gastocheck-app
pnpm run typecheck
```

---

## 8. ESTRUCTURA DEL MONOREPO

```
gastocheck-app/
│
├── apps/
│   ├── web/                    ← Next.js 15 + TailwindCSS (panel admin web)
│   │   ├── app/(dashboard)/    ← Rutas protegidas post-login
│   │   │   ├── gastocheck/     ← Comprobantes, pólizas, reembolsos
│   │   │   ├── cobracheck/     ← Rutas de cobranza
│   │   │   ├── bancocheck/     ← Conciliación bancaria
│   │   │   ├── flujocheck/     ← Flujo de efectivo
│   │   │   ├── facturacheck/   ← Timbrado CFDI
│   │   │   └── inventariocheck/← Inventario
│   │   ├── lib/
│   │   │   ├── supabase.ts     ← Cliente Supabase
│   │   │   └── permissions.ts  ← ⭐ MATRIZ DE PERMISOS (editar solo aquí)
│   │   └── hooks/
│   │       └── usePermissions.ts ← canI(resource, action)
│   │
│   ├── mobile/                 ← Expo 54 + React Native 0.81.5
│   │   ├── app/                ← Rutas Expo Router
│   │   │   ├── capture.tsx     ← Captura de comprobantes con OCR
│   │   │   ├── receipts.tsx    ← Lista de comprobantes
│   │   │   ├── mis-reembolsos.tsx ← Reembolsos del comprador
│   │   │   ├── reembolso.tsx   ← Detalle de un reembolso
│   │   │   ├── polizas.tsx     ← Pólizas del contador
│   │   │   └── viaticos.tsx    ← Viáticos
│   │   ├── hooks/
│   │   │   └── useOcr.ts       ← OCR con Gemini via Edge Function
│   │   ├── app.json            ← Config Expo (bundle ID, versión, EAS project)
│   │   └── eas.json            ← Profiles de build EAS
│   │
│   ├── cobra-mobile/           ← CobraCheck mobile (rutas de cobranza)
│   └── cobra-web/              ← CobraCheck web
│
├── packages/
│   └── shared/
│       └── src/
│           └── index.ts        ← ⭐ APP_VERSION aquí — bumpar con cada OTA
│
├── supabase/
│   ├── functions/              ← Edge Functions Deno (deploy con supabase CLI)
│   │   ├── ocr-extract/        ← OCR con Gemini 2.5 Flash
│   │   ├── validate-cfdi/      ← Validación SAT en tiempo real
│   │   ├── submit-receipt/     ← Guardar comprobante completo
│   │   └── check-duplicate/    ← Anti-duplicados
│   └── migrations/             ← SQL — aplicar en Supabase Dashboard SQL Editor
│
├── DAILY_LOG.md                ← ⭐ LOG DIARIO — leer siempre al iniciar
├── SETUP_NUEVA_PC.md           ← Este archivo
└── pnpm-workspace.yaml         ← Config monorepo pnpm
```

---

## 9. FLUJO DE TRABAJO DIARIO

### Al iniciar sesión de trabajo:

```powershell
cd C:\Users\TU_USUARIO\Documents\gastocheck-app

# 1. Sincronizar con el repo
git fetch origin
git pull origin main

# 2. Ver últimos cambios
git log --oneline -10

# 3. Leer DAILY_LOG.md — buscar [PENDIENTE JUAN], [PENDIENTE DANIEL], [BLOCKER]
```

Luego abre Claude Code en este directorio y pega el prompt de la sección 11.

### Al terminar sesión de trabajo:

```powershell
# Claude actualiza DAILY_LOG.md automáticamente — solo confirmar y subir:
git add .
git commit -m "[SYNC] Actualizar DAILY_LOG — sesión Juan/Daniel"
git push origin main
```

---

## 10. COMANDOS DE REFERENCIA RÁPIDA

| Acción | Comando | Desde |
|--------|---------|-------|
| Levantar web | `pnpm run web` | raíz del repo |
| Levantar mobile | `npx expo start` | `apps/mobile/` |
| TypeCheck | `pnpm run typecheck` | raíz del repo |
| OTA Update | `npx eas update --channel preview --message "..."` | `apps/mobile/` |
| Build APK preview | `npx eas build --platform android --profile preview` | `apps/mobile/` |
| Deploy Edge Function | `npx supabase functions deploy <nombre>` | raíz del repo |
| Ver builds EAS | `eas build:list` | cualquier directorio |
| Git sync | `git pull origin main` | raíz del repo |
| Ver estado | `git status` | raíz del repo |

---

## 11. PROMPT PARA CLAUDE (copiar al inicio de cada sesión)

```
Proyecto: CHECK SUITE — GastoCheck + CobraCheck
Ruta local: C:\Users\TU_USUARIO\Documents\gastocheck-app
Repo: https://github.com/romerojuan24-maker/gastocheck-app

## Stack técnico:
- Web: Next.js 15 + TailwindCSS + Supabase
- Mobile: Expo 54 + React Native 0.81 + Expo Router
- DB: Supabase PostgreSQL con RLS (proyecto: omhycwfjxynkfwywzwvz)
- Monorepo: pnpm workspaces (apps/web · apps/mobile · packages/shared)
- OTA Channel: preview (Expo EAS, cuenta: juan.romero)
- OCR: Edge Function ocr-extract → Gemini 2.5 Flash
- Versión actual: OTA 110 · v1.1.10

## Roles en el sistema:
owner > admin > accountant > contador_general > supervisor > spender/comprador

## Flujo de trabajo mobile — GastoCheck:
- Comprobante: capture.tsx → OCR async (Gemini) → receipts.tsx
- Reembolso: mis-reembolsos.tsx → reembolso.tsx → cerrar → polizas.tsx (contador)
- Viáticos: viaticos.tsx

## Al iniciar cada sesión:
1. git pull origin main
2. git log --oneline -5
3. Lee DAILY_LOG.md → muéstrame los [PENDIENTE] y [BLOCKER]

## Al terminar cada sesión:
1. Actualiza DAILY_LOG.md con lo completado, pendientes y decisiones
2. git add . && git commit -m "[SYNC] descripción" && git push origin main
```

---

## 12. MIGRACIONES SQL PENDIENTES

Las migraciones SQL NO se aplican automáticamente.
Cada vez que haya un archivo nuevo en `supabase/migrations/`,
hay que ejecutarlo manualmente en:

**Supabase Dashboard → proyecto → SQL Editor → New query → pegar el contenido → Run**

Archivos pendientes de aplicar (verificar con Juan):
- `20260630_viaticos_trip_columns.sql` — columnas destino/propósito en viáticos
- `20260630_fix_reembolsos_receipts_columns.sql` — columnas name/linked_policy en reembolsos

---

## 13. SOLUCIÓN A PROBLEMAS COMUNES

| Error | Solución |
|-------|----------|
| `Cannot find module '@gastocheck/shared'` | `pnpm install` desde la raíz |
| `NEXT_PUBLIC_SUPABASE_URL is not defined` | Crear `apps/web/.env.local` (sección 4) |
| `eas: command not found` | `npm install -g eas-cli` |
| `supabase: command not found` | `npm install -g supabase` |
| OCR no extrae datos del comprobante | Verificar `GEMINI_API_KEY` en Supabase Secrets |
| Port 3000 in use | `netstat -ano | findstr :3000` → `taskkill /PID X /F` |
| TypeScript errors en VS Code | `Ctrl+Shift+P` → TypeScript: Restart TS Server |
| Push rechazado | `git pull origin main` primero, luego push |
| OTA no llega al dispositivo | Cerrar y reabrir la app completamente |
| `workspace:*` not found | Estás usando `npm install` — usa `pnpm install` |

---

## 14. ACCESOS QUE JUAN DEBE DARTE (colaboradores)

- [ ] **GitHub**: Agregar como colaborador en `romerojuan24-maker/gastocheck-app`
- [ ] **Expo.dev**: Invitar a la organización `juan.romero`
- [ ] **Supabase**: Invitar al proyecto `omhycwfjxynkfwywzwvz`
- [ ] **Service Role Key**: Compartir el valor de `SUPABASE_SERVICE_ROLE_KEY` (sección 4)

---

*Actualizado: 2026-07-02 · OTA 110 · Statika Electronics*
*Si algo no funciona, escribe [BLOCKER] en DAILY_LOG.md y avísale a Juan.*
