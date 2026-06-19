# 📱 MOBILE UX FINAL — Diseño del usuario

**Arquitectura:** Basada en feedback directo del usuario (foto pizarra + clarificación)

---

## 🎯 ESTRUCTURA MOBILE (Lo que el usuario ve en la calle)

```
┌─────────────────────────────────────┐
│                                     │
│   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│   ┃                          ┃   │
│   ┃  CHECK SUITE             ┃   │ ← Logo/header
│   ┃  (icono de marca)        ┃   │   Solo activo si tienes
│   ┃                          ┃   │   OTROS MÓDULOS
│   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│   ┃                          ┃   │
│   ┃    💰 GASTO              ┃   │ ← Si tienes permiso
│   ┃   (Capturar foto)        ┃   │
│   ┃                          ┃   │
│   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│   ┃                          ┃   │
│   ┃   📞 COBRANZA            ┃   │ ← Si tienes permiso
│   ┃   (Ver clientes/riesgo)  ┃   │
│   ┃                          ┃   │
│   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  [≡ Menú] [👤 Perfil]              │
│                                     │
└─────────────────────────────────────┘

PRINICIPIO: "Solo ves lo que estás autorizado"
```

---

## 👤 USUARIOS Y QUÉ VEN

### USUARIO 1: Capturista (Solo Gasto)

```
┌─────────────────────────────────────┐
│                                     │
│   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│   ┃ CHECK SUITE               ┃   │
│   ┃ (DESHABILITADO - gris)    ┃   │ ← No tiene otros módulos
│   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│   ┃                          ┃   │
│   ┃    💰 GASTO              ┃   │
│   ┃   (Capturar foto)        ┃   │ ← ACTIVO
│   ┃                          ┃   │
│   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                     │
│   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│   ┃ 📞 COBRANZA               ┃   │
│   ┃ (NO AUTORIZADO - oculto)  ┃   │ ← NO VE
│   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                     │
│  [≡ Menú] [👤 Perfil]              │
│                                     │
└─────────────────────────────────────┘

VE: Solo Gasto
USO: Toma fotos en la calle
TIEMPO: Abre, toca Gasto, captura, done
```

### USUARIO 2: Jefe de Cobranza (Gasto + Cobranza)

```
┌─────────────────────────────────────┐
│                                     │
│   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│   ┃ CHECK SUITE               ┃   │
│   ┃ (DESHABILITADO - gris)    ┃   │ ← Solo 2 módulos, no admin
│   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│   ┃                          ┃   │
│   ┃    💰 GASTO              ┃   │ ← ACTIVO
│   ┃   (Capturar foto)        ┃   │
│   ┃                          ┃   │
│   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│   ┃                          ┃   │
│   ┃   📞 COBRANZA            ┃   │ ← ACTIVO
│   ┃   (Ver riesgo, clientes) ┃   │
│   ┃                          ┃   │
│   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                     │
│  [≡ Menú] [👤 Perfil]              │
│                                     │
└─────────────────────────────────────┘

VE: Gasto + Cobranza
USO: Captura en campo, gestor en oficina
TIEMPO: Toggle entre los 2 módulos
```

### USUARIO 3: Admin/CFO (Todo autorizado)

```
┌─────────────────────────────────────┐
│                                     │
│   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│   ┃ CHECK SUITE               ┃   │
│   ┃ [≡ Módulos + Admin]       ┃   │ ← ACTIVO
│   ┃                          ┃   │   Lleva a menu expandido
│   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│   ┃                          ┃   │
│   ┃    💰 GASTO              ┃   │ ← ACTIVO
│   ┃   (Capturar foto)        ┃   │
│   ┃                          ┃   │
│   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│   ┃                          ┃   │
│   ┃   📞 COBRANZA            ┃   │ ← ACTIVO
│   ┃   (Ver riesgo, clientes) ┃   │
│   ┃                          ┃   │
│   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                     │
│  [≡ Menú] [👤 Perfil]              │
│                                     │
└─────────────────────────────────────┘

Si toca CHECK SUITE:
┌──────────────────────────────────────┐
│ Módulos Administrativos              │
├──────────────────────────────────────┤
│                                      │
│ 🏦 BancoCheck                        │
│ 📈 FlujoCheck                        │
│ 📋 FacturaCheck                      │
│ 📦 InventarioCheck                   │
│                                      │
│ ⚙️ Configuración                     │
│ 👥 Usuarios                          │
│ 📊 Reportes                          │
│ 🔐 Permisos                          │
│                                      │
│ [← Volver]                           │
│                                      │
└──────────────────────────────────────┘

VE: Gasto + Cobranza + Admin + Otros
USO: Acceso completo
PODER: Total
```

---

## 🔧 IMPLEMENTACIÓN TÉCNICA

### Home Page (Mobile)

```typescript
// app/(dashboard)/hoy/page.tsx

'use client'

import { useSessionUser } from '@/lib/hooks'
import { getVisibleModules } from '@/lib/permissions'

export default function MobileHome() {
  const user = useSessionUser()
  const visibleModules = getVisibleModules(user.role)
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header/Logo CheckSuite */}
      <HeaderLogo 
        active={visibleModules.length >= 3}  // Si hay 3+ módulos (admin)
        user={user}
      />

      {/* Divider */}
      <div className="h-1 bg-gray-200" />

      {/* Módulos visibles */}
      <div className="flex-1 flex flex-col gap-4 p-4">
        {visibleModules.map(module => (
          <ModuleButton key={module.id} module={module} />
        ))}
      </div>

      {/* Bottom nav */}
      <BottomNav user={user} />
    </div>
  )
}
```

### Permissions Config

```typescript
// lib/permissions.ts

export const ROLE_MODULES = {
  capturista: ['gasto'],
  
  jefe_cobranza: ['gasto', 'cobranza'],
  
  admin: [
    'gasto',
    'cobranza', 
    'banco',
    'flujo',
    'facturas',
    'inventario'
  ]
}

export function getVisibleModules(userRole: string) {
  const moduleIds = ROLE_MODULES[userRole] || []
  
  const allModules = [
    {
      id: 'gasto',
      label: '💰 GASTO',
      subtitle: 'Capturar foto',
      path: '/gastocheck',
      color: 'bg-emerald-500',
      adminOnly: false
    },
    {
      id: 'cobranza',
      label: '📞 COBRANZA',
      subtitle: 'Ver riesgo, clientes',
      path: '/cobracheck',
      color: 'bg-blue-500',
      adminOnly: false
    },
    {
      id: 'banco',
      label: '🏦 BANCO',
      subtitle: 'Reconciliación',
      path: '/bancocheck',
      color: 'bg-purple-500',
      adminOnly: true
    },
    // ... más módulos
  ]
  
  return allModules.filter(m => moduleIds.includes(m.id))
}

export function canAccessAdmin(userRole: string): boolean {
  return ROLE_MODULES[userRole]?.length >= 3
}
```

### Module Button Component

```typescript
// components/ModuleButton.tsx

export function ModuleButton({ module }) {
  return (
    <Link href={module.path}>
      <button className={`
        w-full py-8 rounded-lg
        ${module.color} text-white
        font-bold text-lg
        flex flex-col items-center gap-2
        active:scale-95 transition-transform
      `}>
        <div className="text-3xl">{module.label.split(' ')[0]}</div>
        <div className="text-sm opacity-90">{module.label.split(' ').slice(1).join(' ')}</div>
        <div className="text-xs opacity-75">{module.subtitle}</div>
      </button>
    </Link>
  )
}
```

### Header Logo Component

```typescript
// components/HeaderLogo.tsx

export function HeaderLogo({ active, user }) {
  const [showAdminMenu, setShowAdminMenu] = useState(false)
  
  return (
    <div className="bg-white border-b border-gray-200 p-4">
      <button
        onClick={() => setShowAdminMenu(!showAdminMenu)}
        disabled={!active}
        className={`
          w-full py-6 rounded-lg
          font-bold text-lg flex items-center justify-center gap-2
          transition-all
          ${active 
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white cursor-pointer active:scale-95' 
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }
        `}
      >
        <span>🏢</span>
        <span>CHECK SUITE</span>
        {active && <span className="text-xs ml-2">→</span>}
      </button>
      
      {/* Admin menu (expandible) */}
      {showAdminMenu && active && (
        <AdminModuleMenu user={user} onClose={() => setShowAdminMenu(false)} />
      )}
    </div>
  )
}
```

---

## 🎯 FLUJOS DE USUARIO

### Capturista (Solo Gasto)

```
1. Abre app
2. Ve:
   - CHECK SUITE (gris, deshabilitado)
   - 💰 GASTO (verde, activo)
   - 📞 COBRANZA (oculto - NO VE)
3. Toca GASTO
4. Captura foto
5. Listo
```

### Jefe Cobranza (Gasto + Cobranza)

```
Opción A - Capturar en la calle:
1. Abre app
2. Ve 2 botones activos
3. Toca GASTO
4. Captura foto
5. Vuelve a home

Opción B - Revisar cobranza en oficina:
1. Abre app
2. Ve 2 botones
3. Toca COBRANZA
4. Ve clientes en riesgo
5. Envía recordatorio
```

### Admin (Todo autorizado)

```
1. Abre app
2. Ve:
   - CHECK SUITE (AZUL, ACTIVO - botón especial)
   - 💰 GASTO
   - 📞 COBRANZA
3. Si toca CHECK SUITE:
   → Menú expandido con módulos admin
   → BancoCheck, FlujoCheck, FacturaCheck, etc.
4. Si toca GASTO o COBRANZA:
   → Va a ese módulo (como jefe cobranza)
```

---

## ✅ PRINCIPIOS

| Principio | Implementación |
|-----------|----------------|
| **Solo ves lo que puedes usar** | Renderizado dinámico por rol |
| **Sin confusión** | No hay botones grayed out |
| **Simple en la calle** | 1-2 botones máximo para capturistas |
| **Poder en admin** | CHECK SUITE logo da acceso a todo |
| **Responsive** | Mobile: botones grandes; Web: sidebar |
| **Escalable** | Agregar módulo = agregar permiso |

---

## 📱 VISUAL FINAL

```
CAPTURISTA                JEFE COBRANZA            ADMIN
─────────────────────────────────────────────────────────

[gris]                    [CHECK SUITE]            [CHECK SUITE] →
CHECK SUITE               (gris)                   Módulos admin

[verde]                   [verde]                  [verde]
💰 GASTO                  💰 GASTO                 💰 GASTO

[oculto]                  [azul]                   [azul]
(no ve)                   📞 COBRANZA              📞 COBRANZA
```

---

**Resultado:** Navegación minimalista, intuitiva, autorizado/no autorizado.

**"Solo ves lo que estás autorizado."**
