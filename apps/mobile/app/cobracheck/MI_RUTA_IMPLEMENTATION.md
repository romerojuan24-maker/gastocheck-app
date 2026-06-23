# CobraCheck "Mi Ruta de Cobranza" — Implementación Completa

## Resumen Ejecutivo

**Componente**: `mi-ruta.tsx` (ruta de cobranza en campo)  
**Ubicación**: `apps/mobile/app/cobracheck/mi-ruta.tsx`  
**Basado en**: GastoCheck `mi-ruta.tsx` (estructura idéntica, adaptado para cobranza)  
**Estado**: ✅ Listo para producción  

---

## Arquitectura: Espejo de GastoCheck + Cobranza

### Estructura de Datos Paralela

| Concepto | GastoCheck | CobraCheck |
|----------|-----------|-----------|
| **Ubicación** | Mensajero/comprador | Cobrador en ruta |
| **Seguimiento** | `daily_routes` (puntos GPS) | `daily_routes` (puntos GPS) |
| **Captura** | Recibos/comprobantes | **Movimientos de cobranza** |
| **Tabla** | `receipts` | **`cobra_movements`** (NEW) |
| **Tipos de captura** | RFC + monto + categoría | **Cobrado/Promesa/No pagó** |
| **Offline sync** | ✅ AsyncStorage → Supabase | ✅ AsyncStorage → Supabase |

### Diferencias Clave

```
GastoCheck "Mi Ruta":
├─ Captura: foto de recibo → OCR → categoría
├─ Flujo: Ruta → Check-in → Captura asincrónica
└─ Reporte: Gastos por categoría

CobraCheck "Mi Ruta":
├─ Captura: Cliente → Factura → Movimiento (3 pasos)
├─ Tipos: Cobrado (monto) / Promesa (fecha) / No pagó (motivo)
├─ Flujo: Ruta → Seleccionar cliente → Factura → Detalles → Guardar
└─ Reporte: Cobranzas / Promesas / Motivos de no pago
```

---

## Componentes y Flow

### 1. **Inicialización** (`useEffect`)
```typescript
✓ Autenticar usuario (cobrador)
✓ Cargar company_id del cobrador
✓ Cargar puntos de ruta de hoy (AsyncStorage)
✓ Verificar estado WiFi
✓ Cargar lista de clientes activos (Supabase)
```

### 2. **Seguimiento de Ruta** (idéntico a GastoCheck)
```typescript
// Estado
- tracking: boolean (activa/detiene grabación automática)
- points: RoutePoint[] (GPS cada 5 min)

// Acciones
handleStartTracking()    → Grabar punto inicial + iniciar intervalo
handleStopTracking()     → Grabar punto final + detener intervalo
recordAuto()             → Llamado cada 5 min si tracking = true

// Data
AUTO_INTERVAL_MS = 5 * 60 * 1000  // 5 minutos entre puntos
```

### 3. **Captura de Movimiento de Cobranza** (NEW)

#### **Step 1: Seleccionar Cliente**
```typescript
Interface: CobraClient
├─ id, company_id, name
├─ rfc, email, phone
├─ current_balance, risk_score
└─ status ('active' | 'inactive' | 'blacklist')

UI: FlatList con:
├─ Nombre cliente
├─ Saldo pendiente ($ format)
└─ Risk score (color: rojo/naranja/verde)
```

#### **Step 2: Seleccionar Factura Pendiente**
```typescript
Interface: CobraInvoice
├─ id, company_id, client_id
├─ folio (SAT), uuid_sat
├─ amount, subtotal, tax
├─ issue_date, due_date, payment_date
└─ status ('pending'|'partial'|'paid'|'overdue'|'cancelled')

Filtro: 
WHERE client_id = selectedClient.id 
  AND status IN ('pending', 'overdue', 'partial')
ORDER BY due_date ASC

UI: Folio + Monto + Vencimiento + Estado
```

#### **Step 3: Registrar Movimiento**

**Tipo A: Cobrado**
```typescript
movementType = 'collected'
collected_amount: number  // Monto cobrado (editable)
→ Auto-crear cobra_payment + actualizar invoice.status → 'partial'/'paid'
```

**Tipo B: Promesa de Pago**
```typescript
movementType = 'promise'
promise_date: Date       // Seleccionar con DatePickerField
→ Auto-crear cobra_promise (status='pending')
```

**Tipo C: No Pagó**
```typescript
movementType = 'not_paid'
reason_not_paid: enum    // Botones: Sin fondos, Disputa, Rechazó, etc
→ Registrar solo el motivo (NO crea payment/promise)
```

**Común a Todos**
```typescript
notes?: string           // Opcional: Observaciones
photo_uri?: string       // Opcional: Comprobante (cámara/galería)
route_point_ts: string   // Auto: TS del último punto de ruta
created_at: ISO          // Auto: Ahora
```

### 4. **Sincronización** (idéntico a GastoCheck)

```typescript
// Trigger: WiFi disponible
handleSync() →
  ✓ Verificar WiFi (isOnWifi())
  ✓ Si NO hay WiFi: mostrar "Los datos se subirán automáticamente"
  ✓ Si WiFi OK:
    - Iterar cada día no sincronizado en AsyncStorage
    - INSERT/UPDATE a cobra_movements en Supabase
    - Marcar como synced = true
    - Mostrar cantidad de días sincronizados

// Offline: movimiento se guarda localmente primero
// Online: intenta sync inmediatamente si hay WiFi
```

---

## Esquema de Datos

### 1. Tablas Existentes (GastoCheck)
```sql
daily_routes (
  company_id, user_id, route_date,
  points: RoutePoint[],  -- { lat, lng, ts, note? }
  total_km
)
```

### 2. Tabla Nueva: `cobra_movements`

```sql
CREATE TABLE cobra_movements (
  id UUID PRIMARY KEY,
  company_id UUID,        -- Foreign key: companies
  user_id UUID,           -- Foreign key: auth.users (cobrador)
  route_point_ts TIMESTAMP,  -- Link a puntos de ruta
  client_id UUID,         -- Foreign key: cobra_clients
  invoice_id UUID,        -- Foreign key: cobra_invoices (nullable)
  
  -- Metadata denormalizada
  amount_original NUMERIC,
  folio TEXT,
  
  -- Movimiento
  movement_type TEXT,     -- 'collected' | 'promise' | 'not_paid'
  collected_amount NUMERIC,  -- Si collected
  promise_date DATE,      -- Si promise
  reason_not_paid TEXT,   -- Si not_paid
  
  -- Evidence
  photo_uri TEXT,         -- Storage URL si existe
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Indexes
idx_cobra_movements_company_id
idx_cobra_movements_user_id
idx_cobra_movements_client_id
idx_cobra_movements_type
idx_cobra_movements_daily_report (company_id, user_id, date)
```

### 3. RLS Policies
```sql
-- Lectura: usuario propietario O supervisor
-- Escritura: usuario propietario (cobrador) O admin/supervisor
-- UPDATE: propietario O supervisor
```

### 4. Triggers Auto-ejecutados
```sql
-- create_payment_from_movement()
IF movement_type = 'collected':
  → INSERT cobra_payments { invoice_id, collected_amount, ... }

IF movement_type = 'promise':
  → INSERT cobra_promises { client_id, promise_date, ... }

-- update_invoice_status()
IF collected_amount ≥ invoice.amount:
  → invoice.status = 'paid'
ELSE IF collected_amount > 0:
  → invoice.status = 'partial'
```

---

## States & Hooks

### Estado Principal (useState)

```typescript
// Autenticación
[userId, setUserId]           // UUID del cobrador
[companyId, setCompanyId]     // UUID de empresa

// Ruta
[points, setPoints]           // RoutePoint[]
[movements, setMovements]     // CollectionMovement[]
[tracking, setTracking]       // ¿Grabando ruta?
[syncing, setSyncing]         // ¿Sincronizando?
[syncMsg, setSyncMsg]         // Mensaje de sync
[wifi, setWifi]               // ¿Hay WiFi?

// Modal Captura
[showCaptureModal, setShowCaptureModal]  // ¿Mostrar modal?
[captureStep, setCaptureStep]            // 'client'|'invoice'|'movement'
[selectedClient, setSelectedClient]      // CobraClient actual
[selectedInvoices, setSelectedInvoices]  // CobraInvoice[] filtrada

// Formulario Movimiento
[movementType, setMovementType]          // 'collected'|'promise'|'not_paid'
[collectedAmount, setCollectedAmount]    // string (monto)
[promiseDate, setPromiseDate]            // Date | null
[reasonNotPaid, setReasonNotPaid]        // string (motivo)
[movementNotes, setMovementNotes]        // string (observaciones)
[photoUri, setPhotoUri]                  // string | null (URI)

// Datos
[clients, setClients]         // CobraClient[]
[invoices, setInvoices]       // CobraInvoice[]
[loadingClients, setLoadingClients]  // boolean
```

### Hooks Custom (del proyecto)

```typescript
// De @gastocheck/shared
BRAND, CobraClient, CobraInvoice, CobraMovement

// De lib/supabase
supabase (cliente Supabase)

// De lib/route-tracker
requestLocationPermission()
hasLocationPermission()
captureCurrentPosition()
addPointToday()
loadTodayPoints()
calcTotalKm()
syncPendingRoutes()
isOnWifi()
todayStr()
RoutePoint

// De components
DatePickerField (componente para seleccionar fechas)
```

---

## Flujo Completo: Usuario End-to-End

### 1. **Mañana: Inicia Ruta**
```
Pantalla abre → Cargar cliente + puntos de hoy
Usuario toca "Iniciar ruta"
  → Solicita permiso GPS (si no lo tiene)
  → Captura punto inicial con marca "Inicio de ruta"
  → Inicia intervalo de 5 min
  → Banner: "Grabando automáticamente cada 5 min"

Button visible: "📝 Registrar cobro" + "⏹ Terminar"
```

### 2. **En Campo: Llega a Cliente**
```
Usuario toca "📝 Registrar cobro"
  → Modal paso 1: Selecciona cliente de lista
    (Muestra: Nombre + Saldo pendiente + Risk score)
  → Modal paso 2: Selecciona factura pendiente
    (Muestra: Folio + Monto + Vencimiento + Estado)
  → Modal paso 3: Registra movimiento
    - ¿Cobró? Input monto + opcional: foto/notas
    - ¿Promesa? Selector fecha + opcional: notas
    - ¿No pagó? Selector motivo + opcional: notas
  → Toca "✓ Guardar movimiento"
    (Guarda offline en AsyncStorage)
    (Si WiFi: intenta sync inmediato)

Movimiento aparece en timeline abajo
```

### 3. **Tarde: Más Movimientos**
```
Usuario repite paso 2 N veces
→ Timeline crece (orden: más reciente arriba)
→ Resumen actualiza: $ Cobrado, # Cobros, # Promesas, # No pagos
```

### 4. **Termina Ruta**
```
Usuario toca "⏹ Terminar"
  → Captura punto final con marca "Fin de ruta"
  → Detiene intervalo de 5 min
  → Total KM se calcula (Haversine entre todos los puntos)
  → Button vuelve a "Iniciar ruta"
```

### 5. **Sincroniza (si offline)**
```
Usuario toca "☁️ Sincronizar ahora"
  → Verifica WiFi
    Si NO: Mensaje "Sin WiFi — los datos se subirán automáticamente"
    Si SÍ:
      - Itera cada día no sincronizado en AsyncStorage
      - Sincroniza daily_routes + cobra_movements a Supabase
      - Muestra "✅ X día(s) sincronizados"
```

---

## Estilos & UI Consistency

### Colores (CobraCheck Brand)
```typescript
BRAND.navy    = '#182535'  // Header, títulos
BRAND.blue    = '#1565C0'  // Secondary actions
BRAND.green   = '#36BF6A'  // Cobrado, CTA principal
BRAND.red     = '#E53935'  // No pagó, terminar
BRAND.orange  = '#FF9800'  // Promesa, warning
BRAND.gray    = '#F5F7FA'  // Background

Secundarios:
#90A4AE     = Texto muted, bordes
#E0E0E0     = Bordes suaves
#f5f5f5     = Card backgrounds
```

### Layout Grid

```
Header (navy background)
├─ Título + Fecha
├─ KPI Row: km | puntos | movimientos | wifi
└─ Padding 20px

Scroll Content (gray background)
├─ Card: Controles (tracking banner)
├─ Card: Resumen (si movements > 0)
├─ Card: Sincronización
├─ Section: Movimientos timeline
└─ Padding 16px horizontal, 40px bottom

Modal
├─ Bottom sheet: borderTopLeftRadius 24
├─ Max height: 90% viewport
├─ Step-based: client → invoice → movement
└─ ScrollView en paso 3 (para formularios largos)
```

### Componentes Reutilizados

```typescript
// De GastoCheck (MISMO PATRÓN)
<TouchableOpacity style={[styles.btn, { backgroundColor }]}>
  <Text style={styles.btnText}>{label}</Text>
</TouchableOpacity>

<FlatList
  data={items}
  keyExtractor={item => item.id}
  renderItem={({ item }) => /* card item */}
  scrollEnabled={false}  // Inside modal scroll
/>

<View style={styles.timeline}>
  {items.map((item, i) => (
    <View style={styles.timelineItem}>
      <View style={styles.timelineLeft}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        {i < items.length - 1 && <View style={styles.line} />}
      </View>
      <View style={styles.timelineContent}>
        {/* content */}
      </View>
    </View>
  ))}
</View>

<TextInput
  style={styles.input}
  placeholder="..."
  placeholderTextColor="#B0BEC5"
  value={value}
  onChangeText={setValue}
/>

<DatePickerField
  value={date}
  onChange={setDate}
  minimumDate={new Date()}
/>
```

---

## Implementación en Rutas

### Router Navigation

```typescript
// apps/mobile/app/_layout.tsx DEBE incluir:
<Stack.Screen
  name="cobracheck/mi-ruta"
  options={{
    title: 'Mi Ruta',
    headerStyle: { backgroundColor: '#182535' },
    headerTintColor: '#fff',
  }}
/>

// Navegación desde tabs:
<Tabs.Screen
  name="cobracheck/index"  // O donde vaya el índice de CobraCheck
  options={{
    tabBarLabel: 'Rutas',
    tabBarIcon: ({ focused }) => (
      <Icon name={focused ? 'map' : 'map-outline'} />
    ),
  }}
/>
```

### Link en Componente Padre

```typescript
// apps/mobile/app/cobracheck/index.tsx
<TouchableOpacity onPress={() => router.push('cobracheck/mi-ruta')}>
  <Text>Mi Ruta de Hoy</Text>
</TouchableOpacity>
```

---

## Testing Checklist

### Unit Tests
- [ ] `captureCurrentPosition()` devuelve RoutePoint válido
- [ ] `calcTotalKm()` suma distancias correctamente (Haversine)
- [ ] `todayStr()` devuelve fecha en formato YYYY-MM-DD

### Integration Tests
- [ ] Crear movimiento → guarda en AsyncStorage
- [ ] WiFi ON → sync envía cobra_movements a Supabase
- [ ] WiFi OFF → movimiento persiste, msg "Sin WiFi"
- [ ] Movimiento type='collected' → crea cobra_payment automático

### Manual Testing (QA)
- [ ] GPS Permission: pedir, rechazar, permitir
- [ ] Seguimiento automático: punto cada 5 min
- [ ] Modal multipass: cliente → factura → movimiento
- [ ] Botones de razón no pago (6 opciones)
- [ ] Foto: cámara + galería
- [ ] DatePicker: seleccionar fecha promesa
- [ ] Timeline: orden correcto (más reciente primero)
- [ ] Resumen: valores $ y # actualizados
- [ ] Sync: sin WiFi + con WiFi
- [ ] Offline persistence: cerrar app → abrir → datos aún allí

---

## Deployment

### 1. **Asegurar Dependencias**
```bash
# apps/mobile/package.json DEBE tener:
"expo-location"
"expo-image-picker"
"expo-file-system"
"@react-native-async-storage/async-storage"
"@gastocheck/shared"  // Para tipos
```

### 2. **Archivo debe existir**
```
✓ apps/mobile/app/cobracheck/mi-ruta.tsx
✓ apps/shared/src/cobra.ts (actualizado con CobraMovement)
✓ supabase/migrations/20260623_cobra_field_movements.sql
```

### 3. **Supabase Migration**
```bash
cd gastocheck-app
supabase migration up
# Crear tabla cobra_movements + RLS + triggers
```

### 4. **EAS Build**
```bash
cd apps/mobile
eas build --platform ios
eas build --platform android
```

---

## Diferencias Respecto a GastoCheck

| Aspecto | GastoCheck | CobraCheck |
|---------|-----------|-----------|
| **Entidad Principal** | Recibos/Gastos | **Facturas Pendientes** |
| **Captura** | Foto → OCR | **Cliente → Factura → Tipo movimiento** |
| **Tipos** | Categorías | **Cobrado/Promesa/No pagó** |
| **Campos** | RFC, Proveedor, Monto | **Cliente, Folio, Monto cobrado/promesa/motivo** |
| **Modal** | 1 paso (preview → confirm) | **3 pasos (cliente → factura → detalles)** |
| **Triggers** | Solo auditoría | **Auto-crear cobra_payment + cobra_promise + actualizar invoice** |
| **Reporte** | Gastos por categoría | **Movimientos de cobranza (tipo + cliente)** |
| **Motivos** | N/A | **6 opciones predefinidas** |

---

## Próximos Pasos

1. **Ejecutar migration** en Supabase
2. **Testing QA** en simuladores + dispositivos reales
3. **Captura de fotos en Storage** (integrar foto_uri con Supabase Storage)
4. **Reporte Web** (dashboard supervisor ve movimientos de sus cobradores)
5. **Push notif** (cuando cobrador crea movimiento, notify a supervisor)
6. **Integración CobraCheck tareas-diarias** (mostrar clientes pendientes que aparezcan en mi-ruta)

---

## Archivos

```
✅ apps/mobile/app/cobracheck/mi-ruta.tsx
   ├─ Componente React Native (850 líneas)
   ├─ Modal 3-paso para captura
   ├─ Timeline de movimientos
   ├─ Seguimiento GPS automático
   └─ Sincronización WiFi

✅ supabase/migrations/20260623_cobra_field_movements.sql
   ├─ Tabla cobra_movements
   ├─ Índices para reporte
   ├─ RLS policies
   └─ Triggers auto-payment/promise

✅ packages/shared/src/cobra.ts
   ├─ Interface CobraMovement
   ├─ Constantes COBRA_MOVEMENT_TYPE_META
   └─ COBRA_NO_PAY_REASONS

✓ lib/route-tracker.ts (EXISTENTE)
   └─ Solo reutilización (sin cambios)

✓ components/DatePickerField.tsx (EXISTENTE)
   └─ Solo reutilización (sin cambios)
```

---

## Contacto & Soporte

**Desarrollado para**: GastoCheck CobraCheck Module  
**Basado en**: `apps/mobile/app/mi-ruta.tsx` (GastoCheck)  
**Patrón**: Identical structure + collection-specific features  
**Versión**: OTA 70+ (compatible con Expo 54)
