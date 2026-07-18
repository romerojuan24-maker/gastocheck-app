# AUDITORÍA BASE 001 — MODELO DE DATOS ACTUAL
**Análisis de estructura y relaciones en Supabase**

---

## 1. TABLAS CORE (INIT)

**Archivo:** `20260606000001_init.sql`

### 1.1 Autenticación y Perfiles

| Tabla | Propósito | Campos clave | Estado |
|-------|-----------|-------------|--------|
| auth.users | Usuarios Supabase | id, email, created_at | ✅ Externo |
| profiles | Extensión de auth.users | id, full_name, phone, avatar_url | ✅ Existe |

### 1.2 Multi-Tenancy

| Tabla | Propósito | Campos clave | Estado |
|-------|-----------|-------------|--------|
| companies | Empresas/Tenants | id, name, rfc, plan, created_by | ✅ Existe |
| company_members | Miembros de empresa | id, company_id, user_id, role, status | ✅ Existe |
| invitations | Invitaciones pendientes | id, company_id, token, accepted, expires_at | ✅ Existe |

### 1.3 Catálogos

| Tabla | Propósito | Campos clave | Estado |
|-------|-----------|-------------|--------|
| expense_categories | Categorías de gastos | id, company_id, name, parent_id, default_account_id | ✅ Existe |
| accounting_accounts | Plan contable | id, company_id, code, name, account_type | ✅ Existe |
| cost_centers | Centros de costo | id, company_id, name, type, code | ✅ Existe |

### 1.4 Pólizas

| Tabla | Propósito | Campos clave | Estado |
|-------|-----------|-------------|--------|
| policies | Pólizas de gastos | id, company_id, holder_id, opening_balance, closing_balance, status | ✅ Existe |

### 1.5 Core del Negocio

| Tabla | Propósito | Campos clave | Estado |
|-------|-----------|-------------|--------|
| advances | Anticipos entregados | id, company_id, policy_id, amount, method, date | ✅ Existe |
| expenses | Gastos registrados | id, company_id, policy_id, spender_id, status, total | ✅ Existe |
| cfdi_data | Datos fiscales CFDI | expense_id, uuid, rfc_emisor, rfc_receptor, total | ✅ Existe |
| expense_attachments | Comprobantes | id, expense_id, kind, storage_path, mime, ocr_raw | ✅ Existe |

### 1.6 Auditoría

| Tabla | Propósito | Campos clave | Estado |
|-------|-----------|-------------|--------|
| expense_audit | Historial inmutable | id, expense_id, actor_id, action, from_status, to_status, payload | ✅ Existe |

---

## 2. TRIGGERS IDENTIFICADOS

### 2.1 Recálculo de Saldos

**Función:** `recompute_policy_closing()`
**Ubicación:** 20260606000001_init.sql:257-272

```sql
create or replace function recompute_policy_closing()
returns trigger language plpgsql as $$
declare v_policy uuid;
begin
  v_policy := coalesce(new.policy_id, old.policy_id);
  update policies p
  set closing_balance =
        p.opening_balance
        + coalesce((select sum(a.amount) from advances a where a.policy_id = p.id), 0)
        - coalesce((select sum(e.total) from expenses e
                    where e.policy_id = p.id
                      and e.status in ('authorized','invoice_applied','closed_in_policy')), 0)
  where p.id = v_policy;
  return null;
end;
$$;
```

**Triggers que lo usan:**
- `trg_advances_balance` — AFTER INSERT/UPDATE/DELETE on advances
- `trg_expenses_balance` — AFTER INSERT/UPDATE/DELETE on expenses

**Evaluación:** ✅ CORRECTO
- Se recalcula cuando cambia advance o expense
- Solo cuenta gastos autorizados
- Atomic operation

---

### 2.2 Touch Updated_at

**Función:** `touch_updated_at()`
**Ubicación:** 20260606000001_init.sql:283-288

```sql
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
```

**Trigger:**
- `trg_expenses_touch` — BEFORE UPDATE on expenses

**Evaluación:** ✅ CORRECTO

---

## 3. TABLAS EXTENSIONALES (POST-INIT)

### 3.1 Migraciones Clave

| Migración | Tablas nuevas | Propósito |
|-----------|---------------|-----------|
| 20260617200000 | reembolsos | Flujo de reembolsos |
| 20260614000000 | (modif) | Campos de reembolso |
| 20260616900000 | viaticos | Viáticos de empleados |
| 20260624000001 | accounts_payable | Cuentas por pagar |
| 20260625000000 | payment_receipts | Recibos de pago |
| 20260629010000 | company_bank_accounts | Cuentas bancarias |
| 20260618200000-004 | cobra_*, flujo_*, factura_*, inventario_* | Módulos verticales |

### 3.2 Nuevas Tablas por Módulo

**GastoCheck:**
- reembolsos
- viaticos
- accounts_payable
- payment_receipts
- company_bank_accounts

**CobraCheck:**
- invoices_sent
- accounts_receivable
- collections_activity
- collection_movements

**BancoCheck:**
- bank_transactions
- bank_accounts
- reconciliations
- auto_matches

**FlujoCheck:**
- cash_flow_projections
- scenarios

**FacturaCheck:**
- issued_invoices

**InventarioCheck:**
- inventory_items
- stock_movements

---

## 4. ENUMS Y TIPOS

**expense_status (19 estados):**
```
captured → pending_auth → authorized → pending_invoice 
→ invoice_applied → observed → rejected → deleted 
→ duplicate → closed_in_policy
```

**member_role:**
```
owner, supervisor, spender, office, accountant, admin (agregado después)
```

**member_status:**
```
active, invited, disabled
```

**company_plan:**
```
basico, equipo, empresa, corporativo
```

---

## 5. ÍNDICES DETECTADOS

**Índices explícitos creados:**

```sql
create index on company_members(user_id);
create index on company_members(company_id);
create index on policies(company_id, holder_id, status);
create index on advances(policy_id);
create index on expenses(company_id, status);
create index on expenses(policy_id);
create index on expenses(spender_id);
create index on expense_attachments(expense_id);
create index on expense_audit(expense_id);
create index on cfdi_data(uuid);
```

**Evaluación:** ✅ Bien indexado para queries comunes

---

## 6. RESTRICCIONES DE INTEGRIDAD

**Foreign Keys:**
- Todas las tablas con company_id → companies(id)
- Todas las tablas con user_id → auth.users(id)
- Todas cascading on delete

**Checks:**
- advances.amount > 0

**Unique Constraints:**
- company_members(company_id, user_id)
- accounting_accounts(company_id, code)
- invitations(token)

**Evaluación:** ✅ Completa

---

## 7. ANOMALÍAS DETECTADAS

### 7.1 Rol 'admin' agregado después

**Ubicación:** 20260617600000_fix_rls_and_seed_categories.sql:8, 14

```sql
DROP POLICY IF EXISTS "manage accounts" ON accounting_accounts;
CREATE POLICY "manage accounts" ON accounting_accounts FOR ALL
  USING  (auth_role(company_id) IN ('owner', 'accountant', 'admin'))
  WITH CHECK (auth_role(company_id) IN ('owner', 'accountant', 'admin'));
```

**Problema:** El enum member_role NO incluye 'admin'
**Impacto:** Si se intenta asignar rol 'admin', fallará en la BD
**Corrección:** Agregar 'admin' al enum member_role

### 7.2 Migraciones duplicadas/conflictivas

**Archivos:**
- expense_budgets: aparece en 20260614800000 y 20260615800000
- daily_routes: aparece en 20260614700000 y 20260704000000_resolve
- viaticos: aparece en 20260616900000 y 20260617000000

**Indicador:** Iteraciones múltiples sobre el mismo esquema
**Impacto:** ⚠️ RIESGO en ejecutar migraciones nuevamente (pueden fallar)

### 7.3 Datos SEED contaminan schema

**Ubicación:**
- 20260618100000_seed_mock_routes.sql → inserta daily_routes
- 20260618400000_seed_team_members.sql → inserta company_members
- 20260617600000 → inserta expense_categories

**Problema:** No hay forma de "unseed"
**Impacto:** Datos demo permanecen en producción

---

## 8. RELACIONES CRÍTICAS

```
auth.users
  ├─ profiles (1:1)
  ├─ company_members (1:N)
  │   └─ companies (N:1)
  │       ├─ policies (N:1)
  │       │   ├─ advances (1:N)
  │       │   └─ expenses (1:N)
  │       │       ├─ expense_attachments (1:N)
  │       │       ├─ cfdi_data (1:1)
  │       │       └─ expense_audit (1:N)
  │       ├─ expense_categories (1:N)
  │       ├─ accounting_accounts (1:N)
  │       └─ cost_centers (1:N)
  ├─ invitations (via company_id)
  └─ policies (holder_id)
```

---

## 9. VOLUMEN Y PERFORMANCE

**Tablas grandes esperadas:**
- expenses (N comprobantes × M años × P empresas)
- expense_attachments (1-3 por expense)
- expense_audit (2-4 por expense lifecycle)

**Índices suficientes:** ✅ Sí

**Triggers costosos:** 
- recompute_policy_closing() se dispara 2-3 veces por transacción completa
- Aceptable si policies ≤ 10,000

---

## 10. HALLAZGOS

### ✅ Lo Bien Construido
- Schema relacional correcto
- Integridad referencial mantenida
- Cascading deletes configurados
- Triggers para invariantes
- Índices estratégicos

### ⚠️ Problemas Detectados
- Rol 'admin' en policies pero no en enum
- Migraciones duplicadas/conflictivas
- Datos SEED en migraciones de producción
- Falta de versionamiento claro

### ❌ Bloqueadores
- Ninguno técnicamente, pero riesgo en deploy

