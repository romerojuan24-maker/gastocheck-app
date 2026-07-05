# PROMPT DE UNIFICACIÓN — CHECK SUITE (Chat Único)
**Fecha:** 2026-07-05 | **Generado por:** Chat 2 (Juan) | **Estado:** OTA 138 activa

---

## CONTEXTO DE ARRANQUE OBLIGATORIO

Este chat unifica dos sesiones previas. Antes de cualquier acción lee este documento completo. Aplica las memorias en `C:\Users\admin\.claude\projects\C--Users-admin-Documents-statix-app\memory\`.

---

## 1. REPOS Y RUTAS

| App | Ruta local | Repo | Branch activo |
|-----|-----------|------|---------------|
| **CHECK SUITE (GastoCheck + CobraCheck + módulos)** | `C:\Users\admin\Documents\gastocheck-app` | GitHub: gastocheck-app | `main` |
| **STATIX SpraySense** | `C:\Users\admin\Documents\statix-app` | GitHub: statix-calibrador | `master` |
| **STATIX Intelligence** | `C:\Users\admin\Documents\intelligence-app` | pendiente crear | `main` |
| **Folliar Intelligence** | `C:\Users\admin\Documents\folliar-app` | pendiente crear | `main` |

**Este chat se enfoca en `gastocheck-app`.**

---

## 2. STACK TÉCNICO

```
gastocheck-app/
├── apps/
│   ├── mobile/          ← Expo SDK 54 + Router v6 (Android APK + OTA)
│   ├── web/             ← Next.js 15 (Vercel, dashboard web)
│   ├── cobra-mobile/    ← APK separado CobraCheck (build Gradle falla, ver pendientes)
│   └── cobra-web/       ← Web CobraCheck
├── packages/
│   └── shared/src/      ← BRAND, APP_VERSION, tipos TS, hooks compartidos
└── supabase/
    ├── functions/       ← Edge Functions (Node, Deno)
    └── migrations/      ← SQL migrations (ejecutar en Supabase SQL Editor)
```

**Supabase project:** `omhycwfjxynkfwywzwvz`
**EAS account:** `juan.romero` / proyecto `gastocheck`
**APK instalado en dispositivo:** canal `preview`, runtime `0.1.72`

---

## 3. REGLA DE ORO — DEPLOY OTA

**Siempre publicar en AMBOS branches:**

```bash
cd C:\Users\admin\Documents\gastocheck-app\apps\mobile

# Branch 1 — APK de pruebas
CI=1 npx eas update --branch preview --message "OTA NNN — descripción" --non-interactive

# Branch 2 — Play Store
CI=1 npx eas update --branch production --message "OTA NNN — descripción" --non-interactive
```

**Antes de publicar:**
1. `git pull origin main` (verificar que no haya commits del otro chat)
2. Actualizar `APP_VERSION` en `packages/shared/src/index.ts` → `'OTA NNN · v1.1.NN'`
3. `git commit` con tag `feat(otaNNN):`
4. Publicar ambos branches

**La próxima OTA es 139** (OTA 138 se publica en esta sesión).

---

## 4. DESIGN SYSTEM — OBLIGATORIO EN TODOS LOS MÓDULOS

Todos los módulos siguen el mismo patrón visual:

```tsx
// TopBar estándar
<View style={s.topBar}>           // backgroundColor: BRAND.navy (#0F172A)
  <TouchableOpacity onPress={() => router.replace('/')}>
    <Text>‹ CHECK SUITE</Text>    // Botón regreso al home
  </TouchableOpacity>
  <Text style={s.topBarWordA}>ModuloName</Text>
  <Text style={[s.topBarWordB, { color: MODULE_COLOR }]}>Check</Text>
  <TouchableOpacity onPress={() => router.push('/settings')}>⚙️</TouchableOpacity>
</View>

// BottomTabBar estándar — 5 tabs
// Tab activo: backgroundColor: MODULE_COLOR + '10', label color: MODULE_COLOR
// Tab inactivo: color: '#90A4AE'
```

**Colores por módulo** (`packages/shared/src/index.ts` → `BRAND`):
| Módulo | Color | Constante |
|--------|-------|-----------|
| GastoCheck | `#00A650` | `BRAND.green` |
| CobraCheck | `#FF7A1A` | `BRAND.cobra` |
| FlujoCheck | `#1565C0` | `BRAND.blue` |
| BancoCheck | `#FF6B35` | (literal) |
| FacturaCheck | `#7B1FA2` | `BRAND.purple` |
| InventarioCheck | `#FF9800` | `BRAND.orange` |

---

## 5. ESTADO ACTUAL POR MÓDULO (2026-07-05, OTA 138)

### GastoCheck ✅ FUNCIONAL
- Comprador: captura OCR, reembolsos, anticipos
- Supervisor/Contador: pólizas, validación SAT, exportación CONTPAQi
- Admin: multi-empresa, equipo, billing Stripe
- **Pendiente Juan:** aplicar 2 SQL migrations en Supabase
  - `20260630_viaticos_trip_columns.sql`
  - `20260630_fix_reembolsos_receipts_columns.sql`
- **Bug activo:** `receipts` (mobile) vs `expenses` (web) — la lista web no muestra comprobantes mobile
- **SAT:** validador es mock (TODO: real API) — bloqueante para v1.0

### CobraCheck ✅ FUNCIONAL (UI completa)
- Home por roles: Admin/Contador/Cobrador con nav inferior
- Mi Ruta de Cobranza: GPS offline-first, captura cobros, sync WiFi
- Clientes, Historial, Tareas Diarias: implementadas
- Intereses moratorios + recordatorios automáticos + links WhatsApp
- **Pendiente:** schema `daily_routes` tiene conflicto (3 versiones) — resolver nombre tabla
- **Build EAS separado (cobra-mobile):** falla Gradle — 4 intentos fallidos. No urgente.

### FlujoCheck 🟡 PARTIAL
- Mobile: TopBar+BottomBar OK (OTA 137), Tab 0 (Flujo) funcional
- Tabs 1-3 (Créditos, Proyección, Ajustes): Próximamente
- Backend Daniel: 14 tablas SQL + 20+ tipos TS + 6 endpoints + 6 hooks — **listos en git**
- Web: dashboard funcional
- **Próximo paso:** implementar tabs 1-3 usando hooks ya creados (useFlujoBalance, useAmortizationCalculation, useAnnualProjection)
- **Guía Daniel:** `FLUJOCHECK_IMPLEMENTATION_GUIDE.md` + `FLUJOCHECK_ALGORITHMS_CHEATSHEET.md`

### BancoCheck 🟡 PARTIAL
- Mobile: TopBar+BottomBar OK, Tab 0 (Cuentas) y Tab 1 (Transacciones) funcionales
- Tabs 2-3 (Reconciliación, Importar): Próximamente
- Backend Daniel: 8 tablas SQL + tipos + 6 endpoints — **listos en git**
- Web: importación CSV funcional
- **Próximo paso:** BancoCheck Reconciliación automática (match bank_transactions ↔ expenses)

### FacturaCheck 🟡 PARTIAL
- Mobile: TopBar+BottomBar OK, Tab 0 (CFDIs) funcional con sub-tabs
- Tabs 1-3 (Distribución, Reportes, Configuración): Próximamente
- Backend Daniel: 8 tablas + audit_log — **listos en git**
- **CRÍTICO:** PAC Timbre Digital sin credenciales — CFDIs inválidas ante SAT (multa $50k-500k MXN)
- PAC candidatos: Finanzauto, Facturama, FacturAPI

### InventarioCheck 🟡 PARTIAL
- Mobile: TopBar+BottomBar OK, Tabs 0-1 funcionales
- Tabs 2-3 (Movimientos, Ajustes): Próximamente
- Web: no iniciado

### CajaCheck ❌ 0% CÓDIGO
- Arquitectura 100% diseñada. Leer: `cajacheck_architecture.md` + `PENDIENTES_DANIEL.md`
- 11 tablas, mobile (venta/corte/compra), web (corte-Z/supervisión)

---

## 6. PENDIENTES CRÍTICOS

### Juan (decisiones y configuración)
- [ ] Aplicar 2 SQL migrations en Supabase SQL Editor
- [ ] Decidir esquema `daily_routes` para CobraCheck (renombrar a `cobra_daily_routes`?)
- [ ] Contratar PAC para FacturaCheck (Finanzauto/Facturama)
- [ ] Obtener `sk_live_...` de Stripe Dashboard para producción
- [ ] Decidir modelo permisos granulares (no urgente)

### Daniel (código)
- [ ] Testing dispositivo físico: captura comprobantes + borrado reembolso (OTA 138)
- [ ] Implementar tabs FlujoCheck: Créditos + Proyección + Ajustes
- [ ] Implementar BancoCheck Reconciliación
- [ ] Implementar FacturaCheck Distribución
- [ ] Crear tabla `audit_log` + campos en tablas críticas
- [ ] Crear triggers pólizas automáticas (PostgreSQL)
- [ ] Integrar SAT Validator real (FINKOK/SAT API)
- [ ] CajaCheck: cuando sea prioridad

---

## 7. MIGRACIONES SQL PENDIENTES DE EJECUTAR (en Supabase)

Las siguientes migraciones están en git pero **NO ejecutadas en producción**. Juan las ejecuta en SQL Editor de Supabase:

```
supabase/migrations/20260630_viaticos_trip_columns.sql
supabase/migrations/20260630_fix_reembolsos_receipts_columns.sql
supabase/migrations/20260705_001_flujocheck_schema.sql       ← Daniel
supabase/migrations/20260705_002_bancocheck_schema.sql       ← Daniel
supabase/migrations/20260705_003_facturacheck_schema.sql     ← Daniel
```

---

## 8. PROTOCOLOS OBLIGATORIOS

### Anti-ruptura (CRÍTICO)
Antes de cualquier cambio de código:
1. `git pull origin main`
2. `git log --oneline -5` (ver qué cambió)
3. Si el cambio toca rutas/layout/auth: probar localmente antes de OTA
4. Nunca pushear código que rompa el bundle

### OTA Deploy (SIEMPRE)
```bash
# 1. Actualizar packages/shared/src/index.ts → APP_VERSION
# 2. git add + commit "feat(otaNNN): ..."
# 3. Publicar AMBOS branches (preview + production)
```

### Diagnóstico de bugs
- Logs remotos: Supabase → SQL Editor → `SELECT * FROM diagnostic_logs ORDER BY created_at DESC LIMIT 50`
- `logError()` y `logWarn()` van a Supabase. `logEvent()` solo es local.

---

## 9. HISTORIAL OTA RECIENTE

| OTA | Quién | Contenido |
|-----|-------|-----------|
| **138** | Chat 2 | Bump versión — FlujoCheck+BancoCheck+FacturaCheck infra Daniel (hooks+types+migrations) |
| **137** | Chat 2 | Design system CHECK SUITE — TopBar+BottomBar en FlujoCheck, BancoCheck, FacturaCheck, InventarioCheck |
| **136** | Chat 1 | CobraCheck home por roles + Más Herramientas solo admin |
| **135** | Chat 1 | Fix crash startup — conflictos rutas Expo Router |
| **132** | Chat 1 | CobraCheck: intereses moratorios + recordatorios + links WhatsApp |
| **131** | Chat 1 | CobraCheck dark theme + DatePicker promiseDate |
| **130** | Chat 1 | CobraCheck: types/hooks/components con schema DB real |

---

## 10. ARCHIVOS CLAVE A CONOCER

```
apps/mobile/app/
├── index.tsx                    ← Home CHECK SUITE — grid de módulos, gating por rol
├── gastocheck/index.tsx         ← GastoCheck home con navegación por rol (5 tabs)
├── cobracheck/
│   ├── index.tsx                ← CobraCheck home por roles
│   ├── mi-ruta.tsx              ← GPS cobranza offline-first (route-tracker)
│   ├── clientes.tsx             ← Lista clientes
│   └── hooks/                   ← useCobrador, useCobraClients, etc.
├── flujocheck/index.tsx         ← Tabs 0 funcional, 1-3 Próximamente
├── bancocheck/index.tsx         ← Tabs 0-1 funcionales, 2-3 Próximamente
├── facturacheck/index.tsx       ← Tab 0 funcional, 1-3 Próximamente
├── inventariocheck/index.tsx    ← Tabs 0-1 funcionales, 2-3 Próximamente
└── lib/
    ├── supabase.ts              ← Cliente Supabase
    ├── route-tracker.ts         ← GPS offline CobraCheck
    └── useGastoCheck.ts         ← Hooks GastoCheck principales

packages/shared/src/
├── index.ts                     ← BRAND, APP_VERSION, re-exports
├── cobra.ts                     ← Tipos CobraCheck
├── flujocheck.ts                ← Tipos FlujoCheck (Daniel)
├── bancocheck.ts                ← Tipos BancoCheck (Daniel)
└── facturacheck.ts              ← Tipos FacturaCheck (Daniel)

apps/web/app/
├── gastocheck/                  ← Dashboard web GastoCheck
└── cobracheck/                  ← Dashboard web CobraCheck

supabase/functions/              ← Edge Functions
```

---

## 11. CREDENCIALES Y CONFIGURACIÓN

- **Supabase URL:** en `.env.local` → `EXPO_PUBLIC_SUPABASE_URL`
- **Supabase Anon Key:** en `.env.local` → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- **Stripe:** `sk_test_...` (modo test) — Juan tiene que cambiar a `sk_live_...`
- **EAS:** proyecto `gastocheck`, account `juan.romero`
- **Credenciales prueba web:** `danielbenco1@gmail.com` / `CheckSuite2026!`

---

## 12. INSTRUCCIONES DE COMPORTAMIENTO

1. **No preguntes antes de cada acción** — ejecuta hasta completar, luego reporta
2. **Siempre `git pull` antes de tocar código**
3. **Toda OTA va a AMBOS branches** (preview + production)
4. **Nunca romper el bundle** — si hay duda, prueba localmente
5. **Logs de Supabase primero** cuando haya bug reportado por el usuario
6. **El usuario usa WhatsApp Business** para comunicaciones del proyecto
7. **Modelo económico por defecto** — escalar a opus solo si se requiere razonamiento complejo
8. **`/compact` al cierre de cada sesión larga**

---

## 13. PRÓXIMOS PASOS INMEDIATOS (orden de prioridad)

1. **Daniel** → Probar OTA 138 en dispositivo (captura + reembolso)
2. **Juan** → Ejecutar 5 SQL migrations en Supabase
3. **Juan** → Decidir nombre tabla `daily_routes`
4. **Daniel** → Implementar FlujoCheck tabs 1-3 (hooks ya listos en git)
5. **Daniel** → Crear `audit_log` table + triggers pólizas
6. **Juan** → Contratar PAC para FacturaCheck

---

*Documento generado por Chat 2 al cerrar sesión. Última OTA publicada: 138.*
