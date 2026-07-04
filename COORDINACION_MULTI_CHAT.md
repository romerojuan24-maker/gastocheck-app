# 🔗 COORDINACIÓN MULTI-CHAT — CHECK SUITE

**Última actualización**: 2026-07-04 23:00  
**Estado**: Activo  
**Versión app**: OTA 127 · v1.1.27

---

## 📌 DIVISIÓN DE RESPONSABILIDADES

### CHAT 1: "CobraCheck / Módulos Activos" (Juan)
- Mantiene GastoCheck + CobraCheck activos y producción
- Publica OTAs (128, 129, etc.)
- Integra módulos nuevos cuando están listos
- Resuelve bugs críticos en módulos activos

### CHAT 2: "Módulos Nuevos — CHECK SUITE" (Otro)
- Desarrolla CajaCheck, InventarioCheck, FlujoCheck, BancoCheck
- Los módulos quedan en REM (no visibles en home) hasta integración
- NO publica OTAs
- Coordina cambios en `shared/` y Supabase

---

## 🚨 ARCHIVOS INTOCABLES (CHAT 2)

```
❌ apps/mobile/app/gastocheck/        ← modificar solo en Chat 1
❌ apps/mobile/app/cobracheck/        ← modificar solo en Chat 1
❌ apps/mobile/hooks/useGasto.ts      ← modificar solo en Chat 1
❌ apps/mobile/hooks/cobra.ts         ← modificar solo en Chat 1
❌ apps/mobile/app/_layout.tsx        ← modificar solo en Chat 1
❌ apps/mobile/app.json               ← modificar solo en Chat 1
```

---

## ✅ ARCHIVOS QUE CHAT 2 PUEDE TOCAR

```
✅ apps/mobile/app/cajacheck/**
✅ apps/mobile/app/inventariocheck/**
✅ apps/mobile/app/flujocheck/**
✅ apps/mobile/app/bancocheck/**
✅ apps/mobile/hooks/caja.ts (NEW)
✅ apps/mobile/hooks/inventario.ts (NEW)
✅ apps/mobile/hooks/flujo.ts (NEW)
✅ apps/mobile/hooks/banco.ts (NEW)
✅ supabase/migrations/ (SOLO nuevas tablas con prefijo: caja_*, inventario_*, etc.)
```

---

## 🤝 COORDINAR ANTES DE TOCAR

| Archivo | Quién | Acción |
|---------|-------|--------|
| `packages/shared/src/types.ts` | Chat 1 primero | Avisar si necesitas agregar tipos |
| `packages/shared/src/index.ts` | Chat 1 primero | APP_VERSION + exports |
| `supabase/migrations/` | Coordinar | Si modificas tablas existentes (companies, etc.) |
| `apps/mobile/app/index.tsx` | Chat 1 | Integración de módulos al home |
| `apps/mobile/lib/` | Chat 1 | Configuración y contextos globales |

---

## 📊 FLUJO DE OTA ACTUAL

```
Chat 2 termina módulo → Avisa a Chat 1
Chat 1 integra en app/index.tsx
Chat 1 genera OTA 128 (con módulo nuevo)
Chat 1 publica en EAS
```

**Versión actual**: OTA 127 · v1.1.27  
**Próxima OTA**: 128 (cuando haya cambios listos)

---

## 🔐 REGLAS GIT

**Chat 1:**
```bash
git pull origin main               # Inicio sesión
# Cambios en gastocheck + cobracheck
git commit -m "feat(cobracheck): ..."
git push
```

**Chat 2:**
```bash
git pull origin main               # Inicio sesión
# Cambios en caja/inventario/flujo/banco
git commit -m "feat(cajacheck): ..."
git push
```

**Conflictos**: Si ocurren, Chat 1 resuelve (es el owner de main).

---

## ✨ CHECKLIST ANTES DE INTEGRACIÓN

Cuando Chat 2 diga "módulo listo":

- [ ] No hay conflictos en git
- [ ] Tablas Supabase creadas (caja_*, inventario_*, etc.)
- [ ] RLS policies aplicadas con `auth_role()`
- [ ] Componentes testean en EAS build
- [ ] No modificó gastocheck/ ni cobracheck/
- [ ] Último commit pusheado

Chat 1 entonces:
- [ ] Revisa cambios en shared/
- [ ] Integra en app/index.tsx
- [ ] Publica OTA 128+

---

## 🎯 HITO SIGUIENTE

**Chat 2**: Comenzar CajaCheck (julio 5)  
**Chat 1**: Mantener GastoCheck + CobraCheck mientras contadora revisa  
**Ambos**: Coordinar si necesitan modificar `packages/shared/`

---

**Estado del repo**: ✅ Sincronizado  
**Último commit Chart 1**: d8d68e2 (fix: sync accountant role validation)  
**Último commit Chart 2**: (pendiente primer módulo)
