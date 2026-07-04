# 🏦 BancoCheck — Arquitectura Completa

**Estado**: Draft → Implementación  
**Fecha**: 2026-07-04  
**Objetivo**: Hub integral de tesorería que conecta GastoCheck + CobraCheck + Contador

---

## 🎯 VISIÓN

BancoCheck es el **corazón financiero** de CHECK SUITE:

```
GastoCheck (Gastos)
    ↓
    → BancoCheck (Salidas de dinero)
    ↓
Contador exporta pólizas

CobraCheck (Ingresos)
    ↓
    → BancoCheck (Entradas de dinero)
    ↓
Contador reconcilia con banco
```

---

## 📊 SCHEMA SUPABASE (CREAR)

### **1. bank_accounts** (Tipos completos de cuentas)

```sql
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  
  -- Identificación
  name VARCHAR(100) NOT NULL,
  account_type VARCHAR(50) NOT NULL,
  
  -- bank_account, cash_register, savings, investment, credit_card, debit_card, bank_loan, private_loan
  bank_name VARCHAR(100),
  account_number VARCHAR(50),
  currency VARCHAR(3) DEFAULT 'MXN',
  
  -- Saldos
  current_balance DECIMAL(15, 2) DEFAULT 0,
  balance_last_reconcile DECIMAL(15, 2) DEFAULT 0,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **2. bank_transactions** (Movimientos integrados)

```sql
CREATE TABLE bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  bank_account_id UUID NOT NULL,
  
  description VARCHAR(500) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  transaction_date DATE NOT NULL,
  
  -- Integración
  source_module VARCHAR(50),  -- gastocheck, cobracheck, manual, ocr
  source_id UUID,
  
  -- Detalles
  payment_method VARCHAR(50),
  bank_reference_number VARCHAR(100),
  commission DECIMAL(15, 2) DEFAULT 0,
  tax_on_commission DECIMAL(15, 2) DEFAULT 0,
  
  category VARCHAR(100),
  status VARCHAR(50) DEFAULT 'new',
  
  -- OCR
  ocr_data JSONB,
  receipt_image_url VARCHAR(500),
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **3. bank_reconciliations** (Reconciliación mensual)

```sql
CREATE TABLE bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  bank_account_id UUID NOT NULL,
  
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  
  bank_statement_balance DECIMAL(15, 2) NOT NULL,
  system_balance DECIMAL(15, 2) NOT NULL,
  difference DECIMAL(15, 2),
  
  status VARCHAR(50) DEFAULT 'pending',
  reconciled_at TIMESTAMP,
  reconciled_by UUID
);
```

### **4. accounting_vouchers** (Pólizas contables)

```sql
CREATE TABLE accounting_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  
  voucher_number VARCHAR(50) NOT NULL UNIQUE,
  voucher_type VARCHAR(50) NOT NULL,
  
  source_module VARCHAR(50) NOT NULL,
  source_ids UUID[] NOT NULL,
  
  total_debit DECIMAL(15, 2) DEFAULT 0,
  total_credit DECIMAL(15, 2) DEFAULT 0,
  
  entries JSONB NOT NULL,
  
  exported_format VARCHAR(50),
  exported_at TIMESTAMP,
  
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔗 INTEGRACIONES CLAVE

### **GastoCheck → BancoCheck**
Cuando se crea expense → automáticamente crea bank_transaction con:
- `source_module = 'gastocheck'`
- `source_id = expense_id`
- `amount` negativo (salida)

### **CobraCheck → BancoCheck**
Cuando se registra cobro → automáticamente crea bank_transaction con:
- `source_module = 'cobracheck'`
- `source_id = collection_id`
- `amount` positivo (entrada)

### **OCR → BancoCheck**
Contador captura recibo → `useOcr()` [centralizado GastoCheck] → bank_transaction

### **Importación de archivos**
Contador descarga OFX/CSV de banco → parser → crea transactions

---

## 📋 EXPORTACIÓN PÓLIZAS

```
Contador: "Exportar junio como pólizas"
  ↓
Agrupa transactions por mes/tipo
  ↓
Genera accounting_vouchers
  ↓
Exporta: CSV, CONTPAQi XML, SAT XML
  ↓
Contador importa en software contable
```

---

## 🚀 IMPLEMENTACIÓN

**Fase 1**: Schema + RLS (Hoy)
**Fase 2**: Integraciones GastoCheck/CobraCheck (Hoy)
**Fase 3**: OCR + Importación archivos (Mañana)
**Fase 4**: Exportación pólizas (Mañana)
**Fase 5**: UI refactor (Mañana)

