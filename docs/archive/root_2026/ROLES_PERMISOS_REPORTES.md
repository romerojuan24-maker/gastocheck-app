# 🔐 ROLES, PERMISOS Y REPORTES

**Arquitectura:** RBAC granular + Reportes por nivel

---

## 👥 ROLES DEL SISTEMA

### 1. 🔑 ADMIN (El dueño/creador)

**Qué es:** El que crea la empresa y da permisos a todos.

**Acceso:**
- ✅ Todos los módulos (Gasto, Cobranza, Banco, Flujo, Facturas, Inventario)
- ✅ Gestión de usuarios (dar de alta, asignar roles, autorizar módulos)
- ✅ Configuración de empresa

**Reportes:**
- ✅ Reportes administrativos (auditoría, historial de cambios)
- ✅ Reportes de admin (ingresos, suscripción, uso)
- ✅ VE todos los reportes de otros niveles también

**Pantalla Mobile:**
```
┌─────────────────────────────────┐
│ [CHECK SUITE] ← AZUL (activo)   │
│   ├─ Usuarios                   │
│   ├─ Permisos                   │
│   ├─ Configuración              │
│   ├─ Reportes Admin             │
│   └─ Auditoría                  │
│                                 │
│ [💰 GASTO]                      │
│ [📞 COBRANZA]                   │
│ [🏦 BANCO]                      │
│ [📈 FLUJO]                      │
│ [📋 FACTURAS]                   │
│ [📦 INVENTARIO]                 │
│                                 │
│ [≡ Menú] [👤 Perfil]           │
└─────────────────────────────────┘
```

---

### 2. 👔 SUPERVISOR (Jefe de equipo)

**Qué es:** Puede ver todo pero no da permisos.

**Acceso:**
- ✅ Todos los módulos (Gasto, Cobranza, Banco, Flujo, Facturas, Inventario)
- ✅ NO puede dar de alta usuarios
- ✅ NO puede asignar permisos
- ❌ No ve configuración de empresa
- ❌ No ve usuarios del sistema

**Reportes:**
- ✅ Reportes de supervisión (resumen de equipo, actividad por usuario)
- ✅ VE sus propios reportes de módulos
- ❌ NO ve reportes administrativos

**Pantalla Mobile:**
```
┌─────────────────────────────────┐
│ [CHECK SUITE] ← GRIS (desact.)  │
│   (no puede dar permisos)       │
│                                 │
│ [💰 GASTO]                      │
│ [📞 COBRANZA]                   │
│ [🏦 BANCO]                      │
│ [📈 FLUJO]                      │
│ [📋 FACTURAS]                   │
│ [📦 INVENTARIO]                 │
│                                 │
│ [≡ Menú - Reportes Supervisor] │
│ [👤 Perfil]                     │
└─────────────────────────────────┘
```

---

### 3. 🔧 OPERADOR (Empleado con acceso limitado)

**Qué es:** Acceso a máximo 2 módulos, autorizado uno por uno por admin.

**Acceso:**
- ⚙️ **Máximo 2 módulos** (definidos por admin)
- Cada módulo debe estar **explícitamente autorizado**
- Ejemplos:
  - Operador A: Gasto + Cobranza
  - Operador B: Solo Gasto
  - Operador C: Solo Cobranza
- ❌ No puede ver módulos no autorizados

**Reportes:**
- ✅ Reportes de operador (solo de sus módulos autorizados)
- Ejemplo: Si tiene Gasto + Cobranza:
  - Reporte de gastos capturados
  - Reporte de cobranzas realizadas
  - NO ve reportes de Banco, Flujo, etc.

**Pantalla Mobile (Ejemplo: Operador con Gasto + Cobranza):**
```
┌─────────────────────────────────┐
│ [CHECK SUITE] ← GRIS (desact.)  │
│   (no puede ver admin)          │
│                                 │
│ [💰 GASTO] ← Autorizado         │
│ [📞 COBRANZA] ← Autorizado      │
│                                 │
│ [🏦 BANCO] ← OCULTO             │
│ [📈 FLUJO] ← OCULTO             │
│ [📋 FACTURAS] ← OCULTO          │
│ [📦 INVENTARIO] ← OCULTO        │
│                                 │
│ [≡ Menú] [👤 Perfil]           │
└─────────────────────────────────┘
```

**Pantalla Mobile (Ejemplo: Operador con Solo Gasto):**
```
┌─────────────────────────────────┐
│ [CHECK SUITE] ← GRIS            │
│                                 │
│ [💰 GASTO] ← Solo esto          │
│                                 │
│ [📞 COBRANZA] ← OCULTO          │
│ (resto oculto)                  │
│                                 │
│ [≡ Menú] [👤 Perfil]           │
└─────────────────────────────────┘
```

---

### 4. 📊 CAPTURISTA (Rol especial - implícito en operador)

**Qué es:** Operador con acceso a Solo Gasto O Solo Cobranza.

**Acceso:**
- 💰 Solo Gasto (captura de comprobantes)
- O 📞 Solo Cobranza (gestión de clientes)
- Decide el admin

**Reportes:**
- ✅ Reporte básico de su módulo

---

## 📋 MATRIZ DE PERMISOS

```
                  ADMIN  SUPERVISOR  OPERADOR  CAPTURISTA
                  ─────────────────────────────────────────
Gasto              ✅       ✅         ⚙️        ⚙️
Cobranza           ✅       ✅         ⚙️        ⚙️
Banco              ✅       ✅         ❌        ❌
Flujo              ✅       ✅         ❌        ❌
Facturas           ✅       ✅         ❌        ❌
Inventario         ✅       ✅         ❌        ❌

Dar de alta        ✅       ❌         ❌        ❌
Asignar roles      ✅       ❌         ❌        ❌
Autorizar módulos  ✅       ❌         ❌        ❌
Ver config         ✅       ❌         ❌        ❌
Ver usuarios       ✅       ❌         ❌        ❌

✅ = Acceso completo
⚙️ = Acceso autorizado por admin
❌ = Sin acceso
```

---

## 📊 REPORTES POR NIVEL

### ADMIN REPORTS (Solo Admin)
```
├─ Usuarios activos por empresa
├─ Historial de cambios (auditoría)
├─ Uso de API / Transacciones
├─ Facturación y suscripción
├─ Módulos autorizados por usuario
├─ Logs de acceso
├─ Errores y excepciones
└─ Dashboard administrativo
```

### SUPERVISOR REPORTS (Supervisor)
```
├─ Actividad del equipo (hoy, semana, mes)
├─ Gastos capturados por operador
├─ Cobranzas realizadas por operador
├─ Clientes contactados
├─ Promedio de tiempo por operador
├─ Tasa de error / rechazos
├─ KPIs de equipo
└─ Dashboard de supervisión
```

### OPERADOR REPORTS (Operador)
```
Si tiene Gasto:
├─ Mis gastos capturados (hoy, semana, mes)
├─ Total capturado
├─ Promedio por gasto
├─ Categorías más usadas
└─ Exportar mis gastos

Si tiene Cobranza:
├─ Clientes que contacté
├─ Promesas registradas
├─ Montos recovrados
├─ Clientes en riesgo
└─ Mis acciones hoy
```

### CAPTURISTA REPORTS (Básico)
```
├─ Total gastos capturados
├─ Últimos 10 gastos
└─ Exportar gastos
```

---

## 🔧 FLUJO DE AUTORIZACIÓN DE MÓDULOS

### Paso 1: Admin crea usuario (da de alta invitado)

```
Admin panel:
┌─────────────────────────────────┐
│ Invitar nuevo usuario           │
├─────────────────────────────────┤
│                                 │
│ Email: operador@empresa.com     │
│ Rol:   OPERADOR   [▼]           │
│                                 │
│ [ Enviar invitación ]           │
│                                 │
└─────────────────────────────────┘

Sistema:
- Crea usuario con rol OPERADOR
- SIN módulos autorizados aún
- Envía link de invitación por email
```

### Paso 2: Usuario acepta invitación

```
Email recibido:
┌──────────────────────────────┐
│ Te invitaron a CHECK SUITE   │
│                              │
│ Empresa: Tu Empresa SAS      │
│ Rol: OPERADOR                │
│ Módulos: (pendiente)         │
│                              │
│ [Click aquí para aceptar]   │
│                              │
└──────────────────────────────┘

Usuario hace click:
- Configura contraseña
- Se loguea
- VE: "Esperando que admin autorice módulos"
```

### Paso 3: Admin autoriza módulos

```
Admin en sistema:
┌──────────────────────────────────────┐
│ USUARIOS Y PERMISOS                  │
├──────────────────────────────────────┤
│                                      │
│ operador@empresa.com (OPERADOR)      │
│ ✘ Módulos: NINGUNO                   │
│                                      │
│ [ Autorizar módulos ]                │
│                                      │
└──────────────────────────────────────┘

Si hace click:
┌──────────────────────────────────────┐
│ Autorizar módulos para operador@...  │
├──────────────────────────────────────┤
│                                      │
│ ☐ Gasto                             │
│ ☐ Cobranza                          │
│ ☐ Banco                             │
│ ☐ Flujo                             │
│ ☐ Facturas                          │
│ ☐ Inventario                        │
│                                      │
│ [ Guardar permisos ]                │
│                                      │
└──────────────────────────────────────┘

Admin marca:
☑ Gasto
☑ Cobranza
(deja el resto sin marcar)

[ Guardar ]
```

### Paso 4: Usuario ve módulos autorizados

```
Operador ahora ve:

ANTES:
"Esperando autorización..."

DESPUÉS:
┌──────────────────────────────┐
│ [CHECK SUITE] (gris)         │
│                              │
│ [💰 GASTO] ✅ NUEVO          │
│ [📞 COBRANZA] ✅ NUEVO       │
│                              │
│ (resto oculto)               │
│                              │
│ [≡ Menú] [👤 Perfil]        │
└──────────────────────────────┘

✅ Puede usar ambos módulos
✅ Ve reportes de ambos
❌ No ve otros módulos
❌ No puede cambiar permisos
```

---

## 💾 BASE DE DATOS

### Tabla: `roles`
```sql
CREATE TABLE roles (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP DEFAULT now()
);

INSERT INTO roles VALUES
  ('admin', 'Administrador', 'Acceso completo'),
  ('supervisor', 'Supervisor', 'Ve todo pero no da permisos'),
  ('operador', 'Operador', 'Acceso limitado a módulos autorizados'),
  ('capturista', 'Capturista', 'Solo captura de gastos');
```

### Tabla: `user_roles`
```sql
CREATE TABLE user_roles (
  user_id UUID,
  company_id UUID,
  role_id VARCHAR(20),
  assigned_by UUID,
  assigned_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (user_id, company_id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (assigned_by) REFERENCES auth.users(id)
);
```

### Tabla: `module_permissions`
```sql
CREATE TABLE module_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  company_id UUID,
  module_id VARCHAR(50),  -- 'gasto', 'cobranza', etc
  authorized BOOLEAN DEFAULT false,
  authorized_by UUID,
  authorized_at TIMESTAMP DEFAULT now(),
  
  FOREIGN KEY (user_id) REFERENCES auth.users(id),
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (authorized_by) REFERENCES auth.users(id),
  UNIQUE (user_id, company_id, module_id)
);
```

---

## 🔄 LÓGICA DE NAVEGACIÓN

```typescript
// lib/permissions.ts

export function getVisibleModules(user) {
  const baseModules = {
    'admin': ['gasto', 'cobranza', 'banco', 'flujo', 'facturas', 'inventario'],
    'supervisor': ['gasto', 'cobranza', 'banco', 'flujo', 'facturas', 'inventario'],
    'operador': [], // Empty - se cargan desde DB
    'capturista': []
  }

  // Si es admin o supervisor, retornar todos
  if (['admin', 'supervisor'].includes(user.role)) {
    return baseModules[user.role]
  }

  // Si es operador, cargar desde DB
  const authorizedModules = await supabase
    .from('module_permissions')
    .select('module_id')
    .eq('user_id', user.id)
    .eq('company_id', user.company_id)
    .eq('authorized', true)

  return authorizedModules.data.map(p => p.module_id)
}

export function canAccessModule(user, moduleId) {
  const visibleModules = getVisibleModules(user)
  return visibleModules.includes(moduleId)
}

export function canManagePermissions(user) {
  return user.role === 'admin'
}

export function canManageUsers(user) {
  return user.role === 'admin'
}
```

---

## 📊 REPORTES - IMPLEMENTACIÓN

```typescript
// lib/reports.ts

export async function getReportsForUser(user) {
  const reports = []

  if (user.role === 'admin') {
    reports.push(
      { id: 'admin-users', name: 'Usuarios activos', type: 'admin' },
      { id: 'admin-audit', name: 'Auditoría', type: 'admin' },
      { id: 'admin-billing', name: 'Facturación', type: 'admin' }
    )
  }

  if (['admin', 'supervisor'].includes(user.role)) {
    reports.push(
      { id: 'supervisor-team', name: 'Actividad del equipo', type: 'supervisor' },
      { id: 'supervisor-kpis', name: 'KPIs', type: 'supervisor' }
    )
  }

  if (user.role === 'operador') {
    const modules = getVisibleModules(user)
    
    if (modules.includes('gasto')) {
      reports.push(
        { id: 'op-gasto-hoy', name: 'Gastos hoy', type: 'operador' },
        { id: 'op-gasto-mes', name: 'Gastos mes', type: 'operador' }
      )
    }
    
    if (modules.includes('cobranza')) {
      reports.push(
        { id: 'op-cobranza-hoy', name: 'Cobranzas hoy', type: 'operador' },
        { id: 'op-clientes-riesgo', name: 'Clientes en riesgo', type: 'operador' }
      )
    }
  }

  return reports
}
```

---

## ✅ FLUJO COMPLETO

```
1. ADMIN crea empresa
   └─ Es ADMIN automáticamente

2. ADMIN invita operador
   └─ Operador recibe email
   └─ Aún sin módulos

3. ADMIN autoriza módulos
   └─ Selecciona: Gasto + Cobranza
   └─ Guarda permisos

4. OPERADOR se loguea
   └─ Ve: Botón Gasto + Botón Cobranza
   └─ NO ve: Banco, Flujo, etc.
   └─ Reportes: Solo de sus módulos

5. ADMIN invita supervisor
   └─ Supervisor automáticamente ve TODO
   └─ NO puede dar permisos
   └─ Ve reportes de supervisión

6. ADMIN invita capturista
   └─ Autoriza solo Gasto
   └─ Capturista ve solo botón Gasto
```

---

## 🎯 VENTAJAS

- ✅ Control granular por admin
- ✅ Cada usuario ve SOLO lo autorizado
- ✅ Sin confusión
- ✅ Reportes especializados por rol
- ✅ Escalable (agregar módulo = agregar permiso)
- ✅ Seguridad: no ve lo que no puede usar

**"Solo ves lo que estás autorizado."**
