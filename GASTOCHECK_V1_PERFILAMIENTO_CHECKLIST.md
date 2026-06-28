---
name: gastocheck-v1-perfilamiento
description: Checklist de cambios MÍNIMOS para GastoCheck v1.0 (Perfilamiento, no rebuild)
metadata:
  type: project
  date: 2026-06-27
  status: IN PROGRESS
---

# GastoCheck v1.0 — CHECKLIST PERFILAMIENTO (Cambios Mínimos)

**Fecha de inicio:** Viernes 27 de junio 2026  
**Deadline:** Viernes 2 de julio 2026 (6 días)  
**Objetivo:** Perfilar código existente sin destruir, preparar para venta

---

## ✅ COMPLETADO HOY (27 JUNIO)

### 1. ✅ MIGRACIÓN SQL CREADA
- Archivo: `supabase/migrations/20260627_perfilamiento_gastocheck_v1.sql`
- Qué incluye:
  - ✅ Agregar `created_by` a tabla `expenses` (multi-comprador)
  - ✅ Crear tabla `viaticos` (nueva, no existía)
  - ✅ Crear vista `expenses_by_buyer` (reportes por comprador)
  - ✅ Crear vista `viaticos_by_person` (reportes por persona)
  - ✅ Crear vista `executive_summary_daily` (reportes ejecutivo)
  - ✅ Crear tabla `contador_general_assignments` (asignación configurable)
  - ✅ RLS policies actualizadas para multi-comprador
  - ✅ Triggers para updated_at
- **Estado:** LISTA PARA EJECUTAR en Supabase

### 2. ✅ PLAN DE CAMBIOS DE ROLES DOCUMENTADO (abajo)

---

## 🔄 CAMBIOS DE ROLES (Renombrar supervisor → contador_general)

### PASO 1: Actualizar ENUMS y TIPOS (Backend)

**Archivo:** `supabase/migrations/20260609000001_enum_roles.sql` (o equivalente)

```sql
-- ANTES:
CREATE TYPE public.user_role AS ENUM ('owner', 'supervisor', 'spender', 'office', 'accountant', 'admin', 'operator', 'superadmin');

-- DESPUÉS:
CREATE TYPE public.user_role AS ENUM ('owner', 'contador_general', 'spender', 'office', 'encargado_cxp', 'admin', 'operator', 'superadmin');
```

**NOTA:** 
- `supervisor` → `contador_general`
- `accountant` → `encargado_cxp` (Encargado de Cuentas por Pagar)

**Impacta:** Enum definition, todas las referencias al tipo

---

### PASO 2: Actualizar RLS POLICIES (Buscar y reemplazar)

Buscar en archivos de migración:
- `auth_role('supervisor')` → `auth_role('contador_general')`
- `role = 'supervisor'` → `role = 'contador_general'`
- `role = 'accountant'` → `role = 'encargado_cxp'`

**Archivos afectados (aproximadamente 13 migraciones):**
- `20260606000001_init.sql` (RLS base)
- `20260608_*.sql` (policies)
- `20260610_*.sql` (SAT related)
- `20260621_*.sql` (alertas)
- `20260624_*.sql` (accounts payable)
- `20260623_*.sql` (gastocheck routes)
- Y otras

**Comando para identificar:**
```bash
grep -r "supervisor" supabase/migrations/ | grep -E "(role|auth_role)" | head -20
```

---

### PASO 3: Actualizar TypeScript/JavaScript TYPES

**Archivos:**
- `packages/shared/src/types/*.ts` (si existen enums de roles)
- `apps/mobile/src/types/*.ts`
- `apps/web/src/types/*.ts`

**Buscar:** `'supervisor'`, `"supervisor"`, `UserRole.supervisor`  
**Reemplazar:** `'contador_general'`, `"contador_general"`, `UserRole.contador_general`

---

### PASO 4: Actualizar UI/UX (Selects, Labels, etc.)

**Archivos:**
- `apps/web/app/(dashboard)/gastocheck/settings.tsx` (si existe)
- `apps/web/app/(dashboard)/admin/usuarios.tsx` (gestión de usuarios)
- `apps/mobile/app/gastocheck/roles/page.tsx` (si existe)

**Buscar:** "Supervisor" (label), "supervisor" (value)  
**Reemplazar:** "Contador General", "contador_general"

---

### PASO 5: Actualizar Documentación & Comments

**Archivos:**
- `README.md` (referencias a roles)
- `ARCHITECTURE.md` (si existe)
- Comments en código SQL

**Buscar:** "supervisor" en contexto de rol  
**Reemplazar:** "contador_general"

---

## 📋 TAREAS POR DÍA (Lunes 28 - Viernes 2)

### **LUNES 28 JUNIO**

#### Tarea 1: Ejecutar Migración SQL (1 hora)
- [ ] Conectar a Supabase
- [ ] Ejecutar: `supabase/migrations/20260627_perfilamiento_gastocheck_v1.sql`
- [ ] Verificar que no hay errores
- [ ] Confirmar que tablas + vistas creadas: `viaticos`, `expenses_by_buyer`, etc.

#### Tarea 2: Actualizar ENUM de Roles (1 hora)
- [ ] Renombrar `supervisor` → `contador_general` en enum SQL
- [ ] Renombrar `accountant` → `encargado_cxp` en enum SQL
- [ ] Crear migración nueva: `20260628_rename_roles.sql`
- [ ] Verificar que no hay breaking changes

#### Tarea 3: Verificar RLS POLICIES (2 horas)
- [ ] Buscar todas las referencias a `'supervisor'` en migrations
- [ ] Actualizar a `'contador_general'`
- [ ] Buscar todas las referencias a `'accountant'` en migrations
- [ ] Actualizar a `'encargado_cxp'`
- [ ] Prueba: crear usuario contador_general, verificar que ve datos correctos

**Responsable:** Backend Lead  
**Deadline:** Lunes EOD

---

### **MARTES 29 JUNIO**

#### Tarea 1: Actualizar TypeScript Types (2 horas)
- [ ] Encontrar definición de `UserRole` enum en tipos
- [ ] Reemplazar supervisor → contador_general
- [ ] Reemplazar accountant → encargado_cxp
- [ ] Compilar (tsc) sin errores

#### Tarea 2: Actualizar UI (Selects de Roles) (2 horas)
- [ ] Encontrar componentes donde se selecciona rol (Admin → Usuarios)
- [ ] Actualizar labels y values
- [ ] Prueba manual: crear usuario, asignar rol contador_general

#### Tarea 3: Pruebas de RLS (2 horas)
- [ ] Crear datos test: 2 compradores + 1 contador_general
- [ ] Comprador 1 captura $100
- [ ] Comprador 2 captura $200
- [ ] Contador_general ve AMBOS ($300 total)
- [ ] Comprador 1 NO ve gastos de Comprador 2 (RLS funciona)

**Responsable:** Frontend Lead + QA  
**Deadline:** Martes EOD

---

### **MIÉRCOLES 30 JUNIO**

#### Tarea 1: SAT Validator Real (4 horas)
- [ ] Integrar API real (FINKOK / SAT / Masari)
- [ ] Reemplazar lógica mock en `/supabase/functions/cobra-sat-validator/`
- [ ] Implementar retry logic (timeout 30s)
- [ ] Implementar cache (Redis, 24h)
- [ ] Prueba: validar CFDI real contra SAT

#### Tarea 2: CxP UI (2 horas)
- [ ] Verificar si página `/apps/web/app/(dashboard)/gastocheck/cxp.tsx` existe
- [ ] Si NO existe: crear mínimo (Tabs: CxP + Cajas Chicas)
- [ ] Cargar datos desde BD
- [ ] Prueba: ver lista CxP sin errores

**Responsable:** Backend Lead + Frontend Lead  
**Deadline:** Miércoles EOD

---

### **JUEVES 1 JULIO**

#### Tarea 1: Reportes Ejecutivo (2 horas)
- [ ] Crear endpoints: `GET /api/reports/executive?company_id=X&period=2026-06`
- [ ] Usar vistas: `executive_summary_daily`
- [ ] Retornar JSON: total_expenses, total_viaticos, by_person, pending
- [ ] Prueba: obtener reporte para empresa test

#### Tarea 2: Google Maps + Comparativas (3 horas)
- [ ] Agregar dependencia: `google-maps-react` (web) o `expo-location` (mobile)
- [ ] Componente Maps: buscar proveedores en mapa
- [ ] Componente Comparativa: histórico de precios (gráfico)
- [ ] Prueba manual: capturar gasto con ubicación, ver comparativa

#### Tarea 3: Testing Supervisor Workflow (2 horas)
- [ ] Test data: empresa + 2 compradores + contador_general
- [ ] Flujo completo: captura → póliza → SAT validation → accounting → approval
- [ ] Verificar PDF genera correctamente
- [ ] Verificar CONTPAQi XML es válido

**Responsable:** Frontend Lead + QA  
**Deadline:** Jueves EOD

---

### **VIERNES 2 JULIO**

#### Tarea 1: Contador General Assignment UI (2 horas)
- [ ] Crear página: `/apps/web/app/(dashboard)/admin/contador-assignment.tsx`
- [ ] Selector: qué contador asignado a qué empresa
- [ ] CRUD: crear, editar, eliminar asignaciones
- [ ] Prueba: asignar contador a empresa, verificar acceso

#### Tarea 2: QA Final (2 horas)
- [ ] E2E test: flujo completo de captura a reporte
- [ ] Security audit: RLS policies funcionan
- [ ] Performance: reportes cargan <2s
- [ ] Checklist de bugs críticos: 0

#### Tarea 3: Documentación + Deploy Staging (1 hora)
- [ ] Actualizar README con nuevos roles
- [ ] Actualizar diagrama de flujos (contador_general en lugar de supervisor)
- [ ] Deploy a staging
- [ ] Smoke tests en staging

**Responsable:** QA Lead + DevOps  
**Deadline:** Viernes EOD → 🚀 LISTO PARA VENTA

---

## 📊 CHECKLIST DE FEATURES

### Mobile App

- [ ] **Captura Gasto** (existente, validar)
  - [ ] OCR funciona
  - [ ] created_by se graba
  - [ ] Offline mode OK

- [ ] **Mis Comprobantes** (existente, mejorar)
  - [ ] Lista muestra created_by (quién capturó)
  - [ ] Filtro por persona
  - [ ] Ver histórico personal

- [ ] **Mis Pólizas** (existente, validar)
  - [ ] Crear póliza OK
  - [ ] Agrupa comprobantes OK
  - [ ] created_by rastreable

- [ ] **Viáticos** (NUEVO)
  - [ ] Formulario para solicitar
  - [ ] 6 categorías
  - [ ] Status: pending → approved/rejected
  - [ ] Notificación cuando se aprueba

### Web App (Dashboard)

- [ ] **Dashboard** (existente)
  - [ ] KPIs actualizados (multi-comprador totales)
  - [ ] Cards con links a módulos
  - [ ] Refrescar cada 30s

- [ ] **Comprobantes** (existente)
  - [ ] Tabs: todos, vigentes, históricos
  - [ ] Filtro por persona (created_by)
  - [ ] Ver quién capturó cada uno

- [ ] **Reporte Ejecutivo** (NUEVO)
  - [ ] Dashboard contador_general
  - [ ] Gastos totales + por persona
  - [ ] Viáticos totales + por persona
  - [ ] Dinero en resguardo
  - [ ] Gráficos históricos

- [ ] **CxP + Cajas Chicas** (MEJORAR)
  - [ ] UI funcional
  - [ ] Datos desde BD
  - [ ] Filtros básicos

- [ ] **Contador General Assignment** (NUEVO)
  - [ ] Admin asigna contador a empresa
  - [ ] Contador ve datos de empresa asignada
  - [ ] Múltiples empresas por contador (aislado por RLS)

### Database

- [ ] ✅ Migración SQL ejecutada
- [ ] ✅ Tabla viaticos creada
- [ ] ✅ created_by agregado a expenses
- [ ] ✅ Vistas para reportes
- [ ] ✅ RLS policies actualizadas
- [ ] ✅ contador_general_assignments creada

### Seguridad

- [ ] ✅ RLS: Comprador ve solo sus gastos
- [ ] ✅ RLS: Contador_general ve todo de su empresa
- [ ] ✅ RLS: Admin ve todo global
- [ ] ✅ SAT API real (no mock)
- [ ] ✅ Audit trail (created_by, updated_by, timestamps)
- [ ] ✅ No secrets en código

### Testing

- [ ] ✅ Unit: balance computation
- [ ] ✅ Unit: SAT validation
- [ ] ✅ E2E: captura → póliza → reporte
- [ ] ✅ E2E: viático pending → approved
- [ ] ✅ Field: 2-3 usuarios reales
- [ ] ✅ Security: RLS verification
- [ ] ✅ Performance: <2s reportes

---

## 🚀 GO-TO-MARKET

**Viernes 2 Julio EOD:**
- [ ] Landing page actualizada (contador_general menciona)
- [ ] Video demo (nuevo flow con múltiples compradores)
- [ ] Email listo para enviar early adopters
- [ ] Pricing confirmado: $299-$999/mes

---

## 📝 NOTAS

- **Supervisor → Contador General:** Cambio de nombre, NO de lógica
- **Accountant → Encargado CxP:** Especialización de rol existente
- **created_by:** Rastreo de quién capturó gasto (multi-comprador reports)
- **viaticos tabla:** Completamente nueva, no existía
- **Reportes ejecutivo:** Vistas SQL + endpoints, no lógica compleja

**RIESGO TOTAL:** BAJO (cambios mostly additive, sin breaking changes)

---

**Estado:** IN PROGRESS  
**Próximo paso:** Ejecutar lunes a primera hora
