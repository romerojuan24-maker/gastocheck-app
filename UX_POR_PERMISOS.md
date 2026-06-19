# 🎯 UX POR PERMISOS — La solución CORRECTA

**Idea del usuario:** No mostrar lo que el usuario NO puede usar.

---

## 💡 EL CONCEPTO

```
❌ MALO (Lo que hacemos ahora):
┌──────────────────────────────┐
│ CHECK SUITE                  │
├──────────────────────────────┤
│ 💰 Gasto                     │
│ 📞 Cobranza                  │
│ 🏦 Banco          ← Sin acceso
│ 📈 Flujo          ← Sin acceso
│ 📋 Facturas       ← Sin acceso
│ 📦 Inventario     ← Sin acceso
└──────────────────────────────┘
Usuario confundido: "¿Por qué no puedo clickear?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ CORRECTO (Tu idea):
┌──────────────────────────────┐
│ CHECK SUITE                  │
├──────────────────────────────┤
│ 💰 Gasto                     │
│ 📞 Cobranza                  │
└──────────────────────────────┘
Usuario ve: Solo lo que puede usar.
Limpio. Simple. Lógico.
```

---

## 🎯 IMPLEMENTACIÓN POR ROL

### USUARIO 1: Capturista (solo Gasto)

```
PERMISOS:
├─ modules.gasto: true
├─ modules.cobranza: false
└─ modules.*: false

UI RESULTADO:
┌──────────────────────────────┐
│ CHECK SUITE                  │
├──────────────────────────────┤
│                              │
│   ┏━━━━━━━━━━━━━━━━━━━┓    │
│   ┃                    ┃    │
│   ┃     💰 GASTO      ┃    │
│   ┃                    ┃    │
│   ┗━━━━━━━━━━━━━━━━━━━┛    │
│                              │
│ [últimos gastos]            │
│                              │
└──────────────────────────────┘

Solo ve GASTO. Nada más.
```

### USUARIO 2: Jefe de Cobranza (Gasto + Cobranza)

```
PERMISOS:
├─ modules.gasto: true
├─ modules.cobranza: true
└─ modules.*: false

UI RESULTADO:
┌──────────────────────────────┐
│ CHECK SUITE                  │
├──────────────────────────────┤
│                              │
│ ┌─────────────┬────────────┐│
│ │             │            ││
│ │ 💰 GASTO    │ 📞 COBRANZA││
│ │             │            ││
│ └─────────────┴────────────┘│
│                              │
│ [Dashboard según contexto]  │
│                              │
└──────────────────────────────┘

Ve GASTO + COBRANZA. El resto no existe.
```

### USUARIO 3: Admin/CFO (Todo)

```
PERMISOS:
├─ modules.gasto: true
├─ modules.cobranza: true
├─ modules.banco: true
├─ modules.flujo: true
├─ modules.facturas: true
└─ modules.inventario: true

UI RESULTADO:
┌──────────────────────────────────┐
│ CHECK SUITE                      │
├──────────────────────────────────┤
│ [Menu lateral con 6 módulos]     │
│                                  │
│ 💰 Gasto                         │
│ 📞 Cobranza                      │
│ 🏦 Banco                         │
│ 📈 Flujo                         │
│ 📋 Facturas                      │
│ 📦 Inventario                    │
│ ⚙️ Configuración                 │
│                                  │
│ [Dashboard completo]             │
│                                  │
└──────────────────────────────────┘

Ve TODO. Power user.
```

---

## 🔧 IMPLEMENTACIÓN TÉCNICA

### Base de datos - Roles y permisos

```sql
CREATE TABLE role_permissions (
  role_id VARCHAR(20),
  permission_module VARCHAR(50),
  enabled BOOLEAN,
  PRIMARY KEY (role_id, permission_module)
);

-- Insertar roles
INSERT INTO role_permissions (role_id, permission_module, enabled)
VALUES
  ('capturista', 'modules.gasto', true),
  ('capturista', 'modules.cobranza', false),
  ('capturista', 'modules.banco', false),
  ('capturista', 'modules.flujo', false),
  
  ('jefe_cobranza', 'modules.gasto', true),
  ('jefe_cobranza', 'modules.cobranza', true),
  ('jefe_cobranza', 'modules.banco', false),
  ('jefe_cobranza', 'modules.flujo', false),
  
  ('admin', 'modules.gasto', true),
  ('admin', 'modules.cobranza', true),
  ('admin', 'modules.banco', true),
  ('admin', 'modules.flujo', true),
  ('admin', 'modules.facturas', true),
  ('admin', 'modules.inventario', true);
```

### Frontend - Render dinámico

```typescript
// lib/permissions.ts
export function getVisibleModules(userRole: string) {
  const modules = [
    { id: 'gasto', label: '💰 Gasto', path: '/gastocheck' },
    { id: 'cobranza', label: '📞 Cobranza', path: '/cobracheck' },
    { id: 'banco', label: '🏦 Banco', path: '/bancocheck' },
    { id: 'flujo', label: '📈 Flujo', path: '/flujocheck' },
    { id: 'facturas', label: '📋 Facturas', path: '/facturacheck' },
    { id: 'inventario', label: '📦 Inventario', path: '/inventariocheck' },
  ]

  return modules.filter(m => 
    hasPermission(userRole, `modules.${m.id}`)
  )
}

// app/(dashboard)/hoy/page.tsx
export default function Dashboard() {
  const user = useSessionUser()
  const visibleModules = getVisibleModules(user.role)

  return (
    <div className="p-6">
      <h1>CHECK SUITE</h1>
      
      {/* Solo mostrar módulos permitidos */}
      <div className="grid grid-cols-auto gap-4">
        {visibleModules.map(module => (
          <Link key={module.id} href={module.path}>
            <button className="module-button">
              {module.label}
            </button>
          </Link>
        ))}
      </div>

      {/* Sidebar (solo si 3+ módulos) */}
      {visibleModules.length >= 3 && (
        <Sidebar modules={visibleModules} />
      )}
    </div>
  )
}
```

---

## 🎨 DISEÑO RESPONSIVO

### Mobile (1-2 módulos)
```
┌──────────────────┐
│ CHECK SUITE      │
├──────────────────┤
│                  │
│ ┌──────────────┐ │
│ │ 💰 GASTO     │ │
│ └──────────────┘ │
│                  │
│ [Contenido]      │
│                  │
└──────────────────┘
```

### Mobile (3+ módulos)
```
┌──────────────────┐
│ CHECK SUITE [≡]  │
├──────────────────┤
│                  │
│ 💰 GASTO         │
│ 📞 COBRANZA      │
│ 🏦 BANCO         │
│ [← slide menu]   │
│                  │
│ [Contenido]      │
│                  │
└──────────────────┘
```

### Desktop (3+ módulos)
```
┌────────────────────────────────┐
│ CHECK SUITE          [👤]      │
├────────────────────────────────┤
│            │                   │
│ 💰 Gasto   │ [DASHBOARD]       │
│ 📞 Cobranza│                   │
│ 🏦 Banco   │ [CONTENIDO]       │
│ 📈 Flujo   │                   │
│            │                   │
└────────────────────────────────┘
```

---

## ✅ VENTAJAS DE ESTE ENFOQUE

| Ventaja | Descripción |
|---------|-------------|
| **Simple** | Usuario solo ve lo que puede usar |
| **Escalable** | Agregar módulos es solo agregar permisos |
| **Profesional** | Cada usuario ve su interfaz personalizada |
| **Sin confusión** | No hay botones deshabilitados |
| **Rápido** | Menos clics, menos opciones |
| **Flexible** | Cambiar permisos = cambiar UI automático |

---

## 📋 CONFIGURACIÓN FLEXIBLE

```typescript
// configs/roles.ts
export const ROLE_CONFIG = {
  capturista: {
    modules: ['gasto'],
    layout: 'mobile-simple', // botón gigante
    dashboard: 'gasto-summary'
  },
  
  jefe_cobranza: {
    modules: ['gasto', 'cobranza'],
    layout: 'mobile-multi', // 2 botones
    dashboard: 'cobranza-focus'
  },
  
  admin: {
    modules: ['gasto', 'cobranza', 'banco', 'flujo', 'facturas', 'inventario'],
    layout: 'desktop-full', // sidebar completo
    dashboard: 'executive-dashboard'
  }
}
```

---

## 🚀 RESULTADO FINAL

**User Authentication:**
```
1. Login → user.role = 'capturista'
2. Sistema carga permissions
3. Renderiza solo módulos permitidos
4. UI es ultrasimple (1 botón)
```

**Si mismo usuario después es promovido:**
```
1. Admin actualiza user.role = 'admin'
2. User reloads
3. Ahora ve 6 módulos + sidebar
4. Acceso completo automático
```

---

## ✅ IMPLEMENTACIÓN MVP

### FASES:

**MVP Actual (Sin cambios de código):**
- Capturista: ve Gasto (en mobile, botón gigante)
- Jefe Cobranza: ve Gasto + Cobranza (en web, ambos módulos)

**MVP + Fase 2 (5 horas de trabajo):**
- Implementar sistema de permisos
- Renderizado dinámico por rol
- Configuración flexible

**Ventaja:** Escalable de verdad

---

**TU IDEA ES CORRECTA:** Mostrar solo lo que el usuario puede usar = UX perfecta.

¿Implementamos esto desde el inicio?
