# BancoCheck — Checklist de Prueba Completa
**Fecha**: 2026-07-09  
**Versión**: 1.0 (Implementation Complete)

---

## 📋 RESUMEN EJECUTIVO

Este checklist cubre **9 dimensiones** de prueba para BancoCheck:

1. ✅ Funcional: import, classify, match, export
2. ✅ Seguridad: tenant isolation, RLS, authorization
3. ✅ Edge cases: CSV parsing, dedup, ACID, decimal precision
4. ✅ Performance: 1000+ transactions, indexing
5. ✅ UI/UX: responsivo, móvil, accesibilidad
6. ✅ Integración: GastoCheck, CobraCheck, FacturaCheck
7. ✅ Data integrity: Audit trail, compliance
8. ✅ API contracts: DTOs, validación, error handling
9. ✅ Deployment: Railway, migrations, rollback

---

## 1️⃣ FUNCIONAL — CORE FLOWS

### 1.1 Crear cuenta bancaria
- [ ] **POST /api/bancocheck/accounts**
  - [ ] Crear BBVA Nóminas (corriente, MXN)
  - [ ] Crear Banorte Operativo (corriente, MXN)
  - [ ] Crear Santander Ahorros (ahorros, MXN)
  - [ ] Validar que accountNumberLast4 se almacena (no el número completo)
  - [ ] Balance inicial se cargar correctamente
  - [ ] Nombre, bank_name, type se guardan

- [ ] **GET /api/bancocheck/accounts**
  - [ ] Lista todas las cuentas del tenant
  - [ ] Excluye cuentas de otros tenants (RLS)
  - [ ] Retorna id, name, bankName, accountNumberLast4, currency, type

### 1.2 Importar CSV
- [ ] **POST /api/bancocheck/import-csv**
  - [ ] Subir `extracto_julio_2026.csv` (50 filas)
  - [ ] Sistema genera `fileHash` SHA256
  - [ ] Sistema genera `uniqueHash` por transacción
  - [ ] Crea `bank_import_batch` con status='completed'
  - [ ] Retorna `totalRows`, `importedRows`, `duplicateRows`, `errorRows`
  - [ ] Audit log creado en `bank_audit_log`

- [ ] **Deduplicación**
  - [ ] Importar mismo CSV 2 veces → 50 duplicados en 2ª importación
  - [ ] No se crean transacciones duplicadas
  - [ ] `duplicateRows` count es correcto (50)
  - [ ] Transacciones originales sin cambios

- [ ] **Parseo flexible de fecha**
  - [ ] CSV con `2026-07-01` (YYYY-MM-DD) → se parsea correctamente
  - [ ] CSV con `01/07/2026` (DD/MM/YYYY) → se parsea correctamente
  - [ ] CSV con `01-07-2026` (DD-MM-YYYY) → se parsea correctamente
  - [ ] Fila con fecha vacía → `errorCount++`

- [ ] **Decimales con precisión**
  - [ ] Importar `$1,500.99` → almacena `1500.99` (DECIMAL no float)
  - [ ] Importar `1.500,00` (formato EU) → se parsea sin error
  - [ ] Cálculo de balance acumulativo correcto
  - [ ] Exportar CSV muestra siempre 2 decimales

### 1.3 Ver transacciones
- [ ] **GET /api/bancocheck/transactions**
  - [ ] Lista todas las transacciones del tenant
  - [ ] Filtro por `?status=NEW` retorna solo NEW
  - [ ] Filtro por `?status=EXPLAINED` retorna solo EXPLAINED
  - [ ] Filtro por `?bankAccountId=acc_1` retorna solo de esa cuenta
  - [ ] Ordenadas por fecha DESC
  - [ ] Incluye debit, credit, date, description, status, category

- [ ] **GET /api/bancocheck/transactions/:id**
  - [ ] Obtener detalles de una transacción
  - [ ] Incluye sugerencias de match relacionadas
  - [ ] Incluye historial de cambios (audit log)

### 1.4 Clasificar transacción
- [ ] **PATCH /api/bancocheck/transactions/:id/classify**
  - [ ] Cambiar status: `NEW` → `EXPLAINED`
  - [ ] Cambiar categoría: `null` → `gasto_negocio`
  - [ ] Agregar notas: `null` → `Compra ACME Inc`
  - [ ] Audit log registra `oldValue` y `newValue`
  - [ ] Timestamp de cambio se graba

- [ ] **Estados válidos**
  - [ ] NEW → transacción sin explicar
  - [ ] EXPLAINED → clasificada y relacionada
  - [ ] NEEDS_RECEIPT → falta comprobante
  - [ ] NEEDS_INVOICE → falta factura
  - [ ] NEEDS_PAYMENT_COMPLEMENT → falta complemento de pago
  - [ ] UNIDENTIFIED → no se puede clasificar
  - [ ] PERSONAL → gasto/ingreso personal
  - [ ] IGNORED → ignorar

### 1.5 Relacionar transacción a entity
- [ ] **PATCH /api/bancocheck/transactions/:id/match**
  - [ ] Match a invoice: `entityType=invoice`, `entityId=inv_123`
  - [ ] Match a collection: `entityType=collection`, `entityId=col_456`
  - [ ] Match a expense: `entityType=expense`, `entityId=exp_789`
  - [ ] Status cambia automáticamente a `EXPLAINED`
  - [ ] Confidence se almacena (default 100)
  - [ ] Audit log registra match

- [ ] **Sugerencias automáticas**
  - [ ] POST `/api/bancocheck/transactions/:id/suggest-matches`
  - [ ] Retorna lista de sugerencias con confidence > 70%
  - [ ] Reasons: `amount_matches`, `supplier_in_description`, `date_proximity`
  - [ ] User puede aceptar una sugerencia sin editar

### 1.6 Marcar como personal
- [ ] **PATCH /api/bancocheck/transactions/:id/mark-personal**
  - [ ] Cambiar `isPersonal: false` → `true`
  - [ ] Status cambia a `PERSONAL`
  - [ ] Transacciones personales excluidas de reportes de negocio
  - [ ] Deben marcarse manualmente (no hay auto-detection)

### 1.7 Ignorar transacción
- [ ] **PATCH /api/bancocheck/transactions/:id/ignore**
  - [ ] Status cambia a `IGNORED`
  - [ ] Notas: razón por qué ignorar
  - [ ] Excluidas de reportes (pero auditable)
  - [ ] Ej: comisiones duplicadas, transacciones de otros años

### 1.8 Dashboard
- [ ] **GET /api/bancocheck/dashboard**
  - [ ] `totalTransactions`: 50
  - [ ] `unexplainedCount`: 10 (status=NEW)
  - [ ] `explainedPercentage`: 80%
  - [ ] `personalCount`: 3
  - [ ] `recentTransactions`: últimas 10
  - [ ] KPIs se actualizan en real-time

### 1.9 Exportar a CSV
- [ ] **GET /api/bancocheck/export?bankAccountId=acc_1**
  - [ ] Descarga CSV con todas las transacciones
  - [ ] Incluye: fecha, descripción, débito, crédito, estado, categoría
  - [ ] Encoding UTF-8 con BOM
  - [ ] Decimales siempre 2 dígitos

---

## 2️⃣ SEGURIDAD — RLS & AUTHORIZATION

### 2.1 Multi-tenancy (RLS)
- [ ] **Tenant isolation en BD**
  - [ ] User de tenant_A no puede ver transacciones de tenant_B
  - [ ] Query `/api/bancocheck/transactions?tenantId=other_tenant` retorna 403
  - [ ] RLS policy: `SELECT * WHERE tenant_id = auth.uid()::text`
  - [ ] Validar en Supabase UI que RLS está enabled

- [ ] **Audit trail tenant-safe**
  - [ ] Audit log solo visible para mismo tenant
  - [ ] No hay cross-tenant data leaks en historial

### 2.2 Authorization
- [ ] **Only authenticated users can access**
  - [ ] Request sin JWT retorna 401
  - [ ] JWT inválido retorna 401
  - [ ] JWT expirado retorna 401

- [ ] **Roles (Admin vs Contable vs Operativo)**
  - [ ] Admin: ver todo, editar todo, importar, exportar
  - [ ] Contable: ver todo, clasificar, exportar (no importar)
  - [ ] Operativo: ver/clasificar solo movimientos sin explicar (no exportar)
  - [ ] *(Implementar en siguiente fase si required)*

### 2.3 No data exposure
- [ ] **Números completos de cuenta no expuestos**
  - [ ] API retorna solo `accountNumberLast4`
  - [ ] Logs no contienen números completos
  - [ ] Exportaciones no incluyen números completos

- [ ] **Passwords/tokens no en logs**
  - [ ] Bank credentials no se almacenan (solo número último 4 dígitos)
  - [ ] Import batch no contiene credentials

---

## 3️⃣ EDGE CASES — ROBUSTEZ

### 3.1 CSV parsing
- [ ] **Formatos de fecha**
  - [ ] YYYY-MM-DD ✓
  - [ ] DD/MM/YYYY ✓
  - [ ] DD-MM-YYYY ✓
  - [ ] Fecha vacía → error
  - [ ] Fecha inválida (29 Feb no-leap-year) → error

- [ ] **Formatos de monto**
  - [ ] `1500.00` ✓
  - [ ] `1,500.00` (con separador de miles) ✓
  - [ ] `$1,500.00` (con signo) ✓
  - [ ] `1.500,00` (EU format) → se parsea sin error
  - [ ] `-1500.00` (negativo) ✓
  - [ ] `0.01` (centavos) ✓
  - [ ] Monto vacío → default `0`

- [ ] **Headers flexibles**
  - [ ] Lowercase: `fecha`, `descripcion`, `debito`, `credito` ✓
  - [ ] Mixed case: `Fecha`, `Descripción`, `Débito`, `Crédito` ✓
  - [ ] English: `date`, `description`, `debit`, `credit` ✓
  - [ ] CSV sin headers → error (requiere headers)

- [ ] **Descripciones problemáticas**
  - [ ] Descripción con comas: `"PAGO, ACME INC"` (quoted) ✓
  - [ ] Descripción con saltos: `"PAGO\nACME"` → se parsea
  - [ ] Descripción vacía → error
  - [ ] Descripción muy larga (500 chars) → se trunca a 255

- [ ] **Filas malformadas**
  - [ ] Fila con menos columnas → error
  - [ ] Fila con más columnas → ignore extra columns
  - [ ] Fila vacía → skip
  - [ ] CSV vacío → `totalRows=0`, `importedRows=0`

### 3.2 Deduplicación
- [ ] **uniqueHash idempotency**
  - [ ] Hash(mismo fecha+desc+debit+credit+ref) = Hash(mismo) ✓
  - [ ] Hash(diferente monto) ≠ Hash(mismo) ✓
  - [ ] Hash sensible a fecha (1 día diferencia = diferente hash) ✓

- [ ] **Importación parcial**
  - [ ] Batch 1: importa 50 filas
  - [ ] Batch 2: intenta importar 40 lín (10 duplicadas) → importa 30, 10 duplicadas
  - [ ] Transacciones originales sin cambios

### 3.3 ACID compliance
- [ ] **All-or-nothing import**
  - [ ] Si parsing falla → no se crea batch
  - [ ] Si DB insert falla → transacción rollback
  - [ ] Si audit log falla → no se marca como completado

- [ ] **Concurrent imports**
  - [ ] 2 usuarios importan simultáneamente → sin race conditions
  - [ ] Dedup check es atomic
  - [ ] Final count correcto

### 3.4 Decimal precision
- [ ] **DECIMAL(19,2) storage**
  - [ ] `1234567890123456.99` se almacena correctamente (max 19 total digits, 2 decimals)
  - [ ] `0.01` sin error de redondeo (verificar vs float)
  - [ ] Suma de 100 filas de `0.33` sin drift
  - [ ] Export CSV muestra `X.XX` siempre

### 3.5 State machine validation
- [ ] **Transiciones válidas**
  - [ ] NEW → EXPLAINED ✓
  - [ ] NEW → PERSONAL ✓
  - [ ] NEW → IGNORED ✓
  - [ ] NEW → NEEDS_RECEIPT ✓
  - [ ] EXPLAINED → NEW (puede revirtarse) ✓
  - [ ] EXPLAINED → PERSONAL (reclasificar) ✓

- [ ] **Transiciones inválidas**
  - [ ] PERSONAL → EXPLAINED (sin permiso) → error o log warning

---

## 4️⃣ PERFORMANCE

### 4.1 Query optimization
- [ ] **Índices en BD**
  - [ ] Index on `(tenant_id, bank_account_id)` ✓ (definido en migration)
  - [ ] Index on `(tenant_id, status)` ✓
  - [ ] Index on `(tenant_id, date)` ✓
  - [ ] Index on `(tenant_id, import_batch_id, unique_hash)` ✓ (UNIQUE constraint)

- [ ] **Query performance**
  - [ ] GET `/api/bancocheck/transactions` con 10k rows < 500ms
  - [ ] GET `/api/bancocheck/dashboard` < 200ms
  - [ ] GET `/api/bancocheck/accounts` < 100ms

### 4.2 Pagination (future)
- [ ] **GET `/api/bancocheck/transactions?limit=50&offset=0`**
  - [ ] *(Agregar en fase 2)*
  - [ ] Evita cargar 100k filas en memoria

### 4.3 Batch import scaling
- [ ] **Importar 1000+ rows**
  - [ ] Parse CSV < 1s
  - [ ] Dedup check < 2s
  - [ ] DB insert (ACID) < 5s
  - [ ] Total < 10s
  - [ ] No memory leak

### 4.4 Concurrent users
- [ ] **5 usuarios simultáneamente**
  - [ ] Sin deadlocks en BD
  - [ ] Sin race conditions en dedup
  - [ ] Responsiveness mantenido

---

## 5️⃣ UI/UX — FRONTEND & MOBILE

### 5.1 Dashboard (Next.js)
- [ ] **Renderización**
  - [ ] Carga en < 2s
  - [ ] KPI cards muestran números correctos
  - [ ] Botones de navegación funcionan
  - [ ] Responsive en mobile (375px)

- [ ] **Mobile layout**
  - [ ] Grid 1-column en mobile
  - [ ] Grid 2-column en tablet
  - [ ] Grid 4-column en desktop
  - [ ] Texto legible (font-size 14px+ mobile)
  - [ ] Botones > 48px tap target

### 5.2 Transaction list
- [ ] **Tabla filtrable**
  - [ ] Click status badge filtra
  - [ ] Ordenable por fecha DESC
  - [ ] Search por descripción (future)
  - [ ] Debits en rojo, credits en verde

- [ ] **Detail modal (TODO)**
  - [ ] Click transacción abre modal
  - [ ] Muestra descripción, monto, fecha, estado
  - [ ] Muestra sugerencias de match
  - [ ] Botones: "Clasificar", "Relacionar", "Marcar personal", "Ignorar"

### 5.3 Classify modal (TODO)
- [ ] **Formulario**
  - [ ] Dropdown status (NEW, EXPLAINED, etc.)
  - [ ] Input categoría (autocomplete)
  - [ ] Textarea notas (200 chars)
  - [ ] Botón guardar
  - [ ] Cancel button

### 5.4 Match modal (TODO)
- [ ] **Seleccionar entity**
  - [ ] Dropdown entity type (invoice, expense, collection, payment)
  - [ ] Search entity ID
  - [ ] Mostrar detalles de entity seleccionado
  - [ ] Confidence slider
  - [ ] Botón "Aceptar match"

### 5.5 Import form
- [ ] **File upload**
  - [ ] Drag & drop CSV
  - [ ] File input button
  - [ ] Validar .csv extension
  - [ ] Mostrar file size

- [ ] **Account selector**
  - [ ] Dropdown cargable desde API
  - [ ] Muestra `name (bankName)`
  - [ ] Required validation

- [ ] **Result display**
  - [ ] Green success card
  - [ ] Summary: total, imported, duplicates, errors
  - [ ] Button "Go to Dashboard"
  - [ ] Error details if any

### 5.6 Mobile (React Native) — TODO
- [ ] **Home screen**
  - [ ] Dashboard stats (flex cards)
  - [ ] Action buttons (import, view all, accounts)
  - [ ] Swipe gestures

- [ ] **Transaction card (swipeable)**
  - [ ] Swipe right → mark as explained (green confirm)
  - [ ] Swipe left → review later (orange defer)
  - [ ] Tap → detail modal
  - [ ] Long press → quick actions menu

- [ ] **Dark mode**
  - [ ] Verificar colores en dark mode
  - [ ] Text contrast > 4.5:1

### 5.7 Accessibility
- [ ] **WCAG 2.1 AA**
  - [ ] Botones tienen labels
  - [ ] Inputs tienen labels
  - [ ] Color no es único medio de información
  - [ ] Tab order correcto
  - [ ] Screen reader compatible

---

## 6️⃣ INTEGRACIÓN — OTROS MÓDULOS

### 6.1 GastoCheck
- [ ] **Sync de gastos**
  - [ ] BancoCheck transacción (debit) → puede related a GastoCheck expense
  - [ ] Si GastoCheck expense se elimina → BancoCheck match clearea (orphan handling)
  - [ ] GastoCheck puede generar propuestas de match (2-way sync)

### 6.2 CobraCheck
- [ ] **Sync de cobros**
  - [ ] BancoCheck transacción (credit) → puede related a CobraCheck collection
  - [ ] Si collection pagada → BancoCheck transacción marcada EXPLAINED automáticamente
  - [ ] Monto balance

### 6.3 FacturaCheck
- [ ] **Sync de facturas**
  - [ ] BancoCheck transacción (debit) → puede related a FacturaCheck invoice
  - [ ] Validar monto coincide
  - [ ] Si factura vencida → warning en UI

### 6.4 FlujoCheck (future)
- [ ] **Cash flow forecast**
  - [ ] BancoCheck histórico → alimenta FlujoCheck
  - [ ] Patrones de gastos/ingresos

---

## 7️⃣ DATA INTEGRITY — AUDIT & COMPLIANCE

### 7.1 Audit trail
- [ ] **bank_audit_log**
  - [ ] Toda acción logged: import, classify, match, mark_personal, ignore
  - [ ] Fields: id, tenant_id, user_id, action, old_value, new_value, timestamp, reason
  - [ ] Immutable (no updates/deletes)

- [ ] **Sample audit log flow**
  - [ ] Import: action='import_csv', newValue={batchId, importedRows: 50, ...}
  - [ ] Classify: action='classify', oldValue={status: 'NEW'}, newValue={status: 'EXPLAINED', category: 'gasto_negocio'}
  - [ ] Match: action='match', newValue={entityType: 'invoice', entityId: 'inv_123', confidence: 95}

### 7.2 Compliance
- [ ] **No PII in logs**
  - [ ] Account holders' names no en audit log
  - [ ] Only `accountNumberLast4` in logs

- [ ] **Record retention**
  - [ ] Audit logs no se borran (compliance 7+ años)
  - [ ] Deleted transactions archivados, no hard-deleted
  - [ ] *(Implement soft-delete flag if needed)*

### 7.3 Data validation
- [ ] **Constraints en BD**
  - [ ] `debit >= 0` ✓
  - [ ] `credit >= 0` ✓
  - [ ] `debit > 0 XOR credit > 0` (only one non-zero) ✓
  - [ ] `status` IN (NEW, EXPLAINED, ...) ✓
  - [ ] `tenant_id` NOT NULL ✓

---

## 8️⃣ API CONTRACTS — DTOs & VALIDATION

### 8.1 Request validation
- [ ] **POST /accounts**
  ```json
  {
    "name": "required, 1-255 chars",
    "bankName": "required",
    "accountNumberLast4": "required, 4 digits",
    "currency": "optional, default MXN",
    "type": "required (corriente, ahorros, ...)"
  }
  ```
  - [ ] Missing fields → 400
  - [ ] accountNumberLast4 not 4 digits → 400
  - [ ] name > 255 → 400

- [ ] **POST /import-csv**
  ```json
  {
    "bankAccountId": "required, UUID format",
    "fileName": "required",
    "csvData": "required, non-empty string"
  }
  ```
  - [ ] Missing fields → 400
  - [ ] csvData empty → 400
  - [ ] bankAccountId invalid → 404

- [ ] **PATCH /transactions/:id/classify**
  ```json
  {
    "status": "required, one of enum",
    "category": "optional",
    "notes": "optional, max 500 chars"
  }
  ```
  - [ ] Invalid status → 400
  - [ ] notes > 500 → 400

### 8.2 Response DTOs
- [ ] **BankTransactionDto**
  ```json
  {
    "id": "uuid",
    "date": "ISO date",
    "description": "string",
    "debit": "DECIMAL string",
    "credit": "DECIMAL string",
    "status": "enum",
    "category": "string or null",
    "isPersonal": "boolean",
    "matchedEntityType": "string or null",
    "matchedEntityId": "string or null",
    "confidence": "integer or null"
  }
  ```
  - [ ] All fields present
  - [ ] Decimals as strings, not numbers
  - [ ] Enums válidos

### 8.3 Error responses
- [ ] **400 Bad Request**
  - [ ] Mensaje describe el problema
  - [ ] Status: 400
  
- [ ] **401 Unauthorized**
  - [ ] Sin JWT
  - [ ] Mensaje: "Unauthorized"

- [ ] **403 Forbidden**
  - [ ] Otro tenant's data
  - [ ] Mensaje: "Access denied"

- [ ] **404 Not Found**
  - [ ] Transacción no existe
  - [ ] Mensaje: "Transaction not found"

- [ ] **500 Server Error**
  - [ ] DB error
  - [ ] Mensaje: generic "Internal server error"
  - [ ] Error details logged, no exposed to client

---

## 9️⃣ DEPLOYMENT — RAILWAY & MIGRATIONS

### 9.1 Database migration
- [ ] **Migration file created**
  - [ ] `supabase/migrations/20260709000000_bancocheck_redesigned.sql`
  - [ ] Contains: CREATE TABLEs, RLS policies, indexes, constraints
  - [ ] No hardcoded data (use seed data separately)

- [ ] **Run migration on production**
  - [ ] `supabase migration up` (local)
  - [ ] Verify tables exist: `\dt` in psql
  - [ ] Verify RLS: `\des` shows policies
  - [ ] Verify indexes: `\di` shows indexes

- [ ] **Rollback capability**
  - [ ] Create `down()` migration if needed
  - [ ] Tested locally first
  - [ ] Document steps for emergency rollback

### 9.2 Prisma schema sync
- [ ] **Schema matches DB**
  - [ ] `npx prisma db pull` (auto-generate from DB)
  - [ ] Compare against BANCOCHECK_IMPL_SPEC.prisma
  - [ ] No discrepancies
  - [ ] `npx prisma generate` creates client

### 9.3 Environment variables
- [ ] **Railway env vars set**
  - [ ] `DATABASE_URL` → Supabase connection string
  - [ ] `JWT_SECRET` → valid
  - [ ] `NODE_ENV=production`

- [ ] **No secrets in code**
  - [ ] No hardcoded passwords
  - [ ] No API keys in git
  - [ ] `.env.local` in `.gitignore`

### 9.4 Deployment steps
- [ ] **Pre-deployment**
  - [ ] All tests pass locally
  - [ ] No TypeScript errors: `npm run type-check`
  - [ ] No linting errors: `npm run lint`
  - [ ] Build succeeds: `npm run build`

- [ ] **Deploy to Railway**
  - [ ] Push to main branch
  - [ ] Railway auto-deploys
  - [ ] Verify endpoint accessible: `https://statika-erp-production.up.railway.app/api/bancocheck/accounts`
  - [ ] Smoke test: GET accounts returns 200

- [ ] **Post-deployment**
  - [ ] Check logs for errors: `railway logs`
  - [ ] Verify RLS in production: test cross-tenant access
  - [ ] Run seed data if needed: `npx ts-node supabase/seeds/bancocheck-demo.ts`
  - [ ] Verify dashboard KPIs display correctly

### 9.5 Monitoring
- [ ] **Logs**
  - [ ] Check Railway logs for errors
  - [ ] Monitor CSV import errors
  - [ ] Alert on 500 responses

- [ ] **Metrics (future)**
  - [ ] Track import latency
  - [ ] Track classification rate
  - [ ] Track unexplained % trend

---

## 🎯 EXECUTIVE TEST PLAN

| # | Feature | Priority | Owner | Status |
|---|---------|----------|-------|--------|
| 1 | Create account | P0 | QA | ⏳ |
| 2 | Import CSV (happy path) | P0 | QA | ⏳ |
| 3 | Deduplication | P0 | QA | ⏳ |
| 4 | Classify transaction | P0 | QA | ⏳ |
| 5 | Match transaction | P0 | QA | ⏳ |
| 6 | RLS isolation | P0 | Security | ⏳ |
| 7 | Decimal precision | P1 | QA | ⏳ |
| 8 | CSV edge cases | P1 | QA | ⏳ |
| 9 | Dashboard KPIs | P1 | QA | ⏳ |
| 10 | Export CSV | P1 | QA | ⏳ |
| 11 | Audit trail | P1 | Compliance | ⏳ |
| 12 | Mobile UI | P2 | QA | ⏳ |
| 13 | Dark mode | P2 | QA | ⏳ |
| 14 | Performance (1000 rows) | P2 | QA | ⏳ |
| 15 | GastoCheck sync | P2 | Integration | ⏳ |

---

## ✅ SIGN-OFF

| Role | Name | Date | Status |
|------|------|------|--------|
| QA Lead | — | — | ⏳ |
| Security | — | — | ⏳ |
| Product | — | — | ⏳ |
| Engineering Lead | — | — | ⏳ |

**Ready for production: NO** (until all P0 tests pass)

---

## 📝 NOTES FOR TESTERS

1. **Use demo tenant** for testing (sandboxed)
2. **Never use production accounts** in tests
3. **Document failures** with screenshots and error logs
4. **Test both happy path AND edge cases**
5. **Performance test** with realistic data volumes (50-1000 rows)
6. **Security test** with different user roles and tenants
7. **Mobile test** on actual device, not just browser dev tools

---

**Última actualización**: 2026-07-09 | BancoCheck v1.0 RC1
