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

## 2026-07-01 — Sesión sincronización DB producción (ai@statikaelectronics.com.mx)

### ✅ Completado hoy
- **Setup PC nueva**: Node v24.18.0, EAS CLI, pnpm instalados; repo clonado; `apps/web/.env.local` + `apps/mobile/.env` configurados con claves reales.
- **Limpieza raíz**: 92 archivos `.md` viejos (auditorías/planes fechados jun-06 a jun-28) movidos a `docs/archive/root_2026/`. Solo quedan `README.md`, `DAILY_LOG.md`, `SETUP_NUEVA_PC.md`.
- **[BLOCKER] resuelto — 21 migraciones sin aplicar en producción**: desde el 20-jun, prácticamente ninguna migración nueva había llegado a la base real (`omhycwfjxynkfwywzwvz`). Todo el trabajo de OTA 80–101 asumía columnas/tablas/funciones que nunca se crearon. Aplicadas 17 de 21 (ver detalle abajo); 4 excluidas por ser arquitectura muerta/no conectada al código real.
- **Fix bug reembolsos**: "eliminar reembolso no lo quita de la lista" → a la tabla `reembolsos` le faltaba la policy RLS de `DELETE` (el borrado no fallaba pero afectaba 0 filas). Agregada en `20260701000000_reembolsos_delete_policy.sql`.
- **Fix bug captura de comprobantes** ("se queda pensando, no aparecen"): causa raíz más probable = mismo patrón de GRANTs/columnas faltantes de las 21 migraciones pendientes (confirmado el patrón en `grant_missing_tables.sql`: *"sin estos GRANTs el INSERT fallaba silenciosamente"*). Insert de `receipts` en sí (RLS + triggers) está limpio. **Falta confirmar en dispositivo real que ya no se repite.**
- **Enum `member_role` incompleto**: faltaban `buyer`, `viewer`, `collector` (el código los usa en permisos/invitaciones por todos lados; solo existía `cobrador`). Agregados vía `20260622120000_add_missing_member_roles.sql`. Antes de esto, invitar con esos 3 roles fallaba en producción.
- **Bugs de sintaxis/esquema corregidos en migraciones** (afectaban CobraCheck, pólizas, viáticos, contador-general):
  - `cobra_field_movements.sql`: columna `member_role` → `role`; función `update_updated_at_column()` (solo existe en schema `storage`) → `touch_updated_at()` (la real en `public`).
  - `fix_policies_rls.sql`: sintaxis inválida `FOR UPDATE, DELETE` en una sola policy (Postgres no lo soporta) → separada en 2 policies.
  - `perfilamiento_gastocheck_v1.sql`: rol inexistente `contador_general` → `accountant`; bug de seguridad real (`WHERE company_id = company_id`, tautología que dejaba insertar viáticos cross-tenant) → corregido a comparar contra `viaticos.company_id`; `CREATE OR REPLACE POLICY` (no existe en Postgres) → `DROP POLICY IF EXISTS` + `CREATE POLICY`; columnas inventadas (`p.email`, `e.amount`, valores de `expense_status` que no existen) en 3 vistas de reporte usadas solo por código muerto → vistas eliminadas de la migración.
  - Varios archivos con timestamps de versión duplicados/cortos (ej. `20260623_x.sql` y `20260623_y.sql` con la misma versión "20260623") rompían el diffing de `supabase db push` → renombrados con sufijos únicos de 14 dígitos.

### 🗑️ Migraciones excluidas (movidas fuera de `supabase/migrations/`, no aplicadas)
1. `20260620_001_movimientos_financieros.sql` + 4 archivos `20260621_*` — arquitectura "movimientos_financieros" abandonada, referencia tablas inexistentes (`empresas`, `gastos`, `usuarios` en vez de `companies`, `expenses`, `profiles`). Ningún código la usa.
2. `20260623_gastocheck_ruta.sql` — **choque real de nombres**: define `daily_routes` con esquema de CobraCheck (`actor_id`/`client_id`/`sequence`), pero ya existe `daily_routes` en producción con OTRO esquema (GPS tracking, usado por `apps/mobile/app/rutas-equipo.tsx`). CobraCheck "Mi Ruta" (`useGastoCheck.ts` → `useRoute()`) espera un TERCER esquema distinto. **Nunca ha funcionado — requiere decisión de producto (renombrar tabla + ajustar código), no es un simple fix de migración.**
3. `20260623_seed_cobra_data.sql` — datos de prueba con `company_id` inventado; el propio archivo dice "Ejecutar solo en desarrollo".
4. `20260624_unified_routes_system.sql` — mismo choque de `daily_routes` + typo `company` (sin "s") en 5 FKs + tablas (`movement_attempts`, `daily_movement_report`, `reason_codes`) que ningún código consulta directamente.

Archivos completos respaldados en `C:\Users\statika\AppData\Local\Temp\claude\gastocheck-excluded-migrations\` (temporal, no en el repo).

### 📌 Pendientes activos
- [PENDIENTE JUAN/DANIEL] Decidir qué hacer con `daily_routes` — 3 diseños incompatibles compitiendo por el mismo nombre de tabla. CobraCheck "Mi Ruta" no funciona hasta resolver esto.
- [PENDIENTE JUAN] Revisar si `movement_attempts`/`daily_movement_report`/`reason_codes`/`cash_deposits` (de `unified_routes_system.sql`) siguen siendo el diseño deseado antes de recrearlos con nombres sin colisión.
- [PENDIENTE DANIEL] Confirmar en dispositivo real que la captura de comprobantes y el borrado de reembolsos ya funcionan.
- [PENDIENTE] `apps/web/components/ui/` no existe pero varias páginas aún importan de ahí (`contador-assignment.tsx`, `cobracheck/routes/page.tsx`, `gastocheck/contador-general.tsx` — este último parece código muerto, reemplazado por `contador-general/page.tsx`). `npm run typecheck` falla por esto — no relacionado a hoy, pendiente de antes.
- [PENDIENTE] Cambios de migraciones (nuevas + renombradas + editadas) están en el working tree local, **sin commitear** — pendiente confirmación para hacer commit.
- [PENDIENTE DANIEL] Fix aplicado (código, aún sin commit): "Importar Catálogo de Cuentas" — `catalogo-import-modal.tsx:89` usaba `.insert()` en vez de `.upsert()`, así que reimportar un catálogo con códigos ya existentes tiraba `duplicate key value violates unique constraint "accounting_accounts_company_id_code_key"` y fallaba el lote completo (251 cuentas). Cambiado a `.upsert(..., { onConflict: 'company_id,code' })`. Falta probar en dispositivo.

### ⚠️ Bloqueadores
- [BLOCKER] resuelto arriba (21 migraciones sin aplicar) — pero reveló que el proceso de "ejecutar SQL manualmente en el dashboard" (mencionado en varios archivos) se salteó la mayoría de las migraciones desde el 20-jun. Recomendación: de ahora en adelante usar `supabase db push` (o este mismo flujo) en vez de pegar SQL manualmente, para que quede tracked.

### 🎯 Próximos pasos
1. Decisión de producto sobre `daily_routes` (ver pendientes)
2. Testing en dispositivo real: captura de comprobantes + eliminar reembolso
3. Commitear cambios de `supabase/migrations/` si Juan/Daniel lo aprueban

---

## 2026-07-02 — Sesión migración a PC nueva (Juan)

### ✅ Completado hoy
- **Setup PC nueva completo**: Node v24.15.0, pnpm@11 (11.9.0), Supabase CLI (2.109.0) instalados; EAS CLI ya estaba (18.12.1); repo clonado en `C:\Users\perte\Documents\gastocheck-app`; `pnpm install` corrido sobre el monorepo completo; `apps/web/.env.local` + `apps/mobile/.env.local` creados con claves reales de `SETUP_NUEVA_PC.md`.
- **Fix typecheck — `apps/web/components/ui/` no existía**: nunca se generó (probablemente se planeó shadcn/ui y no se corrió el scaffolding). Creados a mano, sin dependencias nuevas (sin Radix): `button.tsx`, `input.tsx`, `card.tsx`, `badge.tsx`, `checkbox.tsx`, `table.tsx`, `select.tsx` (este último con Context propio para el API compound `Select/SelectTrigger/SelectValue/SelectContent/SelectItem`). Nota: `SelectValue` muestra el `value` crudo (ej. UUID del cliente/cobrador) en vez de la etiqueta legible — suficiente por ahora porque CobraCheck está pausado (ver decisión abajo), pero habría que arreglarlo si se retoma esa pantalla.
- Borrados 2 archivos muertos que rompían `typecheck` sin aportar nada (huérfanos, reemplazados por sus `page.tsx`, confirmado que nada los importa): `apps/web/app/(dashboard)/gastocheck/contador-general.tsx` y `apps/web/app/(dashboard)/admin/contador-assignment.tsx`.
- Verificado: `pnpm run web` levanta en `http://localhost:3000` y responde 200 OK.

### ✔️ Decisiones tomadas
- [DECIDIDO] CobraCheck no está activo por ahora — no tocar nada de CobraCheck (rutas, `daily_routes`, `movement_attempts`/`daily_movement_report`/`reason_codes`/`cash_deposits`) hasta avanzar más con GastoCheck.

### 📌 Pendientes activos (typecheck — NO relacionado a lo de hoy, preexistente)
`pnpm run typecheck` sigue fallando por 4 errores sin relación con `components/ui`:
- `packages/shared/src/types/index.ts` — imports rotos: `./bancocheck`, `./flujocheck`, `./facturacheck`, `./inventariocheck`, `./advisor` (archivos no existen)
- `apps/web/app/(dashboard)/cobracheck/routes/page.tsx:26` — `lucide-react` no está en `package.json` (falta agregar dependencia o quitar el import de `Calendar`)
- `apps/web/app/(dashboard)/cobracheck/routes/page.tsx:475` — `CobraMovement` no tiene la propiedad `client` (el query hace join `client:cobra_clients(name)` pero el tipo no lo refleja)
- `apps/web/app/api/checkia/detectar.ts:25` — usa `cookies().get(...)` sin `await`; en Next.js 15 `cookies()` es async

Como CobraCheck está pausado, ninguno de estos bloquea a GastoCheck — quedan para cuando se retome.

### 🎯 Próximos pasos
1. `eas login` (pendiente, requiere sesión interactiva del usuario)
2. Verificar secrets de Edge Functions en Supabase Dashboard (`GEMINI_API_KEY`, `STRIPE_*`, `WHATSAPP_TOKEN`)
3. Aplicar migraciones SQL pendientes: `20260630_viaticos_trip_columns.sql` y `20260630_fix_reembolsos_receipts_columns.sql`

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
