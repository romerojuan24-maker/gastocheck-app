# 🚀 OTA DEPLOYMENT STRATEGY: INCREMENTAL

**Estrategia:** Lanzar OTA pequeñas, controladas, sin romper lo anterior

---

## 📅 CRONOGRAMA OTA

### OTA 1.0 (Viernes 21 de junio)
```
Versión: 1.0.0
Fecha: 2026-06-21
Módulos activos: GastoCheck
Módulos ocultos: CobraCheck, BancoCheck, FlujoCheck, etc.

MOBILE UI:
┌─────────────────────────────┐
│ [CHECK SUITE] (gris)        │ ← Logo pero deshabilitado
│                             │
│ [💰 GASTO] (VERDE ACTIVO)   │ ← ÚNICO botón visible
│                             │
│ [Menú] [Perfil]             │
└─────────────────────────────┘

WEB UI:
├─ Header: CHECK SUITE
├─ Sidebar:
│  └─ 💰 GastoCheck (ACTIVO)
│
└─ Contenido: Solo GastoCheck funcional

FEATURES:
✅ Captura OCR
✅ Categorización
✅ Exportación
✅ Multi-empresa
✅ RBAC básico

USUARIOS VEN:
├─ Capturista: Solo Gasto
├─ Jefe: Solo Gasto
└─ Admin: Solo Gasto + CHECK SUITE (gris)

BUILD NUMBER: 1.0.0
STATUS: 🚀 LIVE
```

---

### OTA 1.1 (Lunes 24 de junio)
```
Versión: 1.1.0
Fecha: 2026-06-24
Módulos activos: GastoCheck + CobraCheck
Módulos ocultos: BancoCheck, FlujoCheck, etc.

CAMBIOS VS 1.0:
├─ Agregó: CobraCheck (botón nuevo)
├─ Agregó: Pólizas descargables
├─ Agregó: Risk scoring
├─ SIN CAMBIOS: GastoCheck (compatible 100%)

MOBILE UI:
┌─────────────────────────────┐
│ [CHECK SUITE] (gris si no)  │ ← Activo si es admin
│                             │
│ [💰 GASTO] (VERDE)          │ ← SIGUE IGUAL
│                             │
│ [📞 COBRANZA] (AZUL NUEVO)  │ ← NUEVO
│                             │
│ [Menú] [Perfil]             │
└─────────────────────────────┘

WEB UI:
├─ Header: CHECK SUITE
├─ Sidebar:
│  ├─ 💰 GastoCheck (ACTIVO)
│  └─ 📞 CobraCheck (NUEVO)
│
└─ Dashboard: Selecciona módulo

FEATURES NUEVAS:
✅ Clientes + Facturas
✅ Registrar pagos
✅ Pólizas (CSV + Excel)
✅ Risk scoring automático
✅ Bitácora

USUARIOS VEN:
├─ Capturista: Gasto + CobraCheck (si autorizado)
├─ Jefe Cobranza: Gasto + CobraCheck ✅
└─ Admin: Ambos + CHECK SUITE menu

BUILD NUMBER: 1.1.0
STATUS: 🚀 LIVE
WHAT'S NEW:
├─ ✨ CobraCheck (gestión de clientes)
├─ 📊 Pólizas descargables para contabilidad
└─ 🎯 Solo usuarios autorizados
```

---

### OTA 1.2+ (Martes+ según disponibilidad)
```
1.2: BancoCheck
1.3: FlujoCheck
1.4: FacturaCheck
1.5+: Según prioridad
```

---

## 🔧 CONFIGURACIÓN TÉCNICA

### Feature Flags por OTA

**OTA 1.0:**
```typescript
// config/features.ts
export const FEATURES = {
  GASTOCHECK: true,
  COBRACHECK: false,      // ← OCULTO
  BANCOCHECK: false,      // ← OCULTO
  FLUJOCHECK: false,      // ← OCULTO
  FACTURACHECK: false,    // ← OCULTO
  INVENTARIOCHECK: false, // ← OCULTO
}
```

**OTA 1.1:**
```typescript
export const FEATURES = {
  GASTOCHECK: true,
  COBRACHECK: true,       // ← ACTIVO
  BANCOCHECK: false,      // ← OCULTO
  FLUJOCHECK: false,      // ← OCULTO
  FACTURACHECK: false,    // ← OCULTO
  INVENTARIOCHECK: false, // ← OCULTO
}
```

---

## 📱 RENDERIZADO CONDICIONAL

### Mobile Navigation (OTA 1.0 vs 1.1)

```typescript
// components/MobileNav.tsx

function MobileNav({ user }) {
  const { FEATURES } = useFeatureFlags()
  
  return (
    <div className="space-y-4 p-4">
      {/* CHECK SUITE Logo - Solo para admins con múltiples módulos */}
      {user.role === 'admin' && FEATURES.COBRACHECK && (
        <button className="w-full py-3 bg-blue-600 text-white rounded">
          🏢 CHECK SUITE
        </button>
      )}
      
      {/* GASTO - Siempre visible */}
      {FEATURES.GASTOCHECK && (
        <button className="w-full py-3 bg-emerald-500 text-white rounded">
          💰 GASTO
        </button>
      )}
      
      {/* COBRANZA - Visible si está active en features + usuario autorizado */}
      {FEATURES.COBRACHECK && canAccess(user, 'cobranza') && (
        <button className="w-full py-3 bg-blue-500 text-white rounded">
          📞 COBRANZA
        </button>
      )}
      
      {/* Otros módulos - Ocultos hasta su OTA */}
      {/* ... */}
    </div>
  )
}
```

### Web Sidebar

```typescript
// components/Sidebar.tsx

function Sidebar({ user }) {
  const { FEATURES } = useFeatureFlags()
  
  const modules = [
    FEATURES.GASTOCHECK && { id: 'gasto', label: 'GastoCheck', icon: '💰' },
    FEATURES.COBRACHECK && canAccess(user, 'cobranza') && { id: 'cobranza', label: 'CobraCheck', icon: '📞' },
    FEATURES.BANCOCHECK && canAccess(user, 'banco') && { id: 'banco', label: 'BancoCheck', icon: '🏦' },
    // ... más módulos según features
  ].filter(Boolean)
  
  return (
    <nav className="space-y-2">
      {modules.map(m => (
        <NavItem key={m.id} {...m} />
      ))}
    </nav>
  )
}
```

---

## 📦 BUILD PROCESS

### OTA 1.0 (Viernes 21)

```bash
# 1. Verificar estado
git status                          # ✅ Todo committeado
git log --oneline -5                # ✅ Últimos commits

# 2. Configurar features para 1.0
# GASTOCHECK: true
# COBRACHECK: false
# ... otros: false

# 3. Build
npm run build                       # Vercel auto-deploya
git push origin main               

# 4. Deploy
# Vercel: auto-deploy de main
# EAS: eas build --auto-submit-with-credentials

# 5. Version
# Tag: v1.0.0
git tag -a v1.0.0 -m "OTA 1.0: GastoCheck MVP"
git push origin v1.0.0

# 6. Release Notes
# 📝 OTA 1.0.0 - GastoCheck MVP
# ✨ Captura OCR de gastos
# ✨ Exportación a Excel/CSV
# ✨ Multi-empresa
# 🐛 Validaciones mejoradas
```

### OTA 1.1 (Lunes 24)

```bash
# 1. Actualizar features
# GASTOCHECK: true
# COBRACHECK: true  ← CAMBIO
# ... otros: false

# 2. Build
npm run build
git push origin main

# 3. Deploy
# Vercel: auto-deploy
# EAS: eas build --auto-submit-with-credentials

# 4. Version
git tag -a v1.1.0 -m "OTA 1.1: CobraCheck Release"
git push origin v1.1.0

# 5. Release Notes
# 📝 OTA 1.1.0 - CobraCheck Release
# ✨ Gestión de clientes
# ✨ Registro de pagos
# ✨ Pólizas descargables (Excel/CSV)
# ✨ Risk scoring automático
# ✨ Validaciones RFC mejoradas
# 🐛 Bug fixes
```

---

## 🔄 ROLLBACK PLAN

Si OTA 1.0 tiene un problema crítico:
```
1. Detectar issue en usuarios
2. Revert features: GASTOCHECK = false
3. Deploy OTA 1.0.1 (rollback)
4. Investiga el problema
5. Fix + redeploy
```

---

## 📊 VERSIONING

```
Version: MAJOR.MINOR.PATCH

1.0.0: Inicial (GastoCheck)
1.0.1: Bug fix (si hay)
1.1.0: CobraCheck agregado
1.1.1: Bug fix (si hay)
1.2.0: BancoCheck agregado
...

NOMENCLATURA:
- MAJOR: Cambio arquitectónico grande
- MINOR: Nuevo módulo/feature
- PATCH: Bug fix
```

---

## 📝 NOTA IMPORTANTE

**NO MODIFICAR GastoCheck entre 1.0 y 1.1**

Si hay bugs en GastoCheck:
- Si es crítico: OTA 1.0.1 (fix)
- Si es menor: Esperar a 1.1 y hacer 1.1.1

NUNCA hacer "1.0.5" después de "1.1.0" - Solo version forward.

---

## ✅ CHECKLIST DEPLOYMENT

### OTA 1.0 (Viernes)

- [ ] GastoCheck testeado 100%
- [ ] CobraCheck oculto (FEATURES.COBRACHECK = false)
- [ ] Features configuradas correctamente
- [ ] Build verifica sin errores
- [ ] Vercel deploy OK
- [ ] EAS build OK
- [ ] Versión tag: v1.0.0
- [ ] Release notes preparadas
- [ ] Usuarios pueden descargar

### OTA 1.1 (Lunes)

- [ ] GastoCheck: SIN CAMBIOS (compatible 1.0)
- [ ] CobraCheck testeado 100%
- [ ] Pólizas funcionales
- [ ] Features actualizadas (COBRACHECK = true)
- [ ] Build verifica
- [ ] Vercel deploy OK
- [ ] EAS build OK
- [ ] Versión tag: v1.1.0
- [ ] Release notes preparadas
- [ ] Usuarios pueden actualizar

---

## 🎯 VENTAJAS DE ESTE APPROACH

✅ **MVP Pequeño:** Viernes lanzo solo GastoCheck (bajo riesgo)
✅ **Iteración Rápida:** Lunes agrego CobraCheck (modular)
✅ **Compatibilidad:** OTA 1.1 no cambia GastoCheck (users felices)
✅ **Control:** Cada feature con su OTA (fácil rollback)
✅ **Credibilidad:** MVP → Iteración rápida → Modular
✅ **Feedback:** Usuarios prueban GastoCheck viernes, dan feedback, lunes agrego CobraCheck mejorado
✅ **Profesional:** Versionado claro, release notes claras

---

**Status:** 🟢 READY FOR DEPLOYMENT
