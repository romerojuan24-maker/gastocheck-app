# GastoCheck Mobile - Pantalla "Mi Ruta" (Captura de Gastos en Campo)

## Descripción General

La pantalla "Mi Ruta" es el core de la experiencia mobile para cobradores de CobraCheck. Permite:

1. **Listar clientes asignados** en una ruta optimizada (orden, distancia, ETA)
2. **Navegar con Google Maps** directamente desde cada cliente
3. **Capturar intentos de cobro** (pagó/no pagó/promesa) con detalles
4. **Escanear tickets** con Gemini Vision para auto-llenar monto/fecha/proveedor
5. **Registrar depósitos de efectivo** y referencias
6. **Generar reporte diario** para enviar al supervisor

## Componentes React Native

### 1. RouteList
Lista de clientes con UI optimizada para campo:
- Número secuencial (1, 2, 3...)
- Nombre cliente + dirección
- Horarios de oficina
- Cantidad de recibos + monto total
- Distancia y ETA
- Badge de estado (Pendiente ⏳ / Visitado 👁️ / Completado ✅)

```tsx
<RouteList
  clients={route}
  onSelectClient={handleSelectClient}
  loading={routeLoading}
/>
```

### 2. ClientDetail (Modal)
Detalles completos del cliente con acciones principales:
- Nombre, dirección, teléfono, horarios
- Documentos pendientes
- Botón "📍 Google Maps" → Abre Maps en lat/lng
- Botón "📸 Escanear Ticket" → Modal scanner
- Botón "💳 Registrar Intento" → Modal movimiento

```tsx
<ClientDetail
  client={selectedClient}
  visible={showClientDetail}
  onClose={() => setShowClientDetail(false)}
  onOpenMaps={handleOpenMaps}
  onStartMovement={() => setShowMovementForm(true)}
  onScanTicket={() => setShowScanner(true)}
/>
```

### 3. ScannerModal
Captura y análisis de fotos de tickets:
- Botón "📸 Tomar Foto" abre cámara
- Preview de imagen
- Llamada a Gemini Vision API
- Muestra resultados: monto, fecha, proveedor, confianza
- "✓ Confirmar" → Pasa datos a MovementForm

```tsx
<ScannerModal
  visible={showScanner}
  onClose={() => setShowScanner(false)}
  onScanResult={handleScanResult}
/>
```

### 4. MovementForm (Modal)
Registro detallado del intento de cobro:
- **Estado**: Botones radio (✓ Pagó / ✕ No Pagó / 🤝 Promesa)
  - Si **Pagó**: seleccionar método (💵 Efectivo / 💳 Transferencia / 📄 Cheque / 🏦 Tarjeta)
  - Si **No Pagó**: campo de motivo (textarea)
  - Si **Promesa**: campo de fecha (YYYY-MM-DD)
- **Monto**: pre-llenado de ScannerResult
- **Notas**: opcional
- Botones: Cancelar / Guardar Intento

```tsx
<MovementForm
  client={selectedClient}
  scanResult={scanResult}
  visible={showMovementForm}
  onClose={() => setShowMovementForm(false)}
  onSubmit={handleSubmitMovement}
/>
```

### 5. ReportSummary (Modal)
Resumen diario y depósitos:
- Grid de stats:
  - Clientes Visitados
  - Total Cobrado
  - Depósitos
  - Promesas
- Campos para depósito de efectivo:
  - Monto depositado
  - Referencia (comprobante)
- Botón "📤 Enviar a Supervisor"

```tsx
<ReportSummary
  visible={showReport}
  onClose={() => setShowReport(false)}
  onSubmit={handleSubmitReport}
  stats={stats}
/>
```

## Hooks Personalizados

### useRoute(actorId: string, date: string)
```typescript
const { route, loading, error, refetch } = useRoute(user?.id || '', today)

// Retorna:
interface UseRouteResult {
  route: RouteClient[]         // Clientes del día ordenados
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}
```

**Lógica:**
- Consulta `daily_routes` con `actor_id` + `route_date`
- JOIN a `cobra_clients` (lat, lng, address, phone, office_hours)
- JOIN a `cobra_invoices` (contar y sumar monto)
- Ordena por `sequence`
- Calcula distancia y ETA desde Google Maps Distance Matrix

**Tabla SQL:**
```sql
SELECT
  dr.id,
  dr.client_id,
  dr.sequence,
  dr.distance_km,
  dr.eta_minutes,
  dr.status,
  cc.name,
  cc.lat,
  cc.lng,
  cc.address,
  cc.phone,
  cc.office_hours,
  COUNT(ci.id) as invoices_count,
  COALESCE(SUM(ci.amount), 0) as total_amount
FROM daily_routes dr
JOIN cobra_clients cc ON dr.client_id = cc.id
LEFT JOIN cobra_invoices ci ON cc.id = ci.client_id AND ci.status IN ('pending', 'partial')
WHERE dr.actor_id = $1 AND dr.route_date = $2
GROUP BY dr.id, cc.id
ORDER BY dr.sequence ASC;
```

---

### useScanner(imageUri: string | null)
```typescript
const { result, loading, error } = useScanner(imageUri)

// Retorna:
interface UseScannerResult {
  result: ScannerResult | null   // { amount, date, provider, confidence }
  loading: boolean
  error: string | null
}
```

**Lógica:**
- Convierte imagen a base64
- POST a `/api/vision/scan` (Gemini Vision API)
- Extrae: monto, fecha, nombre empresa/proveedor
- Retorna confianza (0.0 a 1.0)

**Endpoint esperado:**
```
POST /api/vision/scan
Content-Type: application/json

{
  "image": "data:image/jpeg;base64,...",
  "language": "es"
}

// Response:
{
  "amount": 1500.00,
  "date": "2026-06-23",
  "provider": "EMPRESA XYZ S.A.",
  "confidence": 0.95,
  "raw_text": "..."
}
```

---

### useMovementCapture()
```typescript
const { capture, loading, error } = useMovementCapture()

// Uso:
const movement = await capture({
  client_id: "uuid",
  actor_id: "uuid",
  status: "paid",
  amount: 1500,
  method: "cash",
  notes: "Pagó con efectivo"
})
```

**Lógica:**
- INSERT en `cobra_movements`
- Auto-calcula `movement_date` = ahora
- Valida que `status` sea uno de: 'paid', 'unpaid', 'promise'
- Si `status === 'paid'`: requiere `method`
- Si `status === 'unpaid'`: requiere `unpaid_reason`
- Si `status === 'promise'`: requiere `promise_date`

**Tabla:**
```sql
CREATE TABLE cobra_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES cobra_clients(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES cobra_invoices(id),
  actor_id UUID NOT NULL REFERENCES company_members(id) ON DELETE CASCADE,
  movement_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('paid', 'unpaid', 'promise')),
  amount DECIMAL(10, 2) NOT NULL,
  method TEXT CHECK (method IN ('cash', 'transfer', 'check', 'card')),
  payment_date TIMESTAMPTZ,
  unpaid_reason TEXT,
  promise_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cobra_movements_actor_date 
ON cobra_movements(actor_id, movement_date DESC);
```

---

### useDailyReport()
```typescript
const { generate, loading, error } = useDailyReport()

// Uso:
const report = await generate(user.id, "2026-06-23")

// Retorna:
interface DailyReport {
  actor_id: string
  report_date: string         // "2026-06-23"
  clients_visited: number
  total_collected: number     // MXN
  cash_deposits: DailyCash[]  // [{ amount, deposit_date, reference }]
  promises_made: number
  movements: Movement[]
  created_at: string
}
```

**Lógica:**
- Busca reporte existente en `cobra_daily_reports`
- Si existe, retorna (puede actualizar después)
- Si no existe, crea uno nuevo con 0 stats (se carga luego)

**Tabla:**
```sql
CREATE TABLE cobra_daily_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL REFERENCES company_members(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  clients_visited INT DEFAULT 0,
  total_collected DECIMAL(10, 2) DEFAULT 0,
  promises_made INT DEFAULT 0,
  notes TEXT,
  submitted_to_id UUID REFERENCES company_members(id),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(actor_id, report_date)
);
```

---

## Flujo de Uso Completo

### Inicio del Día
1. Cobrador abre app → "Mi Ruta"
2. `useRoute()` carga ruta optimizada del día
3. Muestra lista de N clientes con orden, distancia, ETA
4. Header muestra progreso: "0/5 visitados"

### Para Cada Cliente
1. **Tap en cliente** → Abre `ClientDetail` modal
2. **Opción "📍 Google Maps"** → `Linking.openURL()` a maps://
3. **Opción "📸 Escanear Ticket"** → Abre `ScannerModal`
   - Toma foto → Gemini Vision → auto-completa monto/fecha/proveedor
   - Confirma resultados
4. **Opción "💳 Registrar Intento"** → Abre `MovementForm`
   - Monto pre-llenado de scanner
   - Selecciona estado: Pagó ✓ / No Pagó ✕ / Promesa 🤝
   - Si Pagó: método (Efectivo/Transferencia/Cheque/Tarjeta)
   - Si No Pagó: motivo de no pago
   - Si Promesa: fecha de promesa
   - Guarda → `useMovementCapture()` → INSERT cobra_movements
5. Cliente marca estado en RouteList (Visitado 👁️)

### Final del Día
1. **Tap "📊 Reporte Diario"** → Abre `ReportSummary`
2. Muestra stats calculados:
   - Clientes visitados (count DISTINCT client_id)
   - Total cobrado (SUM amount WHERE status='paid')
   - Depósitos de efectivo (SUM amount WHERE method='cash')
   - Promesas hechas (count WHERE status='promise')
3. Opcionalmente: ingresa depósito de efectivo (monto + referencia)
4. **"📤 Enviar a Supervisor"** → Genera PDF/email y marca como enviado

---

## Tablas Supabase Necesarias

### 1. daily_routes (Nueva)
Ruta optimizada diaria generada por algoritmo backend.

```sql
CREATE TABLE daily_routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES company_members(id) ON DELETE CASCADE,
  route_date DATE NOT NULL,
  client_id UUID NOT NULL REFERENCES cobra_clients(id) ON DELETE CASCADE,
  sequence INT NOT NULL,
  distance_km DECIMAL(8, 2),
  eta_minutes INT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'visited', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(actor_id, route_date, client_id)
);

CREATE INDEX idx_daily_routes_actor_date ON daily_routes(actor_id, route_date);
```

### 2. cobra_movements (Nueva)
Registra cada intento de cobro en campo.

```sql
CREATE TABLE cobra_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES cobra_clients(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES cobra_invoices(id),
  actor_id UUID NOT NULL REFERENCES company_members(id) ON DELETE CASCADE,
  movement_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('paid', 'unpaid', 'promise')),
  amount DECIMAL(10, 2) NOT NULL,
  method TEXT CHECK (method IN ('cash', 'transfer', 'check', 'card')),
  payment_date TIMESTAMPTZ,
  unpaid_reason TEXT,
  promise_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cobra_movements_actor_date ON cobra_movements(actor_id, movement_date DESC);
CREATE INDEX idx_cobra_movements_client ON cobra_movements(client_id);
```

### 3. cobra_daily_reports (Nueva)
Resumen diario enviado a supervisor.

```sql
CREATE TABLE cobra_daily_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES company_members(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  clients_visited INT DEFAULT 0,
  total_collected DECIMAL(10, 2) DEFAULT 0,
  promises_made INT DEFAULT 0,
  cash_deposited DECIMAL(10, 2) DEFAULT 0,
  cash_deposit_ref TEXT,
  notes TEXT,
  submitted_to_id UUID REFERENCES company_members(id),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(actor_id, report_date)
);

CREATE INDEX idx_cobra_daily_reports_date ON cobra_daily_reports(report_date);
```

### 4. cobra_cash_deposits (Nueva)
Registro de depósitos de efectivo realizados.

```sql
CREATE TABLE cobra_cash_deposits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES company_members(id) ON DELETE CASCADE,
  report_id UUID REFERENCES cobra_daily_reports(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  deposit_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reference TEXT,
  bank_account_id UUID,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cobra_cash_deposits_actor_date 
ON cobra_cash_deposits(actor_id, deposit_date DESC);
```

---

## RLS Policies

### daily_routes
```sql
CREATE POLICY "Cobrador ve su propia ruta"
ON daily_routes FOR SELECT
USING (
  auth.uid() = (
    SELECT auth_id FROM company_members WHERE id = actor_id
  )
);
```

### cobra_movements
```sql
CREATE POLICY "Cobrador crea sus propios movimientos"
ON cobra_movements FOR INSERT
WITH CHECK (
  auth.uid() = (
    SELECT auth_id FROM company_members WHERE id = actor_id
  )
);

CREATE POLICY "Cobrador ve sus movimientos"
ON cobra_movements FOR SELECT
USING (
  auth.uid() = (
    SELECT auth_id FROM company_members WHERE id = actor_id
  )
  OR
  auth.uid() IN (
    SELECT auth_id FROM company_members 
    WHERE company_id = cobra_movements.company_id AND role = 'supervisor'
  )
);
```

### cobra_daily_reports
```sql
CREATE POLICY "Cobrador crea su reporte"
ON cobra_daily_reports FOR INSERT
WITH CHECK (
  auth.uid() = (
    SELECT auth_id FROM company_members WHERE id = actor_id
  )
);

CREATE POLICY "Supervisor ve reportes de su equipo"
ON cobra_daily_reports FOR SELECT
USING (
  auth.uid() IN (
    SELECT auth_id FROM company_members cm
    WHERE cm.company_id = cobra_daily_reports.company_id
    AND cm.role IN ('supervisor', 'admin')
  )
);
```

---

## Estilos: Dark Mode + Botones Grandes

### Colores CobraCheck
- **Verde primario**: `#36BF6A` (calls-to-action, stats)
- **Navy oscuro**: `#182535` (header, backgrounds)
- **Slate 800**: `#0f172a` (fondo principal)
- **Slate 700**: `#1e293b` (cards, inputs)
- **Texto claro**: `#f1f5f9` (headlines), `#cbd5e1` (body)

### Tamaños de Botones
- Mínimo 50px de altura
- Padding: 14px vertical, 16px horizontal
- Fuente: 16px bold
- Bordes redondeados: 10px
- Gap entre botones: 8px

### Inputs
- Altura mínima: 48px
- Padding: 12px
- Fuente: 16px
- Bordes: 1px solid `#334155`
- Background: `#1e293b`

---

## Migraciones SQL

```sql
-- Migración: 20260623_gastocheck_ruta.sql

-- 1. daily_routes
CREATE TABLE IF NOT EXISTS daily_routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES company_members(id) ON DELETE CASCADE,
  route_date DATE NOT NULL,
  client_id UUID NOT NULL REFERENCES cobra_clients(id) ON DELETE CASCADE,
  sequence INT NOT NULL,
  distance_km DECIMAL(8, 2),
  eta_minutes INT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'visited', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(actor_id, route_date, client_id)
);
CREATE INDEX idx_daily_routes_actor_date ON daily_routes(actor_id, route_date);

-- 2. cobra_movements
CREATE TABLE IF NOT EXISTS cobra_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES cobra_clients(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES cobra_invoices(id),
  actor_id UUID NOT NULL REFERENCES company_members(id) ON DELETE CASCADE,
  movement_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('paid', 'unpaid', 'promise')),
  amount DECIMAL(10, 2) NOT NULL,
  method TEXT CHECK (method IN ('cash', 'transfer', 'check', 'card')),
  payment_date TIMESTAMPTZ,
  unpaid_reason TEXT,
  promise_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cobra_movements_actor_date ON cobra_movements(actor_id, movement_date DESC);
CREATE INDEX idx_cobra_movements_client ON cobra_movements(client_id);

-- 3. cobra_daily_reports
CREATE TABLE IF NOT EXISTS cobra_daily_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES company_members(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  clients_visited INT DEFAULT 0,
  total_collected DECIMAL(10, 2) DEFAULT 0,
  promises_made INT DEFAULT 0,
  cash_deposited DECIMAL(10, 2) DEFAULT 0,
  cash_deposit_ref TEXT,
  notes TEXT,
  submitted_to_id UUID REFERENCES company_members(id),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(actor_id, report_date)
);
CREATE INDEX idx_cobra_daily_reports_date ON cobra_daily_reports(report_date);

-- 4. cobra_cash_deposits
CREATE TABLE IF NOT EXISTS cobra_cash_deposits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES company_members(id) ON DELETE CASCADE,
  report_id UUID REFERENCES cobra_daily_reports(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  deposit_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reference TEXT,
  bank_account_id UUID,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cobra_cash_deposits_actor_date ON cobra_cash_deposits(actor_id, deposit_date DESC);

-- 5. RLS
ALTER TABLE daily_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobra_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobra_daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobra_cash_deposits ENABLE ROW LEVEL SECURITY;

-- Políticas daily_routes
CREATE POLICY "Cobrador ve su propia ruta" ON daily_routes FOR SELECT
USING (auth.uid() = (SELECT auth_id FROM company_members WHERE id = actor_id));

-- Políticas cobra_movements
CREATE POLICY "Cobrador crea sus movimientos" ON cobra_movements FOR INSERT
WITH CHECK (auth.uid() = (SELECT auth_id FROM company_members WHERE id = actor_id));

CREATE POLICY "Cobrador ve sus movimientos" ON cobra_movements FOR SELECT
USING (
  auth.uid() = (SELECT auth_id FROM company_members WHERE id = actor_id)
  OR auth.uid() IN (SELECT auth_id FROM company_members WHERE company_id = cobra_movements.company_id AND role IN ('supervisor', 'admin'))
);

-- Políticas cobra_daily_reports
CREATE POLICY "Cobrador crea reporte" ON cobra_daily_reports FOR INSERT
WITH CHECK (auth.uid() = (SELECT auth_id FROM company_members WHERE id = actor_id));

CREATE POLICY "Supervisor ve reportes" ON cobra_daily_reports FOR SELECT
USING (
  auth.uid() IN (SELECT auth_id FROM company_members WHERE company_id = cobra_daily_reports.company_id AND role IN ('supervisor', 'admin'))
);

-- Políticas cobra_cash_deposits
CREATE POLICY "Cobrador ve sus depósitos" ON cobra_cash_deposits FOR SELECT
USING (auth.uid() = (SELECT auth_id FROM company_members WHERE id = actor_id));
```

---

## Imports Necesarios

```typescript
import { useRoute, useScanner, useMovementCapture, useDailyReport } from '../hooks/useGastoCheck'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import * as ImagePicker from 'expo-image-picker'
import * as Linking from 'expo-linking'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '@gastocheck/shared'
```

---

## Próximos Pasos

1. **Crear tablas en Supabase** con migraciones SQL
2. **Implementar Gemini Vision API** en backend
   - Endpoint `/api/vision/scan`
   - Recibe imagen base64 + idioma
   - Retorna monto, fecha, proveedor, confianza
3. **Algoritmo de optimización de ruta** (Google Maps Distance Matrix)
4. **Geofencing**: verificar cuando cobrador llega a cliente
5. **Notificaciones push** cuando ruta se asigna
6. **Sincronización offline**: guardar movimientos localmente, sync cuando hay conexión
7. **Dashboard de supervisor**: ver reportes, movimientos en mapa

---

## Testing

### Datos Mock para Desarrollo

```typescript
// useRoute mock
const mockRoute: RouteClient[] = [
  {
    id: 'client-1',
    name: 'Empresa XYZ',
    lat: 25.6866,
    lng: -100.3161,
    address: 'Calle Principal 123, Monterrey',
    phone: '+52 81 1234 5678',
    office_hours: 'Lun-Vie 8am-6pm',
    distance: 2.5,
    eta: 8,
    status: 'pending',
    invoices_count: 3,
    total_amount: 5000,
  },
  // ... más clientes
]

// useScanner mock
const mockScanResult: ScannerResult = {
  amount: 1500,
  date: '2026-06-23',
  provider: 'PROVEEDOR ABC',
  confidence: 0.95,
}
```

---

## URLs de Referencia

- [Google Maps Android/iOS Integration](https://developers.google.com/maps)
- [React Native Camera](https://docs.expo.dev/versions/latest/sdk/camera/)
- [Gemini Vision API](https://ai.google.dev/tutorials/rest_quickstart)
- [Supabase RLS Policies](https://supabase.com/docs/guides/auth/row-level-security)
