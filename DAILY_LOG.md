# DAILY LOG — CHECK SUITE (GastoCheck · CobraCheck)
**Ruta local:** `C:\Users\admin\Documents\gastocheck-app`
**Stack:** Next.js 15 + Expo React Native + Supabase + TypeScript
**Monorepo:** apps/web · apps/mobile · apps/cobra-web · apps/cobra-mobile · packages/shared

---

## 2026-06-29 — Sesión inicial Juan

### ✅ Completado hoy
- Restricción de módulos: solo GastoCheck visible para todos, excepto `danielbenco1@gmail.com` (dev access completo)
  - Web: `Sidebar.tsx` + `layout.tsx` — prop `userEmail` + filtro DEV_EMAIL
  - Mobile: `index.tsx` — flags showGasto / showCobra / showMore
- Sistema completo de permisos por rol GastoCheck (web):
  - `lib/permissions.ts` — matriz PERMISSIONS (único archivo a editar)
  - `hooks/usePermissions.ts` — hook `canI(resource, action)`
  - 7 páginas protegidas: home, comprobantes, polizas, cuentas-por-pagar, cajas-chicas, escanear, nuevo-comprobante
  - Fix bug `contador-general` (rol inexistente `contador_general` → usa `getSessionUser()`)
- Servidor web levantado en http://localhost:3000

### 📌 Pendientes activos

- [PENDIENTE JUAN] Aplicar migración en Supabase SQL Editor:
  `supabase/migrations/20260629_create_missing_modules.sql`
  → Crea: `cash_flow_items`, `cash_flow_scenarios`, `inventory_products`, `inventory_movements`, `inventory_alerts`
  → Sin esto, FlujoCheck e InventarioCheck no pueden escribir datos.

- [PENDIENTE DANIEL] Nada asignado hoy. Ver `PENDIENTES_DANIEL.md` para CajaCheck.

### ✔️ Decisiones tomadas
- [DECIDIDO] Permisos 100% en `lib/permissions.ts` — nunca hardcodear roles en páginas.
- [DECIDIDO] Restricción DEV_EMAIL es temporal (solo fase desarrollo). Revertir al lanzar.
- [DECIDIDO] `viewer` solo ve comprobantes, no puede crear nada.
- [DECIDIDO] `supervisor` ve pólizas (read-only), puede validar SAT, no puede exportar.

### 🎯 Próximos pasos sugeridos
1. Aplicar migración SQL (Juan, hoy si es posible)
2. Testing permisos en browser: login como buyer, supervisor, viewer
3. Extender mismo patrón de permisos a CobraCheck (misma matriz)

---

## HISTORIAL DE COMMITS (hoy)
```
b35e54e feat(permisos): matriz centralizada de roles en GastoCheck
41a4ee3 feat: restringir módulos a solo GastoCheck — acceso completo solo para dev
4035903 fix(db): crear tablas faltantes BancoCheck + FlujoCheck + InventarioCheck + FacturaCheck
```

---

<!-- TEMPLATE PARA PRÓXIMAS SESIONES:

## YYYY-MM-DD — Sesión [Juan/Daniel]

### ✅ Completado hoy


### 📌 Pendientes

- [PENDIENTE JUAN]
- [PENDIENTE DANIEL]

### ✔️ Decisiones tomadas
- [DECIDIDO]

### ⚠️ Bloqueadores
- [BLOCKER]

### 🎯 Próximos pasos

-->
