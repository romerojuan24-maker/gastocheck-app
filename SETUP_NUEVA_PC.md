# CHECK SUITE — Setup completo para nueva PC
### Statika Electronics · Guía de incorporación Daniel

> **Antes de empezar:** Juan debe darte acceso a:
> - ✅ GitHub repo: `romerojuan24-maker/gastocheck-app`
> - ✅ Expo.dev account: organización `juan.romero` (proyecto `gastocheck`)
> - ✅ Supabase: proyecto `omhycwfjxynkfwywzwvz` (solo lectura o colaborador)

---

## 1. INSTALAR HERRAMIENTAS BASE

Abre **PowerShell como Administrador** y ejecuta en orden:

### Node.js (versión LTS actual — mínimo v18)
```powershell
# Descarga e instala desde:
# https://nodejs.org/en/download  → LTS (botón verde)
# O instala con winget:
winget install OpenJS.NodeJS.LTS
```

Verifica:
```powershell
node --version    # debe mostrar v18.x o superior
npm --version     # debe mostrar 9.x o superior
```

### Git
```powershell
winget install Git.Git
```

Configura tu identidad:
```powershell
git config --global user.name "Daniel"
git config --global user.email "danielbenco1@gmail.com"
```

### EAS CLI (Expo Application Services)
```powershell
npm install -g eas-cli
```

Verifica:
```powershell
eas --version    # debe mostrar 12.x o superior
```

### Visual Studio Code (opcional pero recomendado)
```powershell
winget install Microsoft.VisualStudioCode
```

Extensiones recomendadas (instalar desde VS Code):
- `Prisma.prisma` → TypeScript
- `bradlc.vscode-tailwindcss` → Tailwind CSS
- `esbenp.prettier-vscode` → Prettier
- `ms-vscode.vscode-typescript-next` → TypeScript mejorado

---

## 2. CLONAR EL REPOSITORIO

```powershell
# Navega a tu carpeta de proyectos
cd C:\Users\TU_USUARIO\Documents

# Clona el repo (necesitas acceso de Juan a GitHub primero)
git clone https://github.com/romerojuan24-maker/gastocheck-app.git

# Entra al proyecto
cd gastocheck-app
```

### Autenticar GitHub (solo primera vez)
Si Git pide credenciales al hacer pull/push:
```powershell
# Opción A — GitHub CLI (recomendado)
winget install GitHub.cli
gh auth login
# Selecciona: GitHub.com → HTTPS → Login with browser

# Opción B — Token personal
# Ve a https://github.com/settings/tokens → New token
# Scope: repo (completo)
# Úsalo como contraseña cuando Git lo pida
```

---

## 3. INSTALAR DEPENDENCIAS DEL PROYECTO

```powershell
cd C:\Users\TU_USUARIO\Documents\gastocheck-app

# Instala TODO (monorepo: web + mobile + packages)
npm install
```

> ⚠️ Este comando instala simultáneamente:
> - Next.js 15 (web)
> - Expo 54 + React Native 0.81 (mobile)
> - packages/shared (tipos compartidos)
>
> Puede tardar 2-5 minutos la primera vez.

---

## 4. CONFIGURAR VARIABLES DE ENTORNO

### Web (`apps/web/.env.local`)

Crea el archivo:
```powershell
cd C:\Users\TU_USUARIO\Documents\gastocheck-app\apps\web
New-Item -Name ".env.local" -ItemType File
```

Pega este contenido exacto (pide los valores a Juan si no los tienes):
```env
NEXT_PUBLIC_SUPABASE_URL=https://omhycwfjxynkfwywzwvz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_sSlEbsfs4842PDD8H050uQ_dhLbljxA
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ⚠️ Esta clave es secreta — pídela a Juan, NUNCA la subas a GitHub
SUPABASE_SERVICE_ROLE_KEY=<PEDIR_A_JUAN>
```

### Mobile (`apps/mobile/.env`)

```powershell
cd C:\Users\TU_USUARIO\Documents\gastocheck-app\apps\mobile
New-Item -Name ".env" -ItemType File
```

Contenido:
```env
EXPO_PUBLIC_SUPABASE_URL=https://omhycwfjxynkfwywzwvz.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_sSlEbsfs4842PDD8H050uQ_dhLbljxA
```

---

## 5. AUTENTICAR EXPO / EAS

```powershell
# Login con la cuenta que Juan te dio acceso
eas login
# Usuario: danielbenco1@gmail.com (o la cuenta que Juan habilitó)
# Contraseña: la de expo.dev

# Verifica que estás en la organización correcta
eas whoami
# Debe mostrar: juan.romero (como colaborador)
```

---

## 6. VERIFICAR QUE TODO FUNCIONA

### Test 1 — Web (Next.js)
```powershell
cd C:\Users\TU_USUARIO\Documents\gastocheck-app
npm run web
```
Abre http://localhost:3000 en el navegador.
Debe cargar la pantalla de login de CHECK SUITE.

### Test 2 — Mobile (Expo)
```powershell
# En otra terminal
cd C:\Users\TU_USUARIO\Documents\gastocheck-app
npm run mobile
```
Escanea el QR con Expo Go en tu teléfono, o presiona `a` para Android.

### Test 3 — TypeCheck (sin errores de TypeScript)
```powershell
cd C:\Users\TU_USUARIO\Documents\gastocheck-app
npm run typecheck
```
Debe terminar sin errores rojos.

---

## 7. FLUJO DE TRABAJO DIARIO

### Al iniciar sesión de trabajo:

```powershell
cd C:\Users\TU_USUARIO\Documents\gastocheck-app

# 1. Sincronizar con GitHub
git fetch origin
git pull origin main

# 2. Ver cambios recientes
git log --oneline -10

# 3. Leer pendientes
# Abre DAILY_LOG.md y busca: [PENDIENTE DANIEL]
```

Luego abre Claude y pégale el prompt de la sección 9.

### Al terminar sesión de trabajo:

```powershell
# Después de que Claude actualice DAILY_LOG.md:
git add DAILY_LOG.md
git commit -m "[SYNC] Actualización memoria - Daniel"
git push origin main

# Si hiciste cambios en código, también:
git add -A
git commit -m "feat/fix: descripción del cambio"
git push origin main
```

---

## 8. ESTRUCTURA DEL PROYECTO

```
gastocheck-app/
│
├── apps/
│   ├── web/                    ← Next.js 15 (panel web admin)
│   │   ├── app/(dashboard)/    ← Rutas protegidas (login requerido)
│   │   │   ├── gastocheck/     ← Módulo GastoCheck
│   │   │   ├── cobracheck/     ← Módulo CobraCheck
│   │   │   ├── bancocheck/     ← Módulo BancoCheck
│   │   │   ├── flujocheck/     ← Módulo FlujoCheck
│   │   │   ├── facturacheck/   ← Módulo FacturaCheck
│   │   │   └── inventariocheck/← Módulo InventarioCheck
│   │   ├── components/
│   │   │   └── Sidebar.tsx     ← Navegación principal (filtro por rol)
│   │   ├── lib/
│   │   │   ├── supabase.ts     ← Cliente Supabase + tipos
│   │   │   └── permissions.ts  ← ⭐ MATRIZ DE PERMISOS (editar aquí)
│   │   └── hooks/
│   │       └── usePermissions.ts ← Hook canI(resource, action)
│   │
│   ├── mobile/                 ← Expo 54 + React Native 0.81
│   │   ├── app/                ← Rutas Expo Router
│   │   │   ├── index.tsx       ← Home (tarjetas de módulos)
│   │   │   ├── gastocheck/     ← GastoCheck mobile
│   │   │   └── cobracheck/     ← CobraCheck mobile
│   │   ├── app.json            ← Config Expo (bundle ID, versión)
│   │   └── eas.json            ← Config builds EAS
│   │
│   ├── cobra-web/              ← CobraCheck web (independiente)
│   └── cobra-mobile/           ← CobraCheck mobile (independiente)
│
├── packages/
│   └── shared/                 ← Tipos y constantes compartidos
│       └── src/
│           ├── brand.ts        ← Colores, constantes de marca
│           └── index.ts        ← Exportaciones
│
├── supabase/
│   └── migrations/             ← Migraciones SQL (aplicar en Supabase Dashboard)
│
├── DAILY_LOG.md                ← ⭐ LOG DIARIO — leer al inicio de cada sesión
└── SETUP_NUEVA_PC.md           ← Este archivo
```

---

## 9. PROMPT PARA CLAUDE (copiar al inicio de cada sesión)

```
# CHECK SUITE — Sesión de trabajo (Daniel)

Proyecto: CHECK SUITE — GastoCheck + CobraCheck
Ruta: C:\Users\TU_USUARIO\Documents\gastocheck-app
Repo: https://github.com/romerojuan24-maker/gastocheck-app

## Al iniciar:
1. git fetch origin && git pull origin main
2. git log --oneline -10 → menciona cambios recientes
3. Lee DAILY_LOG.md → busca [PENDIENTE DANIEL] y [BLOCKER]
4. Mensaje inicial: "Sincronizado. Pendientes: [lista]."

## Stack técnico:
- Web: Next.js 15 + TailwindCSS + TypeScript
- Mobile: Expo 54 + React Native 0.81
- DB: Supabase PostgreSQL con RLS
- Monorepo: apps/web · apps/mobile · packages/shared
- Permisos: apps/web/lib/permissions.ts → editar SOLO aquí
- Hook permisos: canI(resource, action) desde usePermissions
- Roles: owner · admin · accountant · supervisor · buyer · collector · viewer
- Restricción temporal dev: solo danielbenco1@gmail.com ve todos los módulos

## Comandos útiles:
- npm run web          → Next.js en http://localhost:3000
- npm run mobile       → Expo en http://localhost:8081
- npm run typecheck    → Verificar TypeScript
- eas build --platform android --profile preview → Build APK

## Al terminar sesión:
Actualiza DAILY_LOG.md con:
- ✅ Completado
- [PENDIENTE JUAN] decisiones que necesita Juan
- [DECIDIDO] decisiones tomadas
- 🎯 Próximos pasos

Luego:
git add DAILY_LOG.md
git commit -m "[SYNC] Actualización memoria - Daniel"
git push origin main

## Mi rol:
Soy Daniel (implementador). Implemento specs de Juan.
Juan diseña arquitectura y flujos, yo implemento la forma (UI, mobile + web).
Módulos COMPLETOS — no divididos por plataforma.
```

---

## 10. COMANDOS DE REFERENCIA RÁPIDA

| Acción | Comando |
|--------|---------|
| Iniciar web | `npm run web` |
| Iniciar mobile | `npm run mobile` |
| Verificar tipos | `npm run typecheck` |
| Ver estado git | `git status` |
| Ver últimos commits | `git log --oneline -15` |
| Sincronizar repo | `git pull origin main` |
| Build APK preview | `eas build --platform android --profile preview` (desde apps/mobile) |
| OTA update | `eas update --channel preview --message "descripción"` (desde apps/mobile) |
| Ver builds EAS | `eas build:list` |

---

## 11. SOLUCIÓN A PROBLEMAS COMUNES

### Error: `NEXT_PUBLIC_SUPABASE_URL is not defined`
→ Falta el archivo `apps/web/.env.local`. Ver sección 4.

### Error: `Cannot find module '@gastocheck/shared'`
```powershell
cd C:\Users\TU_USUARIO\Documents\gastocheck-app
npm install
```

### Error: `eas: command not found`
```powershell
npm install -g eas-cli
```

### Error al hacer push: `Permission denied`
→ No tienes acceso al repo. Pide a Juan que te agregue como colaborador en GitHub.

### Error: `Port 3000 is already in use`
```powershell
# Matar proceso en puerto 3000
netstat -ano | findstr :3000
taskkill /PID <PID_NÚMERO> /F
```

### Mobile no conecta a Supabase
→ Verificar que `apps/mobile/.env` existe con las variables de la sección 4.

### TypeScript errors en VS Code pero no en terminal
→ `Ctrl+Shift+P` → "TypeScript: Restart TS Server"

---

## 12. DATOS DEL PROYECTO (referencia)

| Campo | Valor |
|-------|-------|
| App name | CHECK SUITE |
| Bundle ID iOS | `com.gastocheck.app` |
| Package Android | `com.gastocheck.app` |
| Expo slug | `gastocheck` |
| Expo owner | `juan.romero` |
| EAS Project ID | `11c09583-5e21-46ad-8116-a2e13994570e` |
| Supabase URL | `https://omhycwfjxynkfwywzwvz.supabase.co` |
| Versión actual | `0.1.72` |
| GitHub repo | `romerojuan24-maker/gastocheck-app` |

---

*Generado: 2026-06-30 · Statika Electronics*
*Si algo no funciona, actualiza DAILY_LOG.md con [BLOCKER] y avísale a Juan.*
