# BANCOCHECK IMPLEMENTATION PLAN
**Estado**: 🚀 Arquitectura lista, implementación en progreso

---

## ✅ COMPLETADO

- [x] Prisma Schema (BANCOCHECK_IMPL_SPEC.prisma)
- [x] SQL Migration (20260709000000_bancocheck_redesigned.sql)
- [x] RLS Policies (tenant-scoped)
- [x] Database constraints (DECIMAL, checks, ACID)
- [x] Specification document (esta)

---

## 🔄 PRÓXIMOS PASOS (Orden prioritario)

### FASE 1: Backend Logic (2-3 horas)

#### 1.1 Service Layer (NestJS)
**Archivo**: `apps/web/src/modules/bancocheck/services/bancocheck.service.ts`

```typescript
// Métodos principales:
- importBankStatementCSV()
  * Parsear CSV (fecha, descripción, débito, crédito)
  * Validar DECIMAL (nunca float)
  * Crear uniqueHash
  * Detectar duplicados
  * Crear BankImportBatch
  * Insertar transacciones (transacción ACID)

- classifyTransaction()
  * Validar tenant_id
  * Actualizar status y category
  * Log en audit
  * Retornar transaction actualizado

- matchTransaction()
  * Vincular con entityType (invoice, receipt, etc) y entityId
  * Actualizar matched_entity_type y matched_entity_id
  * Log en audit
  * Retornar transaction

- suggestMatches()
  * Para un movimiento, generar sugerencias automáticas
  * Depósito: buscar facturas pendientes mismo monto
  * Cargo: buscar CFDIs/gastos registrados
  * Guardar en BankMatchSuggestion

- markPersonal()
  * Marcar como personal
  * Excluir de reportes operativos
  * Mantener visible a owner

- ignore()
  * Marcar como ignorado
  * No afectar flujo

- getDashboard()
  * Total transacciones
  * Sin explicar
  * Cargos sin CFDI
  * Depósitos sin factura
  * Pagos que requieren complemento

- getTransactionDetail()
  * Movimiento + sugerencias + matches
```

#### 1.2 Repository (Prisma)
**Archivo**: `apps/web/src/modules/bancocheck/repositories/bancocheck.repository.ts`

```typescript
// CRUD + Queries específicas
- createAccount()
- getAccounts()
- createTransaction()
- getTransactions()
- updateTransaction()
- getTransaction()
- createImportBatch()
- getImportBatch()
- createMatchSuggestion()
- getMatchSuggestions()
- logAudit()
```

#### 1.3 DTOs & Types
**Archivo**: `apps/web/src/modules/bancocheck/dto/`

```typescript
// Input
- ImportBankStatementDto
  * tenantId
  * bankAccountId
  * file (CSV)

- ClassifyTransactionDto
  * status
  * category
  * notes

- MatchTransactionDto
  * entityType
  * entityId
  * confidence

// Output
- BankTransactionDto
- BankAccountDto
- DashboardDto
```

---

### FASE 2: API Endpoints (1-2 horas)

**Archivo**: `apps/web/src/modules/bancocheck/controllers/bancocheck.controller.ts`

```typescript
POST   /api/bancocheck/accounts              // Crear cuenta
GET    /api/bancocheck/accounts              // Listar cuentas
POST   /api/bancocheck/import-csv            // Importar CSV
GET    /api/bancocheck/transactions          // Listar transacciones (filtrable)
GET    /api/bancocheck/transactions/:id      // Detalle
PATCH  /api/bancocheck/transactions/:id/classify      // Clasificar
PATCH  /api/bancocheck/transactions/:id/match         // Relacionar
PATCH  /api/bancocheck/transactions/:id/mark-personal // Marcar personal
PATCH  /api/bancocheck/transactions/:id/ignore        // Ignorar
GET    /api/bancocheck/dashboard             // KPIs
GET    /api/bancocheck/accountant-view       // Vista contador
GET    /api/bancocheck/export                // Exportar CSV/Excel
```

**Seguridad**:
- ✅ Validar tenantId en cada request
- ✅ Validar permisos (owner/admin/contador_general)
- ✅ RLS policies en BD
- ✅ Nunca exponer rawData de CSV

---

### FASE 3: Frontend (Next.js Web) (2-3 horas)

**Archivos**:
```
apps/web/app/(dashboard)/bancocheck/
├── page.tsx              // Dashboard
├── transactions/
│   ├── page.tsx         // Lista
│   └── [id].tsx         // Detalle
├── import/
│   └── page.tsx         // Upload CSV
├── accounts/
│   └── page.tsx         // Gestionar cuentas
└── components/
    ├── TransactionCard.tsx
    ├── ImportForm.tsx
    ├── ClassifyModal.tsx
    ├── MatchModal.tsx
    └── Dashboard.tsx
```

**Funcionalidades**:
- [x] Upload CSV
- [ ] Tabla de transacciones (filtrable, paginable)
- [ ] Vista rápida: sin explicar, sin CFDI, sin factura
- [ ] Modal clasificar
- [ ] Modal relacionar (matching)
- [ ] Vista contador (resumen, estadísticas)
- [ ] Exportar CSV/Excel

---

### FASE 4: Mobile Components (React Native) (2-3 horas)

**Archivos**:
```
apps/mobile/app/bancocheck/
├── index.tsx                    // Home
├── accounts-tab.tsx             // Cuentas
├── transactions-tab.tsx         // Transacciones
├── import-tab.tsx               // Upload
├── detail-modal.tsx             // Detalle movimiento
├── classify-modal.tsx           // Clasificar
└── components/
    ├── TransactionCard.tsx      // Card swipeable
    ├── MatchSuggestion.tsx
    └── StatsCard.tsx
```

**Mobile UX**:
- [x] Cards con fecha, descripción, monto
- [ ] Swipe derecha = explicado
- [ ] Swipe izquierda = revisar después
- [ ] Tap = detalle
- [ ] Tap largo = acciones
- [ ] Drag = clasificar
- [ ] Categorías simples (picker)

---

### FASE 5: Testing & Seed (1-2 horas)

**Archivos**:
```
apps/web/src/modules/bancocheck/
├── services/bancocheck.service.spec.ts
├── controllers/bancocheck.controller.spec.ts
└── test-data/
    ├── sample-bbva.csv
    ├── sample-banorte.csv
    └── seed-bancocheck.ts
```

**Test Cases**:
- [x] Import sin duplicados
- [x] uniqueHash generation
- [x] ACID en clasificación
- [x] RLS policies
- [x] Match suggestions accuracy
- [x] Audit logging
- [x] Export CSV/Excel

**Seed Data**:
- 3 cuentas (BBVA, Banorte, Santander)
- 50 transacciones (mezcla de depósitos y cargos)
- 10 sugerencias de matching

---

## CHECKLIST DE PRUEBA

### Funcional
- [ ] Importar CSV sin duplicar
- [ ] Ver transacciones en lista
- [ ] Clasificar una transacción
- [ ] Relacionar con factura
- [ ] Marcar personal
- [ ] Ignorar movimiento
- [ ] Ver sugerencias automáticas
- [ ] Aceptar sugerencia
- [ ] Descartar sugerencia

### Seguridad
- [ ] Tenant A no ve datos de Tenant B
- [ ] Solo admin/contador_general puede clasificar
- [ ] Audit log registra cada acción
- [ ] No hay credenciales bancarias guardadas

### Performance
- [ ] Importar 1000+ transacciones < 5s
- [ ] Listar transacciones (100) < 1s
- [ ] Dashboard carga < 2s

### UI/UX
- [ ] Mobile cards son claras (fecha, desc, monto)
- [ ] Swipes funcionan (derecha/izquierda)
- [ ] Modales responsivos
- [ ] Exportar abre descarga

---

## TIEMPO ESTIMADO

| Fase | Horas | Estado |
|------|-------|--------|
| 1. Backend Logic | 2-3 | 🚀 Listo para empezar |
| 2. API Endpoints | 1-2 | 🚀 |
| 3. Frontend Web | 2-3 | 🚀 |
| 4. Mobile Components | 2-3 | 🚀 |
| 5. Testing & Seed | 1-2 | 🚀 |
| **TOTAL** | **8-13 horas** | |

---

## ARQUITECTURA FINAL

```
BancoCheck
├── Importa movimientos (CSV, manual)
├── Clasifica (estado, categoría)
├── Relaciona (con GastoCheck, CobraCheck, FacturaCheck)
├── Sugiere automáticamente (IA simple: amount match, date, supplier)
├── Audita todo (quién, qué, cuándo)
└── Responde: ¿Qué movimientos están explicados?

Flujo:
1. Admin/Contador importa CSV
2. Sistema detecta duplicados
3. Cada transacción comienza en "NEW"
4. Usuario puede:
   - Clasificar (gasto, depósito, etc)
   - Relacionar (con invoice/receipt/expense)
   - Marcar personal
   - Ignorar
5. Sistema sugiere automáticamente
6. Usuario acepta o descarta sugerencia
7. Transacción pasa a "EXPLAINED"
8. Dashboard muestra: ¿cuántas explicadas? ¿cuántas falta?
```

---

## NOTAS

- ✅ **NUNCA** transferir dinero real
- ✅ **NUNCA** almacenar credenciales
- ✅ Usar DECIMAL(19,2) siempre
- ✅ Idempotencia vía uniqueHash
- ✅ Tenant-scoping obligatorio
- ✅ Auditoría en cada acción
- ✅ Mobile-first UI
- ✅ RLS en BD

---

Listo para empezar Fase 1. ¿Procedo?
