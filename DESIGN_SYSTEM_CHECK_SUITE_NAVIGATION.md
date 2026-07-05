# 🎨 DESIGN SYSTEM — Navegación Estándar CHECK SUITE

**Propósito**: Garantizar consistencia visual y de UX en TODOS los módulos (GastoCheck, CobraCheck, FlujoCheck, BancoCheck, FacturaCheck)  
**Estándar**: Bottom Tab Bar con iconos + rol-based filtering  
**Aplicable a**: Todos los módulos (mobile app)

---

## 📱 ESTRUCTURA VISUAL ESTÁNDAR

### 1. HEADER (Top Bar)

```typescript
// PATRÓN ESTÁNDAR (igual para todos los módulos)

interface TopBarProps {
  moduleTitle: string;      // "GastoCheck", "FlujoCheck", etc.
  accent: string;            // Color específico módulo (BRAND.green, BRAND.blue, etc.)
  rightIcon?: string;        // Ícono derecha (⚙️, 🔔, etc.)
  onSwitcher?: () => void;   // Para admins: cambiar vista
  onRight?: () => void;      // Callback icono derecha
}

// Componente TopBar
<View style={styles.topBar}>
  <TouchableOpacity onPress={() => goBack()} style={styles.topBarBack} activeOpacity={0.7}>
    <Text style={styles.topBarBackText}>‹ CHECK SUITE</Text>    {/* SIEMPRE igual */}
  </TouchableOpacity>
  
  <View style={styles.topBarCenter}>
    <Text style={styles.topBarWordA}>{modulePart1}</Text>       {/* "Gasto", "Cobra", "Flujo" */}
    <Text style={[styles.topBarWordB, { color: accent }]}>
      {modulePart2}                                            {/* "Check" */}
    </Text>
  </View>
  
  <View style={styles.topBarRightGroup}>
    {onSwitcher && (
      <TouchableOpacity onPress={onSwitcher} style={styles.topBarIcon} activeOpacity={0.7}>
        <Text style={{ fontSize: 20 }}>👁</Text>
      </TouchableOpacity>
    )}
    <TouchableOpacity onPress={onRight} style={styles.topBarIcon} activeOpacity={0.7}>
      <Text style={{ fontSize: 20 }}>{rightIcon ?? '⚙️'}</Text>
    </TouchableOpacity>
  </View>
</View>
```

---

### 2. BOTTOM TAB BAR (Navegación Principal)

```typescript
// ESTRUCTURA POR MÓDULO

// GastoCheck (Comprador)
const TABS = [
  { icon: '📷', label: 'Capturar',    badge: 0 },
  { icon: '📋', label: 'Gastos',      badge: pendingCount },
  { icon: '💰', label: 'Saldo',       badge: 0 },
  { icon: '🏪', label: 'Proveedores', badge: 0 },
  { icon: '👤', label: 'Perfil',      badge: 0 },
];

// CobraCheck (Cobrador)
const COBRA_TABS = [
  { icon: '🗺️',  label: 'Mi Ruta',     badge: 0 },
  { icon: '📋',  label: 'Tareas',      badge: pendingTasks },
  { icon: '👥',  label: 'Clientes',    badge: 0 },
  { icon: '📊',  label: 'Historial',   badge: 0 },
  { icon: '👤',  label: 'Perfil',      badge: 0 },
];

// FlujoCheck (Admin/Contador)
const FLUJO_TABS = [
  { icon: '📊', label: 'Flujo',        badge: 0 },           // Dashboard semanal
  { icon: '💳', label: 'Créditos',     badge: overdueCount },// Gestión créditos
  { icon: '📈', label: 'Proyección',   badge: 0 },           // 12 meses
  { icon: '⚙️',  label: 'Ajustes',     badge: 0 },           // Configuración
  { icon: '👤', label: 'Perfil',       badge: 0 },           // Perfil usuario
];

// BancoCheck (Admin/Contador)
const BANCO_TABS = [
  { icon: '🏦', label: 'Cuentas',      badge: 0 },           // Conectadas
  { icon: '📄', label: 'Transacciones',badge: unmatchedCount }, // Importadas
  { icon: '🔄', label: 'Reconciliación',badge: 0 },          // Estado
  { icon: '⚙️',  label: 'Importar',    badge: 0 },           // Upload PDF/OCR
  { icon: '👤', label: 'Perfil',       badge: 0 },           // Perfil usuario
];

// FacturaCheck (Admin/Contador)
const FACTURA_TABS = [
  { icon: '🧾', label: 'CFDIs',        badge: draftCount },  // Facturas
  { icon: '📤', label: 'Distribución', badge: 0 },           // Email/WhatsApp
  { icon: '📊', label: 'Reportes',     badge: 0 },           // Análisis
  { icon: '⚙️',  label: 'Configuración',badge: 0 },          // Setup
  { icon: '👤', label: 'Perfil',       badge: 0 },           // Perfil usuario
];
```

---

### 3. BOTTOM TAB BAR RENDERING

```typescript
// COMPONENTE REUTILIZABLE

interface TabBarProps {
  tabs: Array<{ icon: string; label: string; badge: number }>;
  activeTab: number;
  onTabChange: (index: number) => void;
  accentColor: string;  // Color del módulo (BRAND.green, BRAND.blue, etc.)
}

function BottomTabBar({ tabs, activeTab, onTabChange, accentColor }: TabBarProps) {
  return (
    <View style={[styles.tabBar, { borderTopColor: accentColor + '30' }]}>
      {tabs.map((tab, i) => (
        <TouchableOpacity
          key={i}
          style={[
            styles.tabItem,
            activeTab === i && [styles.tabItemActive, { backgroundColor: accentColor + '10' }]
          ]}
          onPress={() => onTabChange(i)}
          activeOpacity={0.8}
        >
          <Text style={styles.tabIcon}>{tab.icon}</Text>
          
          {tab.badge > 0 && (
            <View style={[styles.badge, { backgroundColor: BRAND.red }]}>
              <Text style={styles.badgeText}>{tab.badge}</Text>
            </View>
          )}
          
          <Text style={[
            styles.tabLabel,
            activeTab === i ? { color: accentColor, fontWeight: '700' } : { color: '#90A4AE' }
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    paddingBottom: 8,
    paddingTop: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  tabItemActive: {
    borderRadius: 12,
    marginHorizontal: 4,
  },
  tabIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BRAND.red,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
```

---

## 🎨 COLOR SCHEME POR MÓDULO

```typescript
// CONSTANTE: Cada módulo tiene color primario + variantes

interface ModuleColors {
  primary: string;      // Color principal (fondo ciertos elementos)
  accent: string;       // Color de acentos (text, bordes)
  background: string;   // Fondo pantalla
  surface: string;      // Superficie tarjetas
}

const MODULE_COLORS: Record<string, ModuleColors> = {
  gastocheck: {
    primary: BRAND.green,      // #26A65B
    accent: BRAND.green,
    background: BRAND.gray,    // #F5F7FA
    surface: '#fff',
  },
  cobracheck: {
    primary: BRAND.cobra,      // #2ECC71 (verde cobra)
    accent: BRAND.cobra,
    background: BRAND.gray,
    surface: '#fff',
  },
  flujocheck: {
    primary: BRAND.blue,       // #3498DB
    accent: BRAND.blue,
    background: BRAND.gray,
    surface: '#fff',
  },
  bancocheck: {
    primary: '#FF6B35',        // Naranja banco
    accent: '#FF6B35',
    background: BRAND.gray,
    surface: '#fff',
  },
  facturacheck: {
    primary: '#8E44AD',        // Púrpura factura
    accent: '#8E44AD',
    background: BRAND.gray,
    surface: '#fff',
  },
};
```

---

## 📐 SPACING & LAYOUT ESTÁNDAR

```typescript
// CONSTANTES (aplicar a TODOS los módulos)

const SPACING = {
  xs: 4,     // Tiny gaps
  sm: 8,     // Small gaps
  md: 12,    // Default gap
  lg: 16,    // Large gap
  xl: 20,    // Extra large
  xxl: 24,   // Page padding
};

const SIZES = {
  borderRadius: 14,
  tabIconSize: 22,
  tabLabelSize: 11,
  topBarHeight: 60,
  tabBarHeight: 80,
  heroButtonHeight: 120,
  cardHeight: 100,
};

// Pantalla layout (SIEMPRE así)
<View style={{ flex: 1, backgroundColor: MODULE_COLORS[module].background }}>
  <TopBar ... />
  <PillBar ... />
  
  <View style={{ flex: 1 }}>
    {/* Tab content aquí */}
  </View>
  
  <BottomTabBar ... />
</View>
```

---

## 🔐 ROL-BASED TAB FILTERING

```typescript
// PATRÓN: Cada módulo muestra tabs según rol

interface TabVisibility {
  admin?: boolean;
  supervisor?: boolean;
  accountant?: boolean;
  comprador?: boolean;
  collector?: boolean;
  [key: string]: boolean | undefined;
}

// Ejemplo: FlujoCheck
const FLUJO_TAB_VISIBILITY: Record<string, TabVisibility> = {
  'flujo-dashboard': {
    admin: true,
    supervisor: true,
    accountant: true,
  },
  'creditos': {
    admin: true,
    accountant: true,
    supervisor: true,
  },
  'proyeccion': {
    admin: true,
    accountant: true,
  },
  'perfil': {
    admin: true,
    supervisor: true,
    accountant: true,
    comprador: true,
    collector: true,  // Todos ven perfil
  },
};

// En el render:
function getVisibleTabs(userRole: string, allTabs: Tab[]): Tab[] {
  return allTabs.filter(tab => {
    const visibility = FLUJO_TAB_VISIBILITY[tab.id];
    return visibility && visibility[userRole];
  });
}
```

---

## 📋 CHECKLIST: Implementar en NUEVO MÓDULO

```
☐ 1. Define module colors (MODULE_COLORS[moduleName])
☐ 2. Define tab structure (const TABS = [...])
☐ 3. Render TopBar con módulo accent
☐ 4. Render PillBar (alertas/badges)
☐ 5. Render BottomTabBar (reutilizar componente)
☐ 6. Implementar cada tab content (swappable por activeTab)
☐ 7. Agregar ProfileTab (avatar, email, rol, cerrar sesión)
☐ 8. Role-based filtering (mostrar/ocultar tabs por rol)
☐ 9. Badges dinámicos (contadores, alertas)
☐ 10. Testing: Probar en todos los roles
```

---

## 🎯 EJEMPLO: Implementar FlujoCheck siguiendo estándar

```typescript
// apps/mobile/app/flujocheck/index.tsx

export default function FlujoCheckHome() {
  const [activeTab, setActiveTab] = useState(0);
  const [userRole, setUserRole] = useState<string | null>(null);
  
  const FLUJO_TABS = [
    { icon: '📊', label: 'Flujo',        badge: 0 },
    { icon: '💳', label: 'Créditos',     badge: overdueCount },
    { icon: '📈', label: 'Proyección',   badge: 0 },
    { icon: '⚙️',  label: 'Configuración',badge: 0 },
    { icon: '👤', label: 'Perfil',       badge: 0 },
  ];
  
  const visibleTabs = getVisibleTabs(userRole, FLUJO_TABS);
  
  return (
    <View style={{ flex: 1, backgroundColor: MODULE_COLORS.flujocheck.background }}>
      <TopBar 
        moduleTitle="FlujoCheck" 
        accent={BRAND.blue}
        onSwitcher={isAdmin ? () => setShowSwitcher(true) : undefined}
      />
      <PillBar accentColor={BRAND.blue} />
      
      <View style={{ flex: 1 }}>
        {activeTab === 0 && <FlujoDashboard />}
        {activeTab === 1 && <CreditosPanel />}
        {activeTab === 2 && <ProyeccionAnual />}
        {activeTab === 3 && <ConfiguracionFlujo />}
        {activeTab === 4 && <ProfileTab accent={BRAND.blue} />}
      </View>
      
      <BottomTabBar
        tabs={visibleTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        accentColor={BRAND.blue}
      />
    </View>
  );
}
```

---

## ✅ VENTAJAS ESTÁNDAR

```
✅ Consistencia visual: Todos los módulos se ven iguales (solo colors cambian)
✅ UX predecible: Usuario sabe exactamente dónde está cada cosa
✅ Fácil de aprender: Patrón común en TODA la suite
✅ Mantenimiento: Una TopBar/TabBar componente, reutilizada en 5+ módulos
✅ Branding: CHECK SUITE identidad clara + diferenciador por módulo (color)
✅ Accesibilidad: Iconos + labels + badges consistentes
✅ Performance: Componentes ligeros, sin re-renders innecesarios
```

---

## 📱 VISUAL HIERARCHY

```
┌─────────────────────────────────────────────┐
│ ‹ CHECK SUITE    FlujoCheck    👁️  ⚙️      │ ← TopBar (altura 60)
├─────────────────────────────────────────────┤
│ ┌─ 📊 Flujo       ┬─ ⚠️ Créditos vencidos ┐│ ← PillBar
│ └────────────────┴──────────────────────┘ │
├─────────────────────────────────────────────┤
│                                             │
│   Dashboard Content (flex: 1)               │
│   Swappable por activeTab                   │
│                                             │
│                                             │
│                                             │
├─────────────────────────────────────────────┤
│ 📊      💳      📈      ⚙️      👤        │ ← BottomTabBar (altura 80)
│ Flujo   Crédit. Proy.   Config  Perfil    │
│ Flujo   ⭕ 2   Proyec.  Ajustes  Perfil   │ (con badges)
└─────────────────────────────────────────────┘
```

---

**GARANTÍA**: Aplica este estándar a TODOS los módulos → CHECK SUITE se ve como UNA sola app.

