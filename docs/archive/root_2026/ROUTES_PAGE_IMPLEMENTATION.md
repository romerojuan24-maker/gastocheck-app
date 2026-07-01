# CobraCheck Routes Page — Documentación de Implementación

## Ubicación
- **Archivo principal**: `apps/web/app/(dashboard)/cobracheck/routes/page.tsx`
- **Hooks**: `apps/web/hooks/useCobraRoutes.ts`
- **Ruta**: `/dashboard/cobracheck/routes`

---

## Arquitectura General

### 4 Secciones Principales

#### 1. **RouteGenerator** (Generador de Rutas)
Permite supervisores crear y optimizar rutas para cobradores/compradores.

**Flujo:**
1. Seleccionar cobrador (dropdown)
2. Seleccionar fecha (calendario)
3. Multi-select: elegir clientes de lista activos
4. Botón: "Generar ruta optimizada"
5. Tabla output: orden, cliente, distancia, duración
6. Botón: "Enviar al cobrador"

**Features:**
- Carga clientes dinámicamente según cobrador seleccionado
- Mock TSP (Traveling Salesman Problem) — ordena por nombre + distancias aleatorias
- Backend ready para implementar algoritmo de optimización real
- Guarda ruta en tabla `cobra_routes` (campo `clients_order: string[]`)
- Notificación al cobrador (SMS/push/email — TODO)

**Props:**
```typescript
interface RouteGeneratorProps {
  companyId: string;
  collectors: Collector[];
  onGenerateRoute: (route: OptimizedRoute[]) => void;
  isLoading?: boolean;
}
```

---

#### 2. **MovementsTable** (Tabla de Movimientos con Filtros)
Monitorea todos los movimientos de cobro del día/período.

**Filtros:**
- Cobrador (dropdown)
- Estado: Pagó | Promesa | No Pagó
- Rango fechas (desde/hasta)
- Cliente (multi-select)

**Columnas:**
- Activo (✓)
- Cliente
- Tipo (badge con color: verde/amarillo/rojo)
- Monto (justificado a derecha)
- Estado (Badge)
- Motivo/Nota
- Siguiente fecha (para promesas)

**Features:**
- Auto-refresh cada 5 segundos (tiempo real)
- Codificación por color según tipo:
  - Verde: Pagó ✓
  - Amarillo: Promesa ⏰
  - Rojo: No Pagó ✗
- Tabla scrolleable con max 100 registros
- Filtrado en cliente es client-side (para UX rápida)

**Estados:**
```typescript
type MovementType = 'collected' | 'promise' | 'not_paid';
```

---

#### 3. **RealtimeMonitor** (Monitor en Tiempo Real)
KPIs y progreso de ruta actualizados en vivo.

**KPIs (refresh cada 3 segundos):**
1. **Total Cobrado Hoy** (verde) — suma de `collected_amount`
2. **Promesas** (amarillo) — count de movimientos type='promise'
3. **Movimientos Procesados** (azul) — count total

**Progreso Ruta:**
- Barra de progreso: "X de Y clientes visitados"
- Porcentaje completado
- Vinculado a ruta activa del día

**Datos:**
- Filtra movimientos por `selectedDate`
- Agrupa por tipo de movimiento
- Calcula en tiempo real

---

#### 4. **ReportsList** (Reportes Diarios)
Aprobación/rechazo de reportes de cobradores.

**Tabla:**
- Cobrador (nombre)
- Fecha
- Total Cobrado (verde, sum de movements)
- Promesas (badge)
- No Pagó (badge rojo)
- Movimientos (count)
- Estado (Pendiente | Aprobado | Rechazado)
- Acciones: ✓ Aprobar | ✗ Rechazar

**Features:**
- Genera reportes automáticamente desde movimientos
- Agrupa por usuario + fecha
- Botones deshabilitados si status ≠ pending
- TODO: Tabla `cobra_daily_reports` para persistencia

---

## Hooks Personalizados

### `useCompanies(companyId)`
Carga cobradores/compradores de la empresa.

```typescript
const { members, loading, error } = useCompanies(companyId);
// members: CompanyMember[]
```

**Returns:**
```typescript
interface CompanyMember {
  id: string;
  email: string;
  fullName: string | null;
  role: 'collector' | 'operator';
}
```

---

### `useClients(companyId, collectorId?)`
Carga clientes activos (status='active').

```typescript
const { clients, loading, error } = useClients(companyId);
// clients: CobraClient[]
```

---

### `useOptimizeRoute(clientIds, clients)`
Optimiza ruta (mock + backend ready).

```typescript
const { route, loading, error, optimize } = useOptimizeRoute(
  selectedClientIds,
  clientsList
);

route: OptimizedRoutePoint[] = [
  {
    order: 1,
    clientId: "...",
    clientName: "...",
    distance: 2.5,
    duration: 15,
    address: "..."
  }
]
```

---

### `useMovementsList(companyId, filters)`
Carga movimientos con filtros.

```typescript
const { movements, loading, error, refetch } = useMovementsList(
  companyId,
  {
    collectorId: "...",
    clientId: "...",
    status: "collected",
    dateFrom: "2026-06-20",
    dateTo: "2026-06-23"
  }
);
// movements: CobraMovement[] (auto-sorted by created_at desc)
```

---

### `useDailyReports(companyId, filters)`
Carga reportes diarios agrupados por usuario/fecha.

```typescript
const { reports, loading, error, refetch, approve, reject } = useDailyReports(
  companyId,
  {
    collectorId: "...",
    dateFrom: "...",
    dateTo: "...",
    status: "pending"
  }
);

// Aprobar/rechazar
await approve(reportId);
await reject(reportId);
```

---

## Requisitos de BD (Supabase/PostgreSQL)

### Tablas Existentes
- ✅ `cobra_clients` (CobraClient)
- ✅ `cobra_movements` (CobraMovement)
- ✅ `company_members` + `profiles` (SessionUser, Collector)

### Tablas Faltantes

#### `cobra_routes`
```sql
CREATE TABLE cobra_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  collector_id UUID NOT NULL REFERENCES profiles(id),
  date DATE NOT NULL,
  clients_order TEXT[] NOT NULL,  -- Array de client IDs en orden
  status TEXT DEFAULT 'pending',  -- pending | in_progress | completed
  total_distance FLOAT,
  estimated_duration INT,         -- minutos
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ON cobra_routes(company_id, date);
CREATE INDEX ON cobra_routes(collector_id);
```

#### `cobra_daily_reports` (Opcional: si quieren persistencia)
```sql
CREATE TABLE cobra_daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  collector_id UUID NOT NULL REFERENCES profiles(id),
  date DATE NOT NULL,
  total_collected NUMERIC,
  promise_count INT,
  not_paid_count INT,
  movements_count INT,
  status TEXT DEFAULT 'pending',  -- pending | approved | rejected
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX ON cobra_daily_reports(company_id, collector_id, date);
```

---

## Componentes UI (Shadcn/ui)

Todos disponibles en `apps/web/components/ui/`:

- ✅ `Select` / `SelectTrigger` / `SelectValue` / `SelectContent` / `SelectItem`
- ✅ `Checkbox`
- ✅ `Button`
- ✅ `Input`
- ✅ `Card` / `CardContent` / `CardHeader` / `CardTitle`
- ✅ `Badge`
- ✅ `Table` / `TableBody` / `TableCell` / `TableHead` / `TableHeader` / `TableRow`
- ✅ `Calendar` (lucide-react icon)

Si falta alguno, instalar:
```bash
npx shadcn-ui@latest add <component-name>
```

---

## Estilos & Responsive

**Clases Tailwind:**
- `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3` — responsive
- `max-h-48 overflow-y-auto` — scroll interno
- Colores de Badge según tipo movimiento
- Dark/light mode: usa CSS variables de Shadcn

---

## Flujos de Usuario

### Flujo 1: Generar Ruta
```
Supervisor abre /dashboard/cobracheck/routes
  ↓
Selecciona cobrador "Juan García"
  ↓
Selecciona fecha "2026-06-23"
  ↓
Multi-select clientes: [Cliente A, B, C]
  ↓
Click "Generar ruta optimizada"
  ↓
Backend/mock: TSP → orden optimizada
  ↓
Tabla output: 1. Cliente A (2.5 km), 2. Cliente B (3.1 km), 3. Cliente C (1.8 km)
  ↓
Click "Enviar al cobrador"
  ↓
Ruta guardada en DB + notificación SMS
```

### Flujo 2: Monitorear Movimientos en Vivo
```
Supervisor abre página
  ↓
MovementsTable se auto-refresha cada 5s desde DB
  ↓
Cobrador registra movimiento (collected/promise/not_paid)
  ↓
Aparece inmediatamente en tabla (con color: verde/amarillo/rojo)
  ↓
RealtimeMonitor actualiza KPIs (cada 3s)
  ↓
Progreso ruta se actualiza
```

### Flujo 3: Aprobar Reportes
```
Fin de día → ReportsList agrupa movimientos por cobrador/fecha
  ↓
Muestra totales: cobrado, promesas, no pagó
  ↓
Supervisor revisa y da click en "✓ Aprobar"
  ↓
Status pasa de "Pendiente" → "Aprobado"
  ↓
Reporte bloqueado (botones deshabilitados)
```

---

## Próximos Pasos (TODO)

### Implementación Backend

1. **TSP Optimization**
   - Crear endpoint `POST /api/routes/optimize`
   - Recibir: `{ clientIds: string[] }`
   - Retornar: orden optimizada + distancias reales (Google Maps API)

2. **Notificaciones**
   - Enviar SMS/push/email a cobrador cuando ruta asignada
   - Template: "Se te asignó ruta de 5 clientes para hoy"

3. **Persistencia Reportes**
   - Crear tabla `cobra_daily_reports`
   - Guardar status (pending/approved/rejected)
   - Auditoría: quién aprobó, cuándo

### Mejoras Frontend

1. **Google Maps Integration**
   - Mostrar mapa de ruta en modal
   - Actualizar ubicación en vivo del cobrador
   - ETA dinámica

2. **Foto/Prueba de Pago**
   - Campo `photo_uri` en CobraMovement
   - Preview en tabla (thumbnail)

3. **Sincronización Offline**
   - Service worker para movimientos offline
   - Sync automático cuando vuelve conexión

4. **Exportar Reportes**
   - CSV/PDF diarios por cobrador
   - Integración con GastoCheck (actualizar saldos automáticamente)

---

## Testing

### Unit Tests (Recomendado)

```typescript
// hooks/__tests__/useCobraRoutes.test.ts
describe('useCobraRoutes', () => {
  test('useCompanies carga cobradores correctamente', async () => {
    // Mock supabase.from().select()...
    // Assert members.length > 0
  });

  test('useOptimizeRoute retorna ruta ordenada', async () => {
    // Mock clientIds: [A, B, C]
    // Assert route[0].order === 1
  });

  test('useMovementsList filtra por status', async () => {
    // Mock movements con diferentes tipos
    // Assert filteredMovements.length === expectedCount
  });
});
```

### E2E Tests (Cypress/Playwright)

```typescript
// e2e/routes.spec.ts
describe('CobraCheck Routes Page', () => {
  it('genera ruta optimizada', async () => {
    // Visit /dashboard/cobracheck/routes
    // Select cobrador
    // Check clients
    // Click generar
    // Assert tabla con 3 clientes ordenados
  });
});
```

---

## Performance & Optimization

### Query Optimization
- `cobra_movements` index en `(company_id, created_at)`
- `cobra_routes` index en `(company_id, date, collector_id)`

### Frontend Optimization
- `useCallback` en `loadMovements` para evitar loops infinitos
- `useMemo` para filtrar movimientos (client-side)
- Auto-refresh cada 3-5s (no constantemente)

### Pagination (Futuro)
- Agregar `limit(100)` + `offset()` a queries
- Botón "Cargar más"

---

## Guía de Integración Rápida

### 1. Asegurar Tablas BD
```sql
-- Crear cobra_routes si falta
CREATE TABLE cobra_routes AS ...  -- ver arriba

-- Verify cobra_movements tiene foto_uri, promise_date
ALTER TABLE cobra_movements ADD COLUMN photo_uri TEXT;
ALTER TABLE cobra_movements ADD COLUMN promise_date DATE;
```

### 2. Instalar Deps (si faltan)
```bash
npm install --save \
  @supabase/supabase-js \
  lucide-react \
  @radix-ui/react-select \
  @radix-ui/react-checkbox
```

### 3. Crear Directorio
```bash
mkdir -p apps/web/app/\(dashboard\)/cobracheck/routes
mkdir -p apps/web/hooks
```

### 4. Copiar Archivos
- `page.tsx` → `apps/web/app/(dashboard)/cobracheck/routes/page.tsx`
- `useCobraRoutes.ts` → `apps/web/hooks/useCobraRoutes.ts`

### 5. Agregar a Navbar
```typescript
// Agregar link a /dashboard/cobracheck/routes
{
  label: "Rutas",
  href: "/dashboard/cobracheck/routes",
  icon: "🚗",
  role: "supervisor"
}
```

### 6. Probar Localmente
```bash
npm run dev
# Visit http://localhost:3000/dashboard/cobracheck/routes
```

---

## API Reference

### Tabla cobra_movements
```typescript
interface CobraMovement {
  id: string;                    // UUID
  company_id: string;            // FK companies
  user_id: string;               // FK profiles (cobrador)
  route_point_ts: string;        // ISO timestamp del punto
  client_id: string;             // FK cobra_clients
  invoice_id?: string;           // FK cobra_invoices
  folio?: string;                // Folio factura (denormalized)
  amount_original: number;       // NUMERIC
  movement_type: 'collected' | 'promise' | 'not_paid';
  collected_amount?: number;     // Si type='collected'
  promise_date?: string;         // Si type='promise' (DATE)
  reason_not_paid?: string;      // Si type='not_paid' (enum?)
  photo_uri?: string;            // Comprobante/foto
  notes?: string;
  created_at: string;            // TIMESTAMP
  updated_at: string;            // TIMESTAMP
}
```

### Tabla cobra_routes
```typescript
interface CobraRoute {
  id: string;
  company_id: string;
  collector_id: string;
  date: string;                  // DATE
  clients_order: string[];       // ARRAY[UUID]
  status: 'pending' | 'in_progress' | 'completed';
  total_distance?: number;       // FLOAT (km)
  estimated_duration?: number;   // INT (minutos)
  notes?: string;
  created_at: string;
  updated_at: string;
}
```

---

## Troubleshooting

### Error: "Cannot find module useCobraRoutes"
- Asegurar `apps/web/hooks/useCobraRoutes.ts` existe
- Verificar import path: `import { useCobraRoutes } from '../hooks/useCobraRoutes'`

### Error: "supabase is not defined"
- Verificar `lib/supabase.ts` existe y exporta `supabase`
- Conf vars: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Tabla no se carga
- Abrir DevTools → Network → ver response de query
- Verificar RLS policies permiten lectura (role='supervisor')
- Check: `supabase.auth.getSession()` retorna usuario

### Auto-refresh no funciona
- Verificar `setInterval` se limpia en `useEffect` cleanup
- Check browser console por errores

---

## Contacto & Support

Desarrollado para CHECK SUITE v1.0 (Jun 2026)
Integración: GastoCheck + CobraCheck

Repo: github.com/statix-io/check-suite
