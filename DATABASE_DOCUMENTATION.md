# 🗄️ DATABASE DOCUMENTATION

**Fecha:** 2026-06-19  
**Database:** PostgreSQL (Supabase)  
**Tables:** ~40 | Migraciones: 54

---

## 📊 SCHEMA OVERVIEW

```
┌─────────────────┐
│   auth.users    │
└────────┬────────┘
         │
         └──→ ┌──────────────────┐
              │     profiles     │
              └────────┬─────────┘
                       │
                       ├──→ ┌─────────────────┐
                       │    │ company_members │
                       │    └────────┬────────┘
                       │             │
                       │    ┌────────┴────────┬─────────────┐
                       │    │                 │             │
                       ├──→ │     companies   │             │
                       │    └────────┬────────┘             │
                       │             │                      │
                       │    ┌────────┴────────┐            │
                       │    │                 │            │
                       │    ├──→ cobra_clients           
                       │    │    cobra_invoices           
                       │    │    cobra_payments           
                       │    │                             │
                       │    ├──→ bank_accounts            
                       │    │    bank_transactions        
                       │    │                             │
                       │    ├──→ gastos_comprobantes      
                       │    │    gastos_categorias        
                       │    │                             │
                       │    └──→ inventario_productos     
                       │         inventario_movimientos   
                       │
                       └──→ audit_logs
```

---

## 📋 TABLA POR TABLA

### 1. **profiles** (Perfiles de usuario)

| Columna | Tipo | Nulo | Default | Descripción |
|---------|------|------|---------|-------------|
| id | UUID | ❌ | - | PK (de auth.users) |
| full_name | TEXT | ✅ | NULL | Nombre completo |
| email | TEXT | ✅ | NULL | Email |
| role | VARCHAR | ✅ | 'employee' | owner, admin, etc |
| created_at | TIMESTAMP | ❌ | now() | Fecha creación |
| updated_at | TIMESTAMP | ❌ | now() | Última actualización |

**Índices:**
```sql
CREATE INDEX idx_profiles_email ON profiles(email);
```

**RLS:** Usuarios solo ven su perfil

---

### 2. **companies** (Empresas)

| Columna | Tipo | Nulo | Default |
|---------|------|------|---------|
| id | UUID | ❌ | gen_random_uuid() |
| legal_name | VARCHAR(255) | ❌ | - |
| rfc | VARCHAR(13) | ✅ | NULL |
| sector | VARCHAR(100) | ✅ | NULL |
| status | VARCHAR(20) | ❌ | 'active' |
| created_at | TIMESTAMP | ❌ | now() |

**Índices:**
```sql
CREATE UNIQUE INDEX idx_companies_rfc ON companies(rfc);
CREATE INDEX idx_companies_status ON companies(status);
```

**RLS:** Usuarios solo ven empresas donde son miembros

---

### 3. **company_members** (Membresía empresa)

| Columna | Tipo | Nulo | Default |
|---------|------|------|---------|
| id | UUID | ❌ | gen_random_uuid() |
| user_id | UUID | ❌ | - |
| company_id | UUID | ❌ | - |
| role | VARCHAR(20) | ❌ | 'employee' |
| status | VARCHAR(20) | ❌ | 'active' |
| created_at | TIMESTAMP | ❌ | now() |

**FK:**
```sql
ALTER TABLE company_members ADD CONSTRAINT fk_user
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE company_members ADD CONSTRAINT fk_company
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
```

**Índices:**
```sql
CREATE UNIQUE INDEX idx_company_members_unique 
  ON company_members(user_id, company_id);
CREATE INDEX idx_company_members_role ON company_members(role);
```

---

### 4. **cobra_clients** (Clientes de cobranza)

| Columna | Tipo | Nulo | Default |
|---------|------|------|---------|
| id | UUID | ❌ | gen_random_uuid() |
| company_id | UUID | ❌ | - |
| name | VARCHAR(255) | ❌ | - |
| rfc | VARCHAR(13) | ✅ | NULL |
| email | VARCHAR(255) | ✅ | NULL |
| phone | VARCHAR(20) | ✅ | NULL |
| current_balance | NUMERIC(15,2) | ❌ | 0 |
| credit_limit | NUMERIC(15,2) | ✅ | NULL |
| risk_score | INTEGER | ❌ | 0 |
| days_without_payment | INTEGER | ❌ | 0 |
| status | VARCHAR(20) | ❌ | 'active' |

**Relaciones:**
- ↔ cobra_invoices (1:many)
- ↔ cobra_payments (1:many)

---

### 5. **cobra_invoices** (Facturas de cobranza)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID | PK |
| company_id | UUID | FK → companies |
| client_id | UUID | FK → cobra_clients |
| folio | VARCHAR(50) | Número de factura |
| amount | NUMERIC(15,2) | Monto |
| issue_date | DATE | Fecha emisión |
| due_date | DATE | Fecha vencimiento |
| status | VARCHAR(20) | pending, paid, partial, overdue |
| days_overdue | INTEGER | Días vencido (calculado) |

**Computed Column:**
```sql
GENERATED ALWAYS AS (
  CASE 
    WHEN status = 'overdue' 
    THEN (CURRENT_DATE - due_date) 
    ELSE NULL 
  END
) STORED
```

---

### 6. **bank_accounts** (Cuentas bancarias)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID | PK |
| company_id | UUID | FK |
| bank_name | VARCHAR(100) | Banco (BBVA, HSBC, etc) |
| account_number | VARCHAR(30) | Número de cuenta |
| account_type | VARCHAR(20) | checking, savings |
| is_active | BOOLEAN | ✅ Activa |

---

### 7. **bank_transactions** (Transacciones)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID | PK |
| bank_account_id | UUID | FK |
| transaction_date | DATE | Fecha |
| description | TEXT | Concepto |
| amount | NUMERIC(15,2) | Monto (+ ingreso, - egreso) |
| status | VARCHAR(20) | new, classified, matched |
| category | VARCHAR(50) | gasto, cobranza, anticipo, etc |

---

## 🔐 RLS POLICIES

### Política: Usuarios solo ven datos de su empresa

```sql
-- Ejemplo: cobra_clients
CREATE POLICY "Users see clients in their company"
ON cobra_clients
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users insert clients in their company"
ON cobra_clients
FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin', 'supervisor')
  )
);
```

---

## 📈 ÍNDICES CRÍTICOS

```sql
-- Búsquedas frecuentes
CREATE INDEX idx_cobra_clients_company_risk 
  ON cobra_clients(company_id, risk_score DESC);

CREATE INDEX idx_cobra_invoices_overdue 
  ON cobra_invoices(company_id, status, due_date) 
  WHERE status IN ('pending', 'overdue');

CREATE INDEX idx_bank_transactions_date 
  ON bank_transactions(bank_account_id, transaction_date DESC);

-- Full text search (futuro)
CREATE INDEX idx_clients_search 
  ON cobra_clients USING gin(to_tsvector('spanish', name));
```

---

## 🔄 RELACIONES CLAVE

```
companies (1) ──→ (many) company_members
           ├──→ (many) cobra_clients
           ├──→ (many) cobra_invoices
           ├──→ (many) bank_accounts
           └──→ (many) gastos_comprobantes

cobra_clients (1) ──→ (many) cobra_invoices
              └──→ (many) cobra_payments

bank_accounts (1) ──→ (many) bank_transactions
```

---

## 🧮 QUERIES COMUNES

### KPIs por Empresa

```sql
SELECT 
  c.id,
  c.legal_name,
  COUNT(DISTINCT cc.id) as total_clients,
  COALESCE(SUM(cc.current_balance), 0) as total_cartera,
  COUNT(DISTINCT CASE WHEN ci.status = 'overdue' THEN ci.id END) as overdue_count,
  AVG(cc.risk_score) as avg_risk_score
FROM companies c
LEFT JOIN cobra_clients cc ON c.id = cc.company_id
LEFT JOIN cobra_invoices ci ON cc.id = ci.client_id
WHERE c.id = $1
GROUP BY c.id, c.legal_name;
```

### Clientes en Riesgo

```sql
SELECT *
FROM cobra_clients
WHERE company_id = $1
  AND risk_score >= 70
  AND status = 'active'
ORDER BY risk_score DESC, current_balance DESC;
```

---

## 🚀 OPTIMIZACIONES FUTURAS

- [ ] Particionamiento de tabla cobra_invoices por año
- [ ] Materialized view para KPIs (refresh cada hora)
- [ ] Full-text search en clientes
- [ ] Denormalización de saldos (columna cached)
- [ ] Archive de transacciones antiguas

---

**Documentación generada:** 2026-06-19  
**Versión de DB:** PostgreSQL 14+
