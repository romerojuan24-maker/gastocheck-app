# 📋 BITÁCORA OTA - CHECK SUITE

Protocolo de implementación y resolución de problemas para deployments de CHECK SUITE.
Manual operativo para no reinventar soluciones ni repetir errores ya diagnosticados.

---

## 🚨 REGLA #1 — SIEMPRE TENER PUNTO FUNCIONAL CONOCIDO Y ROLLBACK RÁPIDO

**Regla pragmática (14-jul-2026):** Después de CADA OTA exitosa, registrar:
- Commit SHA
- Qué funciona (features confirmadas en device)
- APP_VERSION visible (canary para verificar entrega)

**Si la siguiente falla:** NO buscar 4+ métodos de fix. Directamente:
1. `git reset --hard <ULTIMO_COMMIT_FUNCIONAL>`
2. `eas update --branch preview` (republish OTA conocida-buena)
3. Partir de esa base estable y cambios MÁS PEQUEÑOS

**Beneficio:** reduce ciclos fallidos. Antes: ciclo fallo → intenta fix 1 → falla → intenta fix 2 → etc.
Ahora: ciclo fallo → rollback a lo último que funcionaba (2 min) → retry desde base limpia.

**Último punto funcional CONFIRMADO en device:**
- **OTA 210** = commit `baf06ae`
- APP_VERSION: "OTA 210 · v0.1.72 · FlujoCheck fix" ✅ VISIBLE EN DEVICE
- Features verificadas: FlujoCheck exports (CASH_FLOW_RISK_META, projectCashFlow)
- Cambio a realizar: cherry-pick cambios en pasos PEQUEÑOS, no todo junto

---

## ⚡ REGLA #2 — LA COPIA VENDORED DE SHARED (causa de horas perdidas el 14-jul-2026)

**La app móvil lee `apps/mobile/lib/shared/`, NO `packages/shared/src/`.**

- `apps/mobile/metro.config.js`: `extraNodeModules['@gastocheck/shared'] = ./lib/shared`
- `apps/mobile/tsconfig.json`: `"@gastocheck/shared": ["./lib/shared/index.ts"]`

Cualquier cambio de código shared que deba verse en la app (APP_VERSION, BRAND/colores,
lógica compartida) **DEBE editarse en `apps/mobile/lib/shared/*`**. Mantener
`packages/shared/src/*` en sync (misma edición en ambos) para no divergir.

> Si editas solo `packages/shared/src/` el bundle móvil NO cambia y parecerá que
> "la OTA no se entrega" — pero sí se entrega, solo que con el código viejo vendored.

**Cómo saber si una OTA realmente se aplicó en el device:** en Ajustes, el pie muestra
"Embebido: sí/no" + ID. Si dice **"Embebido: no"** y el ID coincide con el update ID
que devolvió `eas update`, la OTA SÍ está corriendo.

---

## 🏗️ STACK

| Herramienta | Versión | Notas |
|---|---|---|
| Expo | ~54.0.0 | apps/mobile |
| EAS Build | Cloud | APK Android (remoto) |
| EAS Update | Cloud | OTA (JS bundle) |
| pnpm | 11.9.0 local / 10.14.0 EAS | |
| Supabase | ^2.108 | backend |
| Expo Router | ~6.0.24 | |

**Config clave:**
- `runtimeVersion`: **0.1.72** (debe coincidir con el binario del device — NO cambiar sin nuevo APK)
- `version`: 0.1.72 (visual)
- Canal OTA: **preview** (el APK del usuario escucha `preview`)
- app.json `updates.requestHeaders.expo-channel-name`: **preview**

---

## 🚀 FLUJO ESTÁNDAR

### OTA update (cambios de JS/código puro — lo normal)
```bash
# 1. Editar código. Si toca shared visible en móvil -> apps/mobile/lib/shared/ (Regla #1)
# 2. Actualizar APP_VERSION en apps/mobile/lib/shared/index.ts (canary) + sync packages/shared/src/index.ts
git add -A && git commit -m "..." && git push origin main
# 3. Publicar OTA al canal preview
cd apps/mobile
eas update --branch preview --message "OTA NNN · descripción"
# 4. Usuario: Ajustes > Buscar actualización (~1-5 min). Cerrar app y reabrir.
```

### APK build (solo si cambia runtimeVersion o módulos nativos)
```bash
cd apps/mobile
eas build --platform android --profile preview --wait
# versionCode DEBE ser > 0 (usar el número de OTA). Requiere descargar APK nuevo.
```

**Regla de decisión:** ¿cambió runtimeVersion o alguna dependencia nativa?
- NO → `eas update` (rápido, sin descargar APK)
- SÍ → `eas build` (lento, usuario reinstala APK)

---

## 📊 HISTORIAL — ROLLBACK POINTS (desde más reciente)

| OTA | Commit | Estado | APP_VERSION (canary) | Última confirmación en device |
|-----|--------|--------|--|--|
| **212** | **549998c** | **✅ ACTUAL FUNCIONAL** | **"OTA 212 · v0.1.72 · Wave 6 UI Screens"** | **14-jul-2026 publicado ✅** |
| 211 | 99adff0 | ✅ Funcional | "OTA 211 · v0.1.72 · Wave 6/8 Backend" | Backend schema + triggers OK |
| 210 | baf06ae | ✅ Funcional | "OTA 210 · v0.1.72 · FlujoCheck fix" | 14-jul-2026 confirmado ✅ |
| 209 | 283e9de | ⚠️ Problematic | "OTA 209 · v0.1.72 · Wave 6/8" | Crash/revert to 208 |
| 208 | c372b2f | ✅ Funcional | "OTA 208 · v0.1.72 · Suite Apps" | Canary verificado |
| 206 | 1c4cbd7 | ✅ Base | "OTA 206 · v0.1.72" | Punto de rollback base |

**OTA 212 (549998c) — Wave 6 UI Screens (FIX):**
- ✅ Pantallas: /advisor/mis-tareas (operator), /advisor/supervisor/tareas (supervisor), /advisor/task-detail/[id]
- ✅ FIXED: Removed router.replace() aggressive redirect that was disconnecting Supabase sessions
- ✅ New screens available for role-based navigation without force-redirect

**OTA 211 (99adff0) — Wave 6/8 Backend:**
- ✅ Database schema: advisor_tasks, advisor_signal_queue, advisor_correlate_cooldown
- ✅ Triggers: auto-publish de señales a través de Queue
- ✅ Edge Function: process-advisor-queue (queue processor every 15s)
- ✅ Cambio puro backend, bajo riesgo → FUNCIONA

**OTA 210 (baf06ae) — FlujoCheck fix:**
- ✅ Exporta CASH_FLOW_RISK_META + projectCashFlow correctamente
- ✅ Cambio pequeño, bajo riesgo → FUNCIONA

**OTA 209 diagnosis (was too big in one release):**
- Suite Apps + Wave 6/8 DB + Wave 6 UI screens + FlujoCheck fix = CRASH
- → Dividir en versiones más pequeñas (OTA 211 onwards)

**Próximas versiones (pequeñas, paso a paso):**
- OTA 211: Wave 6/8 Database Schema (backend puro)
- OTA 212: Wave 6 UI Screens (frontend)
- OTA 213+: Suite Apps refinements

**Regla CRUCIAL:** Si próxima OTA falla → **NO intentes 4+ fixes**. Simplemente:
```bash
git reset --hard baf06ae  # OTA 210 (último funcional confirmado)
eas update --branch preview --message "OTA 210 rollback"
```
Luego retry cambios más pequeños desde esa base limpia.

---

## 🔧 SOLUCIONES HISTÓRICAS

### "La OTA no cambia nada aunque descargó actualización"
→ **Regla #2**. Editar `apps/mobile/lib/shared/`, no `packages/shared/src/`.

### ERR_PNPM_OUTDATED_LOCKFILE en EAS Build (Install dependencies)
→ Regenerar lockfile: `rm -rf node_modules .pnpm && pnpm install --frozen-lockfile`

### Device no detecta OTA
→ Verificar: (a) canal en app.json == canal de `eas update --branch`; (b) runtimeVersion
   del update == runtimeVersion del binario (0.1.72). Cerrar app completamente y reabrir.

---

## ✅ CHECKLIST ANTES DE PUBLICAR OTA
- [ ] Si el cambio se ve en móvil: editado en `apps/mobile/lib/shared/` (no solo packages/shared)
- [ ] APP_VERSION actualizado en `apps/mobile/lib/shared/index.ts` (canary) y sincronizado
- [ ] Canal = preview
- [ ] runtimeVersion = 0.1.72 (sin cambiar)
- [ ] commit + push hechos
- [ ] `eas update --branch preview` publicado
- [ ] Usuario verifica: indicador cambió + "Embebido: no" + ID coincide

---

**Última actualización:** 2026-07-14 · **OTA actual:** 210 (canal preview)
