# 🎨 CHECK SUITE — DESIGN SYSTEM DE MÓDULOS

**Objetivo**: Si aprendes a usar un módulo, sabes usar todos.

---

## 📐 ESTRUCTURA ESTÁNDAR (Todos los módulos)

```
apps/mobile/app/{modulocheck}/
├── index.tsx              ← Orquestador principal (SIEMPRE ~200L)
├── page.tsx               ← Wrapper Expo (trivial)
├── types.ts               ← Interfaces de datos
├── hooks/
│   ├── use{Modulo}.ts     ← Lógica Supabase (load, mutate, delete)
│   └── index.ts           ← Exports
├── components/
│   ├── {Entity}List.tsx   ← Listado (reutilizable)
│   ├── {Entity}Modal.tsx  ← Edición/creación (reutilizable)
│   ├── KpiCards.tsx       ← Métricas principales (reutilizable)
│   ├── {Custom}.tsx       ← Otro componente específico
│   └── index.ts           ← Exports
└── README.md              ← Documentación módulo

apps/web/app/(dashboard)/{modulocheck}/
├── page.tsx               ← Dashboard web (espejo de mobile lógica)
└── components/            ← Componentes web específicos
```

---

## 🎯 NAVEGACIÓN ESTÁNDAR (Mobile)

**Header fijo**:
```
┌─────────────────────────────────┐
│ 📦 NombreCheck                  │
│ Descripción corta               │
└─────────────────────────────────┘
```

**Contenido (ScrollView)**:
```
1. KPI Cards (3-4 métricas principales)
   └ Siempre en grid horizontal (flex-row, gap: 8)

2. Tabs (si hay múltiples vistas)
   └ Siempre: [ Tab1 ] [ Tab2 ] [ Tab3 ]
   └ Estilo: bg-1e293b, active: border-10b981

3. Filtros/búsqueda (opcional)
   └ Input with 🔍 icon left

4. Lista principal
   └ FlatList scrollEnabled={false} (scroll en padre)

5. Spacer (height: 80 para FAB)
```

**Botón flotante (FAB)**:
```
Position: absolute, bottom: 16, left/right: 16
Color: #10b981 (verde)
Text: "+ Nuevo {Entity}"
```

**Modal edición**:
```
Modal animationType="slide"
Header: Título + X close
Content: ScrollView con campos
Footer: [Guardar] [Cancelar]
```

---

## 🎨 COLORES CONSISTENTES

| Elemento | Color | Uso |
|----------|-------|-----|
| Background | #0f172a | Base |
| Surface | #1e293b | Cards, inputs |
| Border | #334155 | Divisores |
| Text primary | #f1f5f9 | Títulos |
| Text secondary | #94a3b8 | Subtítulos |
| Success | #10b981 | Ingresos, guardado |
| Warning | #f59e0b | Stock bajo, pendiente |
| Error | #ef4444 | Problemas, vencidos |
| Info | #3b82f6 | Información |
| Primary action | #10b981 | Botones principales |

---

## 📊 COMPONENTES REUTILIZABLES

### **KpiCard**
```tsx
<KpiCard 
  label="Saldo hoy" 
  value={formatCurrency(balance)} 
  color="#f1f5f9" 
/>
```

### **EntityList** (genérico)
```tsx
<ProductList|ClientList|DocumentList
  items={data}
  onEdit={setEditing}
  onDelete={handleDelete}
/>
```

### **EditModal** (genérico)
```tsx
<EditModal
  entity={editing}
  onClose={() => setEditing(null)}
  onSave={handleSave}
  saving={saving}
/>
```

### **TabBar**
```tsx
<View style={styles.tabs}>
  {TABS.map(t => (
    <TouchableOpacity
      onPress={() => setTab(t)}
      style={[styles.tab, tab === t && styles.tabActive]}
    >
      <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
        {t.label} {t.count ? `(${t.count})` : ''}
      </Text>
    </TouchableOpacity>
  ))}
</View>
```

---

## 🔗 FLUJO ESTÁNDAR DE DATOS

**Todos los módulos siguen este patrón**:

```
1. useEffect: Cargar companyId
   ↓
2. useHooks: Cargar datos de Supabase
   ↓
3. State: editing, tab, search
   ↓
4. Handlers: handleSave, handleDelete, handleFilter
   ↓
5. Render: KPIs → Tabs → Filter → List → FAB → Modal
```

---

## 📝 TIPOS ESTÁNDAR

Cada módulo define en `types.ts`:

```typescript
// Entidad principal
export interface {Entity} {
  id: string
  company_id: string
  [campos específicos]
  created_at: string
}

// Tipo de tabs (si aplica)
export type TabType = 'tab1' | 'tab2' | 'tab3'
```

---

## 🪝 HOOKS ESTÁNDAR

Cada módulo en `hooks/use{Modulo}.ts`:

```typescript
// 1. Load hook
export function use{Entity}s(companyId: string) {
  const [items, setItems] = useState<{Entity}[]>([])
  const [loading, setLoading] = useState(false)
  
  const load = useCallback(async () => {
    // Supabase query
  }, [companyId])
  
  useEffect(() => { load() }, [load])
  return { items, loading, refetch: load }
}

// 2. Mutate hook (save/delete)
export function use{Entity}Mutations(companyId: string) {
  const [saving, setSaving] = useState(false)
  
  const save = async (item: Partial<{Entity}>) => {
    // Insert or update
    return { success: boolean, error: string | null }
  }
  
  const remove = async (id: string) => {
    // Soft delete o update is_active
    return { success: boolean, error: string | null }
  }
  
  return { save, remove, saving }
}
```

---

## 🎬 INDEX.TSX ESTÁNDAR (~200L)

```typescript
export default function {ModuloCheck}Screen() {
  const insets = useSafeAreaInsets()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [tab, setTab] = useState<TabType>('tab1')
  const [editing, setEditing] = useState<Partial<{Entity}> | null>(null)
  
  const { items, refetch } = use{Entity}s(companyId || '')
  const { save, remove, saving } = use{Entity}Mutations(companyId || '')
  
  // 1. Load companyId
  useEffect(() => { /* Auth query */ }, [])
  
  // 2. Handlers
  const handleSave = async (item) => { /* save + refetch */ }
  const handleDelete = (item) => { /* Alert + remove + refetch */ }
  const handleFilter = (query) => { /* filter items */ }
  
  // 3. Computed
  const filtered = items.filter(...)
  const kpi1 = items.reduce(...)
  
  // 4. Render
  return (
    <View style={styles.container}>
      <Header title="📦 {Modulo}Check" subtitle="..." />
      <ScrollView>
        <KpiCards kpi1={kpi1} kpi2={kpi2} />
        <TabBar tabs={TABS} activeTab={tab} />
        {tab === 'tab1' ? <List1 /> : <List2 />}
        <Spacer height={80} />
      </ScrollView>
      <FAB onPress={() => setEditing({})} />
      <Modal entity={editing} onSave={handleSave} />
    </View>
  )
}
```

---

## ✅ CHECKLIST: ¿Cumple estándares?

- [ ] Estructura de carpetas = estándar
- [ ] index.tsx ~200L máximo
- [ ] KpiCards en grid horizontal
- [ ] TabBar con estilos consistentes
- [ ] List componente reutilizable
- [ ] Modal con header/content/footer
- [ ] FAB verde (#10b981) abajo derecha
- [ ] Colores según palette
- [ ] Hooks: load + mutate pattern
- [ ] useEffect: companyId → hooks → render
- [ ] Mismo UX que otros módulos

---

## 🔄 CUANDO CAMBIAS UN MÓDULO

**Cambias BancoCheck** → Aplica patrón X:
```bash
grep -r "estiloAntiguo" apps/mobile/app/*/
# Reemplazar en: FlujoCheck, InventarioCheck, FacturaCheck
```

**Objetivo**: No hay sorpresas. Usuario aprende UNA vez, usa TODO.

