# 🔐 CHECK SUITE — Arquitectura de Visibilidad de Módulos (2026-07-04)

**Objetivo**: Módulos nuevos SOLO visibles en portal ADMIN hasta que Juan libere arquitectura  
**Usuarios Normales**: GastoCheck + CobraCheck (todo demás oculto)  
**Juan (Admin)**: Acceso a TODOS los módulos (incluyendo beta/desarrollo)

---

## 🎯 MATRIZ DE VISIBILIDAD

| Módulo | Usuarios Normales | Supervisor/Contador | Admin (Juan) | Status |
|--------|-------------------|-------------------|--------------|--------|
| **GastoCheck** | ✅ VISIBLE | ✅ VISIBLE | ✅ VISIBLE | 🟢 Producción |
| **CobraCheck** | ✅ VISIBLE | ✅ VISIBLE | ✅ VISIBLE | 🟡 Ready (beta) |
| **FacturaCheck** | ❌ OCULTO | ❌ OCULTO | ✅ VISIBLE | 🟠 Desarrollo |
| **BancoCheck** | ❌ OCULTO | ❌ OCULTO | ✅ VISIBLE | 🟠 Desarrollo |
| **CajaCheck** | ❌ OCULTO | ❌ OCULTO | ✅ VISIBLE | 🟠 Diseño |
| **InventarioCheck** | ❌ OCULTO | ❌ OCULTO | ✅ VISIBLE | 🟠 Diseño |
| **FlujoCheck** | ❌ OCULTO | ❌ OCULTO | ✅ VISIBLE | 🟠 Futuro |

**REGLA**: Cuando Juan diga "FacturaCheck liberado", cambiar a ✅ VISIBLE para todos

---

## 🏗️ ARQUITECTURA TÉCNICA

### 1. TABLA: MÓDULOS CONFIGURACIÓN

```sql
CREATE TABLE check_suite_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación
  module_key VARCHAR(50) UNIQUE NOT NULL,
  -- Valores: 'gastcheck', 'cobracheck', 'facturacheck', 
  --          'bancocheck', 'cajacheck', 'inventariocheck'
  
  module_name VARCHAR(100) NOT NULL,
  -- "GastoCheck", "CobraCheck", etc
  
  -- Visibilidad
  is_visible_to_users BOOLEAN DEFAULT false,
  -- false = solo admin ve
  
  is_visible_to_supervisors BOOLEAN DEFAULT false,
  -- false = supervisores no ven (excepto admin)
  
  is_beta BOOLEAN DEFAULT false,
  -- true = modo beta (admin testea)
  
  -- Versión
  version VARCHAR(10) DEFAULT '0.0.0',
  required_version_app VARCHAR(10),
  
  -- Metadata
  description TEXT,
  icon_name VARCHAR(50),
  color_hex VARCHAR(7),
  order_position INT,
  
  -- Control
  is_active BOOLEAN DEFAULT true,
  released_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP DEFAULT now()
);

-- Datos iniciales
INSERT INTO check_suite_modules VALUES
  ('gastcheck', 'GastoCheck', true, true, false, '1.0.2', NULL, 'Control de gastos y reembolsos', 'receipt', '#2563eb', 1, true, now()),
  ('cobracheck', 'CobraCheck', true, true, false, '0.0.1', NULL, 'Gestión de cobranzas', 'trending-up', '#10b981', 2, true, now()),
  ('facturacheck', 'FacturaCheck', false, false, true, '0.0.0', '1.0.0', 'Facturación electrónica CFDI', 'file-text', '#f59e0b', 3, true, NULL),
  ('bancocheck', 'BancoCheck', false, false, true, '0.0.0', '1.0.0', 'Reconciliación bancaria', 'bank', '#8b5cf6', 4, true, NULL),
  ('cajacheck', 'CajaCheck', false, false, true, '0.0.0', '1.0.0', 'Punto de venta + caja', 'shopping-cart', '#ec4899', 5, true, NULL),
  ('inventariocheck', 'InventarioCheck', false, false, true, '0.0.0', '1.0.0', 'Control de inventario', 'package', '#14b8a6', 6, true, NULL);
```

### 2. RLS POLICIES: Controlar Acceso

```sql
-- POLICY 1: Usuarios normales ven solo módulos públicos
CREATE POLICY "users_see_public_modules"
  ON check_suite_modules
  FOR SELECT
  USING (
    is_visible_to_users = true
    OR 
    auth.uid() IN (SELECT user_id FROM company_members WHERE role = 'admin')
  );

-- POLICY 2: Supervisores ven públicos + supervisores
CREATE POLICY "supervisors_see_allowed_modules"
  ON check_suite_modules
  FOR SELECT
  USING (
    is_visible_to_users = true
    OR 
    is_visible_to_supervisors = true
    OR 
    auth.uid() IN (SELECT user_id FROM company_members WHERE role = 'admin')
  );

-- POLICY 3: Admin ve TODO
CREATE POLICY "admin_sees_all_modules"
  ON check_suite_modules
  FOR ALL
  USING (
    auth.uid() IN (SELECT user_id FROM company_members WHERE role = 'admin')
  );
```

### 3. TABLANAVEGACIÓN: Qué ver en sidebar

```sql
CREATE TABLE check_suite_navigation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Módulos habilitados para este usuario
  visible_modules JSONB,
  -- Ejemplo: ["gastcheck", "cobracheck"]
  
  -- Orden personalizado
  module_order JSONB,
  -- Ejemplo: ["gastcheck", "cobracheck", "facturacheck"]
  
  updated_at TIMESTAMP DEFAULT now()
);

-- Function: Obtener módulos para usuario
CREATE OR REPLACE FUNCTION get_visible_modules(p_user_id UUID)
RETURNS TABLE (
  module_key VARCHAR,
  module_name VARCHAR,
  icon_name VARCHAR,
  color_hex VARCHAR,
  order_position INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.module_key,
    m.module_name,
    m.icon_name,
    m.color_hex,
    m.order_position
  FROM check_suite_modules m
  WHERE 
    m.is_active = true
    AND (
      m.is_visible_to_users = true
      OR 
      EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.user_id = p_user_id
        AND cm.role = 'admin'
      )
    )
  ORDER BY m.order_position ASC;
END;
$$ LANGUAGE plpgsql;
```

---

## 🎨 UI/UX: NAVEGACIÓN POR ROL

### USUARIO NORMAL (Empleado)
```
┌─────────────────────────────────┐
│  📱 CHECK SUITE                 │
├─────────────────────────────────┤
│ 💰 GastoCheck                   │  ← Visible
│ 📞 CobraCheck                   │  ← Visible
│                                 │
│ (Otros módulos NO aparecen)     │
└─────────────────────────────────┘
```

### SUPERVISOR (Contador)
```
┌─────────────────────────────────┐
│  📱 CHECK SUITE                 │
├─────────────────────────────────┤
│ 💰 GastoCheck                   │  ← Visible
│ 📞 CobraCheck                   │  ← Visible
│                                 │
│ (Otros módulos NO aparecen)     │
└─────────────────────────────────┘
```

### ADMIN (Juan) - Portal Especial
```
┌────────────────────────────────────────┐
│  🔐 ADMIN PORTAL                       │
├────────────────────────────────────────┤
│ 💰 GastoCheck ......................... │  ✅
│ 📞 CobraCheck ......................... │  ✅
│ 📄 FacturaCheck ....................... │  🟡 BETA
│ 🏦 BancoCheck ......................... │  🟡 BETA
│ 💳 CajaCheck .......................... │  🟠 DESARROLLO
│ 📦 InventarioCheck .................... │  🟠 DISEÑO
│ 📊 FlujoCheck ......................... │  🟠 FUTURO
├────────────────────────────────────────┤
│ [LIBERAR MÓDULO]  [AJUSTES]  [LOGS]   │
└────────────────────────────────────────┘
```

---

## 💻 CÓDIGO: COMPONENTES REACT NATIVE

### Hook: Obtener módulos visibles

```typescript
// apps/mobile/hooks/useVisibleModules.ts

import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

export function useVisibleModules() {
  const { user } = useAuth()
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        // Llamar function que retorna módulos visibles
        const { data, error } = await supabase
          .rpc('get_visible_modules', { 
            p_user_id: user.id 
          })
        
        if (error) throw error
        
        setModules(data || [])
      } finally {
        setLoading(false)
      }
    }
    
    load()
  }, [user.id])

  return { modules, loading }
}
```

### Componente: Navigation Drawer (Sidebar)

```typescript
// apps/mobile/components/NavigationDrawer.tsx

import { useVisibleModules } from '@/hooks/useVisibleModules'
import { useAuth } from '@/context/AuthContext'

export function NavigationDrawer() {
  const { modules, loading } = useVisibleModules()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  return (
    <View style={styles.drawer}>
      <View style={styles.header}>
        <Text style={styles.title}>CHECK SUITE</Text>
        {isAdmin && <Badge text="ADMIN" color="red" />}
      </View>

      <ScrollView style={styles.modules}>
        {modules.map(module => (
          <ModuleLink
            key={module.module_key}
            icon={module.icon_name}
            label={module.module_name}
            color={module.color_hex}
            onPress={() => navigateTo(module.module_key)}
          />
        ))}
      </ScrollView>

      {isAdmin && (
        <View style={styles.adminFooter}>
          <AdminButton onPress={() => navigateTo('admin')} />
        </View>
      )}
    </View>
  )
}
```

### Portal Admin: Control de Módulos

```typescript
// apps/web/app/admin/modules.tsx

export default function AdminModulesPage() {
  const [modules, setModules] = useState([])

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Gestión de Módulos</h1>

      <div className="mt-6 grid grid-cols-1 gap-4">
        {modules.map(module => (
          <ModuleCard
            key={module.id}
            module={module}
            onToggleVisibility={(visible) => 
              updateModuleVisibility(module.id, visible)
            }
            onRelease={() => releaseModule(module.id)}
            onBeta={() => toggleBeta(module.id)}
          />
        ))}
      </div>
    </div>
  )
}

// Componente individual
function ModuleCard({ module, onToggleVisibility, onRelease, onBeta }) {
  return (
    <div className="border rounded-lg p-4 flex justify-between items-center">
      <div>
        <h3 className="font-bold text-lg">{module.module_name}</h3>
        <p className="text-gray-500">{module.description}</p>
        <div className="mt-2">
          {module.is_beta && <Badge>BETA</Badge>}
          {module.released_at && <Badge>RELEASED</Badge>}
          <Badge>{module.version}</Badge>
        </div>
      </div>

      <div className="flex gap-2">
        <Toggle
          label="Visible usuarios"
          value={module.is_visible_to_users}
          onChange={onToggleVisibility}
        />
        <Button onClick={onRelease}>
          {module.released_at ? 'Liberar actualización' : 'Liberar'}
        </Button>
        <Button onClick={onBeta} variant="secondary">
          {module.is_beta ? 'Quitar beta' : 'Beta mode'}
        </Button>
      </div>
    </div>
  )
}
```

---

## 📊 FLUJO: LIBERAR MÓDULO

```
1. Juan (Admin) trabaja en FacturaCheck
   ├─ FacturaCheck visible: SOLO en admin
   ├─ Usuarios normales: NO ven nada
   └─ Supervisores: NO ven nada

2. FacturaCheck está LISTO (QA completo)
   ├─ Juan cliquea [LIBERAR] en Admin Portal
   ├─ Sistema actualiza:
   │  ├─ is_visible_to_users = true
   │  ├─ is_beta = false
   │  ├─ released_at = NOW()
   │  └─ version = "1.0.0"
   └─ Notificación enviada a usuarios

3. Próxima carga de app (usuarios):
   ├─ get_visible_modules() retorna FacturaCheck
   ├─ Sidebar se regenera
   ├─ FacturaCheck aparece para todos
   └─ Juan ya NO ve badge "BETA"

4. Nuevo módulo comienza (BancoCheck)
   ├─ Solo Juan ve en admin
   ├─ Usuarios: nada nuevo
   └─ Ciclo repite
```

---

## 🔄 TABLA: HISTORIAL DE CAMBIOS

```sql
CREATE TABLE module_release_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  module_id UUID NOT NULL REFERENCES check_suite_modules(id),
  module_key VARCHAR(50),
  
  action VARCHAR(50),
  -- 'released', 'beta_enabled', 'visibility_changed', 'version_updated'
  
  old_value JSONB,
  -- {is_visible_to_users: false, is_beta: true}
  
  new_value JSONB,
  -- {is_visible_to_users: true, is_beta: false}
  
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changed_at TIMESTAMP DEFAULT now(),
  
  notes TEXT
);

-- RLS: Solo admin ve
CREATE POLICY "admin_sees_release_log"
  ON module_release_log
  FOR SELECT
  USING (
    auth.uid() IN (SELECT user_id FROM company_members WHERE role = 'admin')
  );
```

---

## 🎯 REQUISITOS PARA DANIEL

### Semana 1 (FacturaCheck + CobraCheck)

**DB Schema** (Daniel implementa):
```sql
✅ Crear tabla: check_suite_modules
✅ Crear tabla: module_release_log
✅ Crear table: check_suite_navigation
✅ Crear function: get_visible_modules()
✅ Crear RLS policies (usuario/supervisor/admin)
✅ Insertar datos iniciales (6 módulos)
```

**Backend** (Daniel implementa):
```typescript
✅ Endpoint: GET /api/v1/modules (módulos visibles para usuario)
✅ Endpoint: POST /api/v1/admin/modules/:id/release (solo admin)
✅ Endpoint: POST /api/v1/admin/modules/:id/toggle-beta (solo admin)
✅ Endpoint: GET /api/v1/admin/modules/log (historial cambios)
✅ Hook: useVisibleModules() (obtener módulos por rol)
```

**Frontend Mobile** (Daniel implementa):
```typescript
✅ Componente: NavigationDrawer (mostrar solo módulos visibles)
✅ Hook: useVisibleModules() (obtener módulos)
✅ Lógica: Si NO visible, no aparecer en sidebar
✅ Badge: "ADMIN" si es admin
✅ Badge: "BETA" si en beta
```

**Frontend Web** (Daniel implementa):
```typescript
✅ Admin Portal: /admin/modules (gestión módulos)
✅ Componente: ModuleCard (toggle visibilidad)
✅ Componente: ReleaseButton (liberar módulo)
✅ Componente: BetaToggle (activar beta mode)
✅ Historial: Release logs (auditoría)
```

---

## 🔐 SEGURIDAD

### Política: Solo Admin

```
✅ Solo role='admin' puede:
   - Ver módulos ocultos
   - Cambiar visibilidad
   - Liberar módulos
   - Activar beta mode
   - Ver historial cambios

❌ Usuarios normales NUNCA pueden:
   - Ver módulos ocultos (RLS bloquea)
   - Acceder endpoints admin (auth middleware)
   - Cambiar configuración de módulos
   - Ver qué hay detrás (seguridad por obscuridad)
```

### Auditoría

```
✅ Cada cambio registrado en module_release_log:
   - Qué cambió
   - Quién lo hizo (changed_by)
   - Cuándo (changed_at)
   - Valores anterior/nuevo
   - Notas (opcional)

✅ Juan puede revisar: "Quién liberó qué y cuándo"
```

---

## 📋 CHECKLIST IMPLEMENTACIÓN

### Fase 1: DB Schema (Semana 1)
- [ ] Tabla check_suite_modules
- [ ] Tabla module_release_log
- [ ] Tabla check_suite_navigation
- [ ] Function get_visible_modules()
- [ ] RLS policies (3 niveles)
- [ ] Datos iniciales (6 módulos)

### Fase 2: Backend API (Semana 1)
- [ ] GET /api/v1/modules
- [ ] POST /api/v1/admin/modules/:id/release
- [ ] POST /api/v1/admin/modules/:id/toggle-beta
- [ ] GET /api/v1/admin/modules/log
- [ ] Hook useVisibleModules()

### Fase 3: Mobile UI (Semana 1)
- [ ] NavigationDrawer (filtra módulos)
- [ ] useVisibleModules hook
- [ ] Badges (ADMIN, BETA)
- [ ] Testing: usuario solo ve GastoCheck + CobraCheck

### Fase 4: Admin Portal Web (Semana 2)
- [ ] /admin/modules (lista módulos)
- [ ] ModuleCard (ver estado)
- [ ] Buttons: Release, Beta, Toggle
- [ ] Release logs (historial)
- [ ] Testing: Juan puede liberar módulos

### Fase 5: Integración (Semana 2)
- [ ] Notificación cuando módulo liberado
- [ ] Mobile recarga sidebar automáticamente
- [ ] Auditoría completa en logs

---

## 🎯 FLUJO COMPLETO: VISIBILIDAD MÓDULOS

```
┌────────────────────────────────────────────────────┐
│            ARQUITECTURA VISIBILIDAD                │
│                                                    │
│  1. check_suite_modules (config módulos)          │
│     ├─ is_visible_to_users: false (default)       │
│     ├─ is_beta: true                              │
│     └─ released_at: NULL                          │
│                                                    │
│  2. RLS Policies (control acceso)                 │
│     ├─ Usuario: WHERE is_visible_to_users = true  │
│     ├─ Supervisor: + is_visible_to_supervisors    │
│     └─ Admin: WHERE 1=1 (ve todo)                 │
│                                                    │
│  3. get_visible_modules(user_id)                  │
│     └─ Retorna solo módulos que usuario puede ver│
│                                                    │
│  4. NavigationDrawer (mobile)                     │
│     └─ Renderiza módulos retornados por función  │
│                                                    │
│  5. Admin Portal (/admin/modules)                 │
│     ├─ Muestra TODOS los módulos                 │
│     ├─ Botones: Release, Beta, Toggle            │
│     └─ Al cambiar → se propaga a usuarios        │
│                                                    │
│  6. module_release_log (auditoría)                │
│     └─ Registra cada cambio + quién + cuándo     │
└────────────────────────────────────────────────────┘
```

---

## 🚀 EJEMPLO PRÁCTICO

### Hoy (2026-07-04)

**Estado DB**:
```sql
SELECT * FROM check_suite_modules:

id | module_key      | is_visible_to_users | is_beta | released_at
---|-----------------|-------------------|---------|------------
1  | gastcheck       | true              | false   | 2026-06-28
2  | cobracheck      | true              | false   | 2026-06-30
3  | facturacheck    | false             | true    | NULL
4  | bancocheck      | false             | true    | NULL
5  | cajacheck       | false             | true    | NULL
6  | inventariocheck | false             | true    | NULL
```

**Usuario Normal ve**:
```
💰 GastoCheck
📞 CobraCheck
```

**Juan (Admin) ve**:
```
💰 GastoCheck ...................... ✅
📞 CobraCheck ...................... ✅
📄 FacturaCheck .................... 🟡 BETA (EDIT | RELEASE)
🏦 BancoCheck ...................... 🟡 BETA (EDIT | RELEASE)
💳 CajaCheck ....................... 🟠 DEV (EDIT | BETA)
📦 InventarioCheck ................. 🟠 DEV (EDIT | BETA)
```

### Cuando FacturaCheck está listo

**Juan cliquea [RELEASE] en Admin Portal**:

```typescript
// POST /api/v1/admin/modules/facturacheck/release
{
  is_visible_to_users: true,
  is_beta: false,
  released_at: "2026-08-11T14:30:00Z",
  version: "1.0.0"
}
```

**DB se actualiza** (RLS lo propaga):
```sql
UPDATE check_suite_modules 
SET is_visible_to_users = true, is_beta = false, released_at = now()
WHERE module_key = 'facturacheck';

INSERT INTO module_release_log (module_id, action, changed_by, ...)
VALUES (..., 'released', user_juan_id, ...);
```

**Próxima carga app (usuarios)**:
```typescript
// NavigationDrawer se regenera:
const modules = await get_visible_modules(user_id)
// Retorna: gastcheck, cobracheck, facturacheck

// UI se actualiza:
💰 GastoCheck
📞 CobraCheck
📄 FacturaCheck ← ¡NUEVA!
```

**Usuarios ven FacturaCheck** (sin saber que estaba en desarrollo)

---

## ✅ BENEFICIOS

✅ **Desarrollo privado**: Módulos nuevos solo Juan ve  
✅ **Sin feedback prematuro**: Usuarios no opinan en construcción  
✅ **Control total**: Juan decide cuándo liberar cada módulo  
✅ **Beta testing**: Activar beta mode para testers selectos  
✅ **Auditoría**: Saber quién liberó qué y cuándo  
✅ **Seguridad**: RLS bloquea acceso no autorizado  
✅ **Escalable**: Agregar módulos sin cambiar código  

---

**Documento**: 2026-07-04  
**Owner**: Juan (admin) + Daniel (implementación)  
**Status**: Listo para codificar

