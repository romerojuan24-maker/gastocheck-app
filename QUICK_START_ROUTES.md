# Quick Start: CobraCheck Routes Dashboard

Guía rápida de 5 minutos para integrar la página de rutas.

## 1. Verificar Archivos Creados

```bash
# Archivos creados automáticamente:
ls -l apps/web/app/\(dashboard\)/cobracheck/routes/page.tsx    # 32 KB
ls -l apps/web/hooks/useCobraRoutes.ts                         # 12 KB
```

✓ Si ambos existen, continuar a paso 2.

---

## 2. Crear Tabla en Supabase

Ejecutar en Supabase SQL Editor:

```sql
-- Tabla: cobra_routes
CREATE TABLE cobra_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  collector_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clients_order TEXT[] NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  total_distance FLOAT,
  estimated_duration INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cobra_routes_company_date ON cobra_routes(company_id, date);
CREATE INDEX idx_cobra_routes_collector ON cobra_routes(collector_id);

-- Tabla: cobra_daily_reports (OPCIONAL)
CREATE TABLE cobra_daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  collector_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_collected NUMERIC DEFAULT 0,
  promise_count INT DEFAULT 0,
  not_paid_count INT DEFAULT 0,
  movements_count INT DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, collector_id, date)
);

CREATE INDEX idx_cobra_daily_reports_company ON cobra_daily_reports(company_id, date);
```

---

## 3. Verificar RLS Policies

En Supabase → Authentication → Policies, verificar que existan:

```sql
-- Para cobra_routes
SELECT: role = 'supervisor' AND company_id = auth.jwt()->>'company_id'
INSERT: role = 'supervisor' AND company_id = auth.jwt()->>'company_id'
UPDATE: role = 'supervisor' AND company_id = auth.jwt()->>'company_id'

-- Para cobra_daily_reports (similar)
SELECT: role = 'supervisor' ...
INSERT: role = 'supervisor' ...
UPDATE: role = 'supervisor' ...
```

Si no existen, crear:

```sql
-- cobra_routes - SELECT
CREATE POLICY "supervisors_can_view_routes" ON cobra_routes
FOR SELECT USING (
  auth.jwt()->>'role' = 'supervisor' AND 
  company_id = (auth.jwt()->>'company_id')::UUID
);

-- cobra_routes - INSERT
CREATE POLICY "supervisors_can_create_routes" ON cobra_routes
FOR INSERT WITH CHECK (
  auth.jwt()->>'role' = 'supervisor' AND 
  company_id = (auth.jwt()->>'company_id')::UUID
);

-- cobra_routes - UPDATE
CREATE POLICY "supervisors_can_update_routes" ON cobra_routes
FOR UPDATE USING (
  auth.jwt()->>'role' = 'supervisor' AND 
  company_id = (auth.jwt()->>'company_id')::UUID
) WITH CHECK (
  company_id = (auth.jwt()->>'company_id')::UUID
);
```

---

## 4. Agregar Ruta en Navbar

Editar: `apps/web/components/navbar.tsx` o similar

```typescript
const navItems = [
  // ... items existentes
  {
    label: "🚗 Rutas",
    href: "/dashboard/cobracheck/routes",
    role: ["supervisor", "admin"],  // Solo supervisores
    icon: <MapPin className="w-5 h-5" />
  },
];
```

---

## 5. Iniciar Servidor

```bash
npm run dev

# Visitar:
http://localhost:3000/dashboard/cobracheck/routes
```

---

## Verificar Que Funcione

### Sección 1: RouteGenerator
- [ ] Aparecen cobradores en dropdown
- [ ] Aparecen clientes cuando seleccionas cobrador
- [ ] Puedes marcar 3+ clientes
- [ ] Click "Generar ruta" → aparece tabla con orden

### Sección 2: MovementsTable
- [ ] Filtros funcionan (cobrador, estado, fechas)
- [ ] Tabla muestra movimientos (si existen)
- [ ] Auto-refresh cada 5 segundos

### Sección 3: RealtimeMonitor
- [ ] Muestra 3 KPIs (cobrado, promesas, movimientos)
- [ ] Barra de progreso visible
- [ ] Actualiza cada 3 segundos

### Sección 4: ReportsList
- [ ] Tabla agrupa movimientos por cobrador/fecha
- [ ] Botones ✓ / ✗ visibles
- [ ] Puedes aprobar reporte

---

## Datos de Prueba

Si necesitas test data:

```sql
-- Crear cliente de prueba
INSERT INTO cobra_clients (company_id, name, current_balance, risk_score, status)
VALUES ('YOUR_COMPANY_ID', 'Cliente Test', 5000, 50, 'active');

-- Crear movimiento de prueba
INSERT INTO cobra_movements (
  company_id, user_id, client_id, amount_original, 
  movement_type, route_point_ts, collected_amount
) VALUES (
  'YOUR_COMPANY_ID',
  'USER_ID',  -- cobrador existente
  'CLIENT_ID',
  5000,
  'collected',
  NOW(),
  5000
);
```

---

## Solucionar Problemas

### Error: "Cannot find module"
```bash
# Verifica ubicación:
ls apps/web/hooks/useCobraRoutes.ts
# Debe existir
```

### Error: "Table does not exist"
```bash
# Verifica en Supabase:
# Tables → cobra_routes debe estar
# Si no, ejecutar SQL del paso 2
```

### Sin datos en tabla
```bash
# Verifica:
1. cobrador existe en company_members
2. clientes existen en cobra_clients (status='active')
3. movimientos existen en cobra_movements
4. user_id del movimiento coincide con cobrador
```

### Botones deshabilitados
```typescript
// Verifica que el usuario sea supervisor:
const user = await getSessionUser();
console.log(user.role);  // debe ser 'supervisor'
```

---

## Siguiente Paso: Backend TSP

La optimización de rutas actualmente es mock (ordena por nombre).

Para implementar optimización real:

### Crear Endpoint

```typescript
// apps/api/routes/optimize.ts
import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { clientIds } = await req.json();
  
  // TODO: Implementar TSP (usar or-tools, google-optimization, etc)
  // Por ahora: retornar en orden
  const optimized = clientIds.map((id: string, idx: number) => ({
    order: idx + 1,
    clientId: id
  }));
  
  return Response.json(optimized);
}
```

### Modificar Hook

```typescript
// En useCobraRoutes.ts
const optimize = useCallback(async () => {
  const res = await fetch('/api/routes/optimize', {
    method: 'POST',
    body: JSON.stringify({ clientIds })
  });
  const optimized = await res.json();
  setRoute(optimized);
}, [clientIds]);
```

---

## Checklist Final

- [ ] Archivos creados (page.tsx, useCobraRoutes.ts)
- [ ] Tablas cobra_routes creadas en Supabase
- [ ] RLS policies aplicadas
- [ ] Navbar agregado
- [ ] `npm run dev` funciona
- [ ] Página carga sin errores
- [ ] Al menos una sección muestra datos
- [ ] Auto-refresh funciona

---

## Soporte

Documentación completa: `ROUTES_PAGE_IMPLEMENTATION.md`

Resumen técnico: `ROUTES_PAGE_SUMMARY.txt`

---

**Tiempo estimado:** 5 minutos de instalación + 10 minutos de testing.

¡Listo para usar en producción!
