# 🌊 FLUJOCHECK — Arquitectura Completa: Cash Flow Control + Credit Management

**Propósito**: Middleware orquestador entre GastoCheck (salidas) + CobraCheck (entradas) + FacturaCheck (facturas) + BancoCheck (movimientos) → **Control inteligente del flujo de caja**  
**Core**: Decisiones semanales sobre qué pagar, cuándo pagar, con qué pagar  
**Sofisticación**: Gestión de créditos con pagos parciales, intereses, vencimientos, escenarios  
**Valor**: "Sin preguntar, sé cómo quedan mis saldos, pagos futuros y si puedo pagar mis cuentas"

---

## 🎯 DEFINICIÓN CONCEPTUAL

**FlujoCheck = Cash Flow Control Center**

```
INPUTS (desde otros módulos):
├─ GastoCheck: Egresos (gastos, anticipos, anticipos devueltos)
├─ CobraCheck: Ingresos (cobros, depósitos)
├─ FacturaCheck: Documentación de transacciones
└─ BancoCheck: Saldos reales, movimientos bancarios

PROCESSING:
├─ Proyectar flujo semanal (ingresos vs egresos)
├─ Identificar cuentas por pagar
├─ Calcular capacidad pago
├─ Gestionar créditos (pagos parciales + intereses)
├─ Simular escenarios ("qué si pago X extra?")
└─ Recalcular saldos futuros automáticamente

OUTPUTS:
├─ Dashboard flujo semanal
├─ Plan pagos (qué pagar esta semana)
├─ Proyecciones saldos (próximas 4-12 semanas)
├─ Alertas (falta dinero, sobra, vencimiento próximo)
└─ Decisiones (pagar, diferir, buscar financiamiento)
```

---

## 📋 ENTIDADES: Schema Completo

### 1. TABLA: `cash_flow_periods` (Semanal)

```sql
CREATE TABLE cash_flow_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  -- Período
  period_start DATE NOT NULL,      -- Lunes semana
  period_end DATE NOT NULL,        -- Domingo semana
  week_number INT,                 -- Semana del año
  year INT,                        -- Año
  
  -- Saldos
  opening_balance DECIMAL(15,2),   -- Saldo inicial (lunes)
  projected_inflows DECIMAL(15,2), -- Dinero esperado entrar
  projected_outflows DECIMAL(15,2),-- Dinero esperado salir
  closing_balance DECIMAL(15,2),   -- Saldo proyectado (domingo)
  
  -- Actual (después de ejecutar)
  actual_inflows DECIMAL(15,2),
  actual_outflows DECIMAL(15,2),
  actual_closing_balance DECIMAL(15,2),
  
  -- Status
  status TEXT DEFAULT 'planning',  -- planning, executing, closed, reconciled
  is_locked BOOLEAN DEFAULT false, -- True = no se puede editar
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  closed_at TIMESTAMP
);

CREATE INDEX idx_company_period ON cash_flow_periods(company_id, period_start);
CREATE INDEX idx_status ON cash_flow_periods(company_id, status);
```

### 2. TABLA: `payables` (Cuentas por pagar - detalle)

```sql
CREATE TABLE payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  -- Identificación
  reference_id TEXT,               -- "INV-2026-001", "PROV-ABC", etc.
  payee_name TEXT NOT NULL,        -- Proveedor, acreedor
  payee_id UUID,                   -- Link a contacts tabla (si existe)
  
  -- Monto original
  original_amount DECIMAL(15,2) NOT NULL,
  currency TEXT DEFAULT 'MXN',
  
  -- Pagos y saldo
  total_paid DECIMAL(15,2) DEFAULT 0,     -- Total pagado hasta ahora
  remaining_balance DECIMAL(15,2),        -- Lo que falta pagar
  
  -- Vencimiento
  due_date DATE,                   -- Cuándo vence
  days_overdue INT DEFAULT 0,      -- Si está vencida
  
  -- CRÉDITO ESPECÍFICO (si aplica)
  is_credit BOOLEAN DEFAULT false,
  credit_type TEXT,                -- 'installment_loan', 'line_of_credit', 'supplier_credit', 'invoice_credit'
  
  -- Pagos parciales (si es crédito)
  payment_schedule_type TEXT,      -- 'fixed_payment', 'variable_payment', 'balloon', 'custom'
  
  -- COSTOS FINANCIEROS
  has_interest BOOLEAN DEFAULT false,
  interest_rate DECIMAL(5,4),      -- Tasa mensual (ej: 0.0200 = 2% mensual)
  interest_type TEXT,              -- 'simple', 'compound', 'amortized'
  accumulated_interest DECIMAL(15,2) DEFAULT 0,
  
  -- Estado
  status TEXT DEFAULT 'pending',   -- pending, scheduled, partially_paid, paid, overdue, delinquent
  payment_terms TEXT,              -- "Net 30", "Due on receipt", "2/10 Net 30"
  
  -- Tracking
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  paid_at TIMESTAMP
);

CREATE INDEX idx_company_status ON payables(company_id, status);
CREATE INDEX idx_due_date ON payables(company_id, due_date);
CREATE INDEX idx_remaining ON payables(company_id, remaining_balance DESC);
```

### 3. TABLA: `payment_schedule` (Plan de pagos de un crédito)

```sql
CREATE TABLE payment_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_id UUID NOT NULL REFERENCES payables(id),
  
  -- Pago programado
  payment_number INT,              -- Pago 1, 2, 3, etc.
  scheduled_date DATE,             -- Cuándo vence este pago
  scheduled_payment_amount DECIMAL(15,2), -- Monto del pago
  interest_portion DECIMAL(15,2),  -- Cuánto es interés
  principal_portion DECIMAL(15,2), -- Cuánto reduce el principal
  
  -- Saldo después del pago (proyectado)
  projected_balance_after_payment DECIMAL(15,2),
  
  -- Actual (si ya se pagó)
  actual_payment_amount DECIMAL(15,2),
  actual_payment_date DATE,
  actual_balance_after_payment DECIMAL(15,2),
  
  -- Si el pago se hizo diferente
  difference_from_schedule DECIMAL(15,2), -- Si pagó más/menos
  recalculated_at TIMESTAMP,      -- Cuándo se recalculó la vida del crédito
  
  -- Metadata
  status TEXT DEFAULT 'pending',   -- pending, paid, skipped, modified
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_payable_date ON payment_schedule(payable_id, scheduled_date);
```

### 4. TABLA: `receivables` (Cuentas por cobrar - análogo a payables)

```sql
CREATE TABLE receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  customer_name TEXT NOT NULL,
  customer_id UUID,
  reference_id TEXT,
  
  original_amount DECIMAL(15,2) NOT NULL,
  total_received DECIMAL(15,2) DEFAULT 0,
  remaining_balance DECIMAL(15,2),
  
  due_date DATE,
  days_overdue INT DEFAULT 0,
  
  status TEXT DEFAULT 'pending',   -- pending, partially_received, received, overdue
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_company_status ON receivables(company_id, status);
```

### 5. TABLA: `weekly_payment_plan` (Plan de pagos para esta semana)

```sql
CREATE TABLE weekly_payment_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES cash_flow_periods(id),
  
  -- Cuenta por pagar
  payable_id UUID NOT NULL REFERENCES payables(id),
  
  -- Decisión de pago
  minimum_due_this_week DECIMAL(15,2), -- Pago mínimo recomendado
  suggested_payment DECIMAL(15,2),      -- Sugerencia IA
  selected_payment DECIMAL(15,2),       -- Lo que DECIDISTE pagar
  
  -- Prioridad
  priority_score INT,                    -- 1-100 (urgencia, vencimiento, etc)
  reason_for_priority TEXT,
  
  -- Impacto
  impact_on_balance DECIMAL(15,2),      -- Cómo afecta el balance semanal
  impact_on_credit_health TEXT,         -- "reduce vencimiento en 30 días", etc.
  
  -- Status
  is_selected BOOLEAN DEFAULT false,    -- ¿Está en el plan final?
  payment_status TEXT DEFAULT 'planned', -- planned, queued, paid, failed
  
  -- Metadata
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_period_priority ON weekly_payment_plan(period_id, priority_score DESC);
```

### 6. TABLA: `credit_projection` (Simulación futura del crédito)

```sql
CREATE TABLE credit_projection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_id UUID NOT NULL REFERENCES payables(id),
  
  -- Escenario
  scenario_name TEXT,              -- "Current Plan", "Pay 50% Extra", "Defer 30 days"
  is_current_plan BOOLEAN DEFAULT false,
  
  -- Proyección semana a semana
  projection_data JSONB,           -- Array de {date, balance, interest_accrued, payment_due, ...}
  
  -- Resumen
  total_interest_cost DECIMAL(15,2),
  payoff_date DATE,
  months_to_payoff INT,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### 7. TABLA: `cash_flow_transactions` (Movimientos individuales)

```sql
CREATE TABLE cash_flow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES cash_flow_periods(id),
  
  -- Origen
  source_type TEXT,  -- 'cobracheck', 'gastoche ck', 'bancocheck', 'manual', 'interest_accrued'
  source_id UUID,    -- ID en la tabla origen
  
  -- Dinero
  amount DECIMAL(15,2),
  direction TEXT,    -- 'inflow' o 'outflow'
  
  -- Descripción
  description TEXT,
  category TEXT,
  
  -- Tracking
  is_projected BOOLEAN,  -- True = proyectado, False = real
  actual_date DATE,
  transaction_date DATE DEFAULT now(),
  
  created_at TIMESTAMP DEFAULT now()
);
```

### 8. TABLA: `bank_accounts_multi` (Multi-cuenta management)

```sql
CREATE TABLE bank_accounts_multi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  -- Identificación
  account_name TEXT NOT NULL,              -- "Operativa", "Reserva", "Nómina", "Inversión"
  account_type TEXT,                       -- 'operational', 'reserve', 'payroll', 'investment'
  bank_name TEXT NOT NULL,
  account_number TEXT,
  
  -- Saldo
  current_balance DECIMAL(15,2),
  last_sync TIMESTAMP,
  
  -- Designaciones
  purposes TEXT[],                         -- Array: ['payroll', 'operations', 'emergency']
  minimum_balance_threshold DECIMAL(15,2), -- No tocar por debajo de X
  
  -- Prioridad transferencia
  priority_for_transfers INT,              -- 1 = primera opción, 3 = última
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_company_account ON bank_accounts_multi(company_id, account_type);
```

### 9. TABLA: `multi_account_recommendations` (Transferencias recomendadas)

```sql
CREATE TABLE multi_account_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES cash_flow_periods(id),
  
  -- Movimiento
  from_account_id UUID NOT NULL REFERENCES bank_accounts_multi(id),
  to_account_id UUID NOT NULL REFERENCES bank_accounts_multi(id),
  
  -- Monto
  recommended_amount DECIMAL(15,2),
  reason TEXT,  -- "Cubrir déficit", "Preparar nómina", "Mantener buffer"
  
  -- Prioridad
  priority INT,  -- 1 = hacer ahora, 2 = próximas 24h, 3 = dentro de 48h
  urgency TEXT,  -- 'critical', 'high', 'medium', 'low'
  
  -- Impacto
  impact_on_from_balance DECIMAL(15,2),  -- Nuevo saldo cuenta origen
  impact_on_to_balance DECIMAL(15,2),    -- Nuevo saldo cuenta destino
  
  -- Status
  is_executed BOOLEAN DEFAULT false,
  executed_at TIMESTAMP,
  execution_status TEXT,  -- 'pending', 'in_transit', 'completed', 'failed'
  
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_period_priority ON multi_account_recommendations(period_id, priority);
```

### 10. TABLA: `payment_collection_confidence` (IA Cobros por Cliente - Color Score)

```sql
CREATE TABLE payment_collection_confidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  customer_id UUID,                        -- Cliente CobraCheck
  
  -- Identificación
  customer_name TEXT NOT NULL,
  receivable_id UUID,                      -- Link a receivables tabla
  
  -- Monto esperado
  expected_amount DECIMAL(15,2),
  expected_date DATE,
  
  -- Histórico
  total_payments_history INT DEFAULT 0,    -- Total pagos que ha hecho
  on_time_payments INT DEFAULT 0,          -- Pagos puntuales
  late_payments INT DEFAULT 0,             -- Pagos retrasados
  very_late_payments INT DEFAULT 0,        -- Pagos > 7 días retrasados
  missed_payments INT DEFAULT 0,           -- Pagos nunca llegaron
  
  -- Estadísticas
  punctuality_rate DECIMAL(5,2),           -- % pagos a tiempo (0-100)
  average_days_late DECIMAL(5,1),          -- Promedio días de retraso
  max_days_late INT,                       -- Máximo retraso registrado
  
  -- IA CONFIDENCE SCORE (0-100)
  confidence_score INT,                    -- 0-100
  confidence_color TEXT,                   -- 'green', 'yellow', 'red'
  confidence_reason TEXT,                  -- Por qué esa confianza
  
  -- Análisis tendencia
  trend TEXT,                              -- 'improving', 'stable', 'worsening'
  trend_change_last_90_days DECIMAL(5,1),  -- % cambio últimos 90 días
  
  -- Alertas
  is_at_risk BOOLEAN DEFAULT false,        -- IA detecta potencial problema
  risk_level TEXT,                         -- 'low', 'medium', 'high', 'critical'
  recommended_action TEXT,                 -- "Confiar", "Llamar para confirmar", "NO confiar"
  
  -- Recomendación
  should_prepay_or_reduce BOOLEAN DEFAULT false,
  
  last_calculated TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_customer_confidence ON payment_collection_confidence(company_id, confidence_score DESC);
CREATE INDEX idx_risk_level ON payment_collection_confidence(company_id, risk_level);
```

---

## 🎨 UI: DASHBOARD SEMANAL DE FLUJO

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                  🌊 FLUJOCHECK — SEMANA 29 (2026-07-14 a 2026-07-20)          ║
╚═══════════════════════════════════════════════════════════════════════════════╝

SECCIÓN 1: RESUMEN SEMANAL
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Saldo Inicial (Lunes)          Ingresos (Proyectado)    Gastos (Proyectado) │
│  ┌──────────────────┐           ┌──────────────────┐     ┌──────────────────┐
│  │  $450,000 MXN    │           │  $280,000 MXN    │     │  $320,000 MXN    │
│  │  (De BancoCheck) │           │  (De CobraCheck) │     │  (De GastoCheck) │
│  └──────────────────┘           └──────────────────┘     └──────────────────┘
│                              ↓
│  ┌──────────────────┐           ┌──────────────────┐     ┌──────────────────┐
│  │ Saldo Proyectado │      Diferencia             │     Capacidad Pago     │
│  │  $410,000 MXN    │      -$40,000 (Déficit!)    │     $220,000 (¿Pagable?)
│  │  (Domingo)       │                             │                        │
│  └──────────────────┘           └──────────────────┘     └──────────────────┘
│                                                                             │
│  ⚠️  ALERTA: Proyección muestra déficit. Necesitas conseguir $40K o reducir pagos.
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

SECCIÓN 2: CUENTAS POR PAGAR (3 COLUMNAS — SALDO ANTES/DESPUÉS EN COLUMNA 1)

┌──────────────────────────────────────────┬──────────────────┬──────────────────┐
│  ADEUDOS TOTALES + SALDO                 │  PAGOS A HACER   │  PAGOS           │
│  (ANTES Y DESPUÉS DEL PAGO)              │  ESTA SEMANA     │  SELECCIONADOS   │
├──────────────────────────────────────────┼──────────────────┼──────────────────┤
│                                          │                  │                  │
│ Proveedor ABC                            │ Min: $50,000     │                  │
│ Total adeudado $200,000                  │ Sugerido: $75K   │  ✓ $75,000       │
│ Vence: 2026-07-21                        │                  │                  │
│ [VER DETALLE]                            │                  │  STATUS: PAGABLE │
│                                          │                  │                  │
│ ┌─ SALDO ANTES PAGO ──────────────────┐ │                  │                  │
│ │ $200,000 MXN                        │ │                  │                  │
│ └─────────────────────────────────────┘ │                  │  Vida crédito: ↑ │
│ ┌─ SALDO DESPUÉS PAGO ────────────────┐ │                  │  (2 meses menos) │
│ │ $125,000 MXN (-$75K)                │ │                  │                  │
│ └─────────────────────────────────────┘ │                  │                  │
│                                          │                  │                  │
├──────────────────────────────────────────┼──────────────────┼──────────────────┤
│                                          │                  │                  │
│ BBVA - Crédito                           │ Min: $12,000     │  ✓ $15,000       │
│ Total adeudado $180,000                  │ Sugerido: $12K   │                  │
│ Vence: 2026-07-30                        │ (Interés: $450)  │  STATUS: OK      │
│ Interés: 18% anual                       │                  │                  │
│ [VER PROYECCIÓN]                         │ Extra: $3,000    │ ⚠️  Pagaste $3K  │
│                                          │ para ahorrar      │ extra            │
│ ┌─ SALDO ANTES PAGO ──────────────────┐ │ interés          │                  │
│ │ $180,000 MXN                        │ │                  │ Interés anual:   │
│ └─────────────────────────────────────┘ │                  │ (ahorra $200)    │
│ ┌─ SALDO DESPUÉS PAGO ────────────────┐ │                  │                  │
│ │ $165,000 MXN (-$15K)                │ │                  │ Payoff: 2026-11  │
│ └─────────────────────────────────────┘ │                  │ (2 meses antes)  │
│                                          │                  │                  │
├──────────────────────────────────────────┼──────────────────┼──────────────────┤
│                                          │                  │                  │
│ Impuestos (SAT)                          │ Min: $30,000     │  ✗ NO            │
│ Total adeudado $95,000                   │ Sugerido: $30K   │                  │
│ Vence: 2026-07-15 VENCIDA!!! 🔴         │ CRÍTICO: Vence   │ RAZÓN: Déficit   │
│ [PAGAR AHORA!]                           │ en 3 días        │ de $40K          │
│                                          │ PRIORITARIO      │                  │
│ ┌─ SALDO ANTES PAGO ──────────────────┐ │                  │ ACCIÓN: Buscar   │
│ │ $95,000 MXN                         │ │                  │ línea crédito    │
│ └─────────────────────────────────────┘ │                  │ antes jul 15     │
│ ┌─ SALDO DESPUÉS PAGO ────────────────┐ │                  │                  │
│ │ $95,000 MXN (sin cambios)           │ │                  │                  │
│ └─────────────────────────────────────┘ │                  │                  │
│                                          │                  │                  │
├──────────────────────────────────────────┼──────────────────┼──────────────────┤
│                                          │                  │                  │
│ Servicios                                │ Min: $18,000     │  ✓ $18,000       │
│ Total adeudado $72,000                   │ Sugerido: $18K   │                  │
│ Vence: 2026-07-25                        │                  │  STATUS: OK      │
│                                          │                  │                  │
│ ┌─ SALDO ANTES PAGO ──────────────────┐ │                  │                  │
│ │ $72,000 MXN                         │ │                  │                  │
│ └─────────────────────────────────────┘ │                  │                  │
│ ┌─ SALDO DESPUÉS PAGO ────────────────┐ │                  │                  │
│ │ $54,000 MXN (-$18K)                 │ │                  │                  │
│ └─────────────────────────────────────┘ │                  │                  │
│                                          │                  │                  │
├──────────────────────────────────────────┼──────────────────┼──────────────────┤
│                                          │                  │                  │
│ 📊 TOTALES                               │ 📊 TOTALES       │ 📊 TOTALES       │
│ (12 cuentas más)                         │                  │                  │
│                                          │                  │                  │
│ ┌─ SALDO TOTAL ANTES PAGO ────────────┐ │ $110,000         │ $108,000         │
│ │ $622,000 MXN                        │ │ (Recomendado)    │ (Tu plan)        │
│ └─────────────────────────────────────┘ │                  │                  │
│ ┌─ SALDO TOTAL DESPUÉS PAGO ─────────┐ │ Vencidas: $95K   │ Diferencia: $2K  │
│ │ $574,000 MXN                        │ │ 🔴               │ (bajo plan) ✅   │
│ │                                     │ │                  │                  │
│ │ Diferencia: -$48K (tu plan) ✅      │ │ Críticas: $30K   │ RESULTADO:       │
│ │ Sobra/Falta: -$40K = DÉFICIT ⚠️    │ │ (prioritarias)   │ Déficit $40K     │
│ │                                     │ │                  │                  │
│ │ 🎯 Ver soluciones abajo (Multi-    │ │ Próximas 7d:     │ NECESITAS:       │
│ │    Cuenta Transfer + AI Cobros)    │ │ $50K prioritarias │ -Financiar $40K  │
│ │                                     │ │                  │ -Acelerar cobros │
│ └─────────────────────────────────────┘ │                  │ -Diferir algunos │
│                                          │                  │                  │
└──────────────────────────────────────────┴──────────────────┴──────────────────┘

SECCIÓN 3: ACCIONES RECOMENDADAS

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🚨 ALERTAS:                                                                 │
│  1. SAT VENCIDA (3 días). Pagar hoy para evitar multas + intereses         │
│  2. Déficit de $40K. Opciones:                                             │
│     a) NO pagar Servicios esta semana (ahorra $18K)                         │
│     b) Solicitar anticipo CobraCheck sobre cobros pendientes                │
│     c) Usar línea de crédito BBVA (disponible $50K)                        │
│                                                                             │
│ 💡 SUGERENCIAS:                                                             │
│  1. Pagar $3K extra BBVA → Ahorras $200 intereses + 2 meses de plazo      │
│  2. Negociar 15 días más con Proveedor ABC → Reducir presión esta semana  │
│  3. Acelerar cobranzas CobraCheck → Recibir $50K extras próximos 3 días   │
│                                                                             │
│ 🎯 PLAN RECOMENDADO:                                                        │
│  ├─ SAT: $30,000 (AHORA - crítico)                                         │
│  ├─ BBVA: $15,000 (+$3K extra para ahorrar intereses)                      │
│  ├─ Proveedor ABC: Diferir a próxima semana (negociar)                     │
│  └─ Resto: Mantener                                                        │
│  RESULTADO: Saldo final = $410K (sin déficit) ✅                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

SECCIÓN 4: PROYECCIÓN CRÉDITOS (próximas 12 semanas)

Crédito: BBVA $180,000 @ 18% anual (Plan actual: $12K/mes)

┌──────────────────────────────────────────────────────────────────────────┐
│ Semana │ Saldo Inicial │ Pago  │ Interés │ Saldo Final │ % Pagado │      │
├──────────────────────────────────────────────────────────────────────────┤
│  29    │   $180,000    │ $15K  │   $657  │   $165,657  │   8.3%   │ ✅   │
│  30    │   $165,657    │ $12K  │   $605  │   $154,262  │  14.2%   │      │
│  31    │   $154,262    │ $12K  │   $563  │   $142,825  │  20.6%   │      │
│  ...   │     ...       │ ...   │  ...    │     ...     │  ...     │      │
│  41    │    $25,000    │ $12K  │   $91   │   $13,091   │  92.7%   │      │
│  42    │    $13,091    │ $13K  │   $48   │      $139   │  99.9%   │ ✅   │
│                                                                          │
│ Payoff: 2026-11-15  (20 semanas / ~5 meses)                             │
│ Total intereses: $4,287                                                 │
│                                                                          │
│ Si pagas $15K/semana (en lugar de $12K):                                │
│ └─> Payoff: 2026-10-25 (16 semanas, 3 semanas ANTES)                    │
│     Total intereses: $3,456 (ahorras $831)                              │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

SECCIÓN 5: MULTI-CUENTA MANAGEMENT (Movimientos entre cuentas)

┌──────────────────────────────────────────────────────────────────────────────┐
│  💰 RECOMENDACIONES DE MOVIMIENTOS ENTRE CUENTAS                             │
│                                                                              │
│  Si tienes múltiples cuentas (BancoCheck vinculado):                        │
│                                                                              │
│  SITUACIÓN ACTUAL:                                                           │
│  ├─ Cuenta Operativa (BBVA):     $450,000 MXN                              │
│  ├─ Cuenta Reserva (Santander):  $120,000 MXN                              │
│  ├─ Cuenta Nómina (Banorte):      $85,000 MXN                              │
│  └─ Cuenta Inversión (CAJA):      $200,000 MXN                              │
│     TOTAL DISPONIBLE: $855,000 MXN                                          │
│                                                                              │
│  ANÁLISIS:                                                                   │
│  ├─ Pagos esta semana necesarios: $108,000 MXN (tu plan)                   │
│  ├─ Déficit proyectado: -$40,000 MXN                                       │
│  ├─ Dinero disponible sin riesgos: $620,000 MXN                            │
│  └─ Buffer de seguridad recomendado: 15% = $93,000 MXN                    │
│                                                                              │
│  🎯 MOVIMIENTOS RECOMENDADOS:                                                │
│                                                                              │
│  1️⃣  Transfiere $40,000 de Cuenta Inversión → Cuenta Operativa            │
│     RAZÓN: Cubrir déficit, mantener liquidez operativa                      │
│     RESULTADO: Operativa = $490K ✅                                         │
│                 Inversión = $160K (aún conserva 80% original)              │
│                                                                              │
│  2️⃣  MANTENER: Cuenta Reserva ($120K) → Buffer emergencias                │
│     RAZÓN: No tocarla (emergencias, oportunidades)                          │
│                                                                              │
│  3️⃣  VERIFICAR: Cuenta Nómina ($85K) vs próxima nómina semana             │
│     SI: Nómina próxima semana = $120K                                      │
│     ENTONCES: Transfiere $35K de Reserva → Nómina (antes de depositar)    │
│     RESULTADO: Lista para nómina sin apretar operativa                      │
│                                                                              │
│  ⚠️  DESPUÉS DE MOVIMIENTOS (Estado Proyectado):                             │
│  ├─ Cuenta Operativa:    $490,000 (suficiente para pagos)                  │
│  ├─ Cuenta Reserva:       $85,000 (buffer emergencias)                     │
│  ├─ Cuenta Nómina:       $120,000 (cubierto nómina)                        │
│  └─ Cuenta Inversión:    $160,000 (conservado plazo)                       │
│     TOTAL: $855,000 (sin cambios, solo redistribuido) ✅                   │
│                                                                              │
│  💡 BENEFICIOS:                                                              │
│  ✅ Resuelves déficit sin buscar financiamiento                             │
│  ✅ Mantienes buffer emergencias ($85K)                                     │
│  ✅ Cubres nómina sin presión                                               │
│  ✅ Inversión sigue creciendo ($160K)                                       │
│                                                                              │
│  ⚡ TIMING: Ejecuta hoy si movimientos son entre bancos mismo grupo         │
│     Si son bancos diferentes: Autoriza transferencia (normalmente 24-48h)  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

SECCIÓN 6: PROYECCIÓN DE COBROS (Color AI: Verde/Amarillo/Rojo)

┌──────────────────────────────────────────────────────────────────────────────┐
│  📊 COBROS PROYECTADOS ESTA SEMANA (IA detecta probabilidad por cliente)    │
│                                                                              │
│  Saldo: Hoy $410K + Cobros = Saldo final (proyectado)                      │
│                                                                              │
│  CLIENTE A — Empresa XYZ          MONTO: $80,000                            │
│  Status: 🟢 VERDE (Pagado)                                                  │
│  ├─ Recibido: ✅ $80,000 (Confirmado 2026-07-04 10:30am)                  │
│  ├─ Historial: Siempre a tiempo (24 últimos pagos = 100% puntual)         │
│  └─ Confiabilidad IA: 100% (cliente de primer tier)                        │
│                                                                              │
│  CLIENTE B — Empresa ABC          MONTO: $120,000                          │
│  Status: 🟡 AMARILLO (Esperado)                                             │
│  ├─ Esperado: ⏳ $120,000 (Vence hoy 2026-07-05)                           │
│  ├─ Historial: Generalmente a tiempo (19/24 pagos puntual, 5 retrasados)   │
│  ├─ Promedio demora: +2-3 días                                              │
│  └─ Confiabilidad IA: 79% (Cliente normal)                                 │
│     RECOMENDACIÓN: Confiar en el cobro, pero plan B si no llega hoy       │
│                                                                              │
│  CLIENTE C — Comercio DEF         MONTO: $60,000                           │
│  Status: 🔴 ROJO (Riesgoso)                                                 │
│  ├─ Esperado: ⏳ $60,000 (Vence hoy 2026-07-05)                            │
│  ├─ Historial: MUY INCONSISTENTE (12/24 pagos puntual, 12 > 7 días)        │
│  ├─ Demoras promedio: +12-18 días (a veces llega, a veces no)             │
│  ├─ Última vez: Atrasado 25 días (apenas cobró 2026-06-29)                │
│  └─ Confiabilidad IA: 35% (Cliente de riesgo)                              │
│     ⚠️  ADVERTENCIA: NO confíes en este cobro para pagos críticos          │
│     ACCIÓN: Llamar hoy, confirmar, si no → Plan B de pagos                │
│                                                                              │
│  CLIENTE D — Distribuidor GHI    MONTO: $40,000                            │
│  Status: 🟢 VERDE (Ya cobrado)                                              │
│  ├─ Recibido: ✅ $40,000 (Confirmado 2026-07-03 2:15pm)                   │
│  ├─ Historial: 100% puntual (24/24 pagos dentro de 48h)                   │
│  └─ Confiabilidad IA: 100%                                                  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐
│  │ 📊 RESUMEN COBROS ESTA SEMANA:                                          │
│  │                                                                         │
│  │ 🟢 VERDE (Confirmados/Seguros):    $120,000  (27%)                    │
│  │    └─ Cliente A ($80K) + Cliente D ($40K)                             │
│  │    ✅ Contar con este dinero para pagos críticos                      │
│  │                                                                         │
│  │ 🟡 AMARILLO (Esperados/Probables): $120,000  (27%)                    │
│  │    └─ Cliente B ($120K)                                               │
│  │    ⏳ Confiar, pero tener plan B si se atrasa                         │
│  │                                                                         │
│  │ 🔴 ROJO (Riesgosos/Inconstantes):  $60,000   (14%)                    │
│  │    └─ Cliente C ($60K)                                                │
│  │    ⚠️  NO confíes, busca plan B o confirma hoy                        │
│  │                                                                         │
│  │ ⏸️  PENDIENTE ACCIÓN:               $160,000  (32%)                    │
│  │    └─ Clientes E-H (aún sin acción o entrada manual)                  │
│  │                                                                         │
│  │ ╔════════════════════════════════════════════════════════════════╗     │
│  │ ║ PROYECCIÓN FLUJO SEMANAL (CON COBROS):                         ║     │
│  │ ║                                                                ║     │
│  │ ║ Saldo Lunes:              $410,000                           ║     │
│  │ ║ + Cobros VERDE (seguros): +$120,000                          ║     │
│  │ ║ + Cobros AMARILLO (prob): +$120,000  (si llegan)            ║     │
│  │ ║ - Pagos tu plan:          -$108,000                          ║     │
│  │ ║ ═════════════════════════════════════════════════════════════ ║     │
│  │ ║ ESCENARIO A (Solo VERDE):            $422,000 ✅ Safe       ║     │
│  │ ║ ESCENARIO B (VERDE + AMARILLO):      $542,000 ✅ Muy safe   ║     │
│  │ ║ ESCENARIO C (Si AMARILLO falla):     $302,000 ⚠️  Tight     ║     │
│  │ ║ ESCENARIO D (Si ROJO llega bonus):   $362,000 ✅ OK         ║     │
│  │ ╚════════════════════════════════════════════════════════════════╝     │
│  │                                                                         │
│  │ 🎯 ACCIÓN RECOMENDADA:                                                 │
│  │ ├─ Confiar en VERDE ($120K) + AMARILLO ($120K) = $240K cobros        │
│  │ ├─ Ejecutar pagos plan ($108K) → Saldo $302K MÍNIMO ✅               │
│  │ ├─ LLAMAR a Cliente C (ROJO) → Confirmar si envía $60K hoy           │
│  │ │  Si NO → Diferir algún pago no crítico                             │
│  │ │  Si SÍ → Excelente, saldo final $362K                              │
│  │ └─ NO esperar cobros PENDIENTE (plan conservador)                     │
│  │                                                                         │
│  └─────────────────────────────────────────────────────────────────────────┘
│                                                                              │
│  📈 IA INSIGHTS (Histórico + Patrones):                                     │
│  ├─ Cliente C problema: "Últimos 6 meses = pagos 0/6 a tiempo"            │
│  ├─ Tendencia: Empeorando (demora promedio 8→18 días)                     │
│  ├─ Riesgo: Potencial insolvencia en 3 meses                              │
│  └─ RECOMENDACIÓN LONG-TERM: Reducir exposición o cobrar adelantado       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

SECCIÓN 7: CONTROLES ADICIONALES

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│ [Histórico de Flujos] [Proyecciones Futuras] [Escenarios] [Reportes]       │
│ [Integración Bancos] [Sync CobraCheck] [Sync GastoCheck] [Settings]         │
│ [Multi-Cuenta Transfers] [Cobros por Cliente (Color AI)] [Credit Health]   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🧮 LÓGICA: Cálculos Clave

### 0. IA CONFIDENCE SCORE (Cobros - Color: Verde/Amarillo/Rojo)

```typescript
function calculatePaymentConfidenceScore(
  customer: Customer,
  paymentHistory: PaymentRecord[]
): ConfidenceScore {
  
  // 1. CALCULAR ESTADÍSTICAS HISTÓRICAS
  const stats = {
    totalPayments: paymentHistory.length,
    onTimePayments: paymentHistory.filter(p => p.daysLate <= 0).length,
    latePayments: paymentHistory.filter(p => p.daysLate > 0).length,
    veryLatePayments: paymentHistory.filter(p => p.daysLate > 7).length,
    missedPayments: paymentHistory.filter(p => !p.received).length,
    
    punctualityRate: (onTime / totalPayments) * 100,
    averageDaysLate: calculateAverage(latePayments.map(p => p.daysLate)),
    maxDaysLate: Math.max(...paymentHistory.map(p => p.daysLate))
  }
  
  // 2. CALCULAR COMPONENTES SCORE (0-100)
  
  // A. PUNTUALIDAD (40 puntos)
  let punctualityScore = 0
  if (stats.punctualityRate >= 95) punctualityScore = 40
  else if (stats.punctualityRate >= 85) punctualityScore = 35
  else if (stats.punctualityRate >= 70) punctualityScore = 25
  else if (stats.punctualityRate >= 50) punctualityScore = 15
  else punctualityScore = 0
  
  // B. RETRASOS PROMEDIO (30 puntos)
  let lateDelay Score = 0
  if (stats.averageDaysLate <= 1) lateDelayScore = 30
  else if (stats.averageDaysLate <= 3) lateDelayScore = 25
  else if (stats.averageDaysLate <= 7) lateDelayScore = 15
  else if (stats.averageDaysLate <= 15) lateDelayScore = 5
  else lateDelayScore = 0
  
  // C. MÁXIMO RETRASO (20 puntos) - penalidad por sorpresas
  let maxDelayScore = 0
  if (stats.maxDaysLate <= 2) maxDelayScore = 20
  else if (stats.maxDaysLate <= 7) maxDelayScore = 15
  else if (stats.maxDaysLate <= 30) maxDelayScore = 8
  else if (stats.maxDaysLate <= 60) maxDelayScore = 2
  else maxDelayScore = 0
  
  // D. PAGOS COMPLETADOS (10 puntos)
  let completionScore = 0
  if (stats.missedPayments === 0) completionScore = 10
  else if (stats.missedPayments === 1) completionScore = 5
  else completionScore = 0
  
  // 3. TENDENCIA (Últimos 90 días vs anteriores)
  const last90DaysPayments = paymentHistory.filter(p => 
    daysDifference(p.date, new Date()) <= 90
  )
  const previousPunctualityRate = (
    last90DaysPayments.filter(p => p.daysLate <= 0).length / 
    Math.max(1, last90DaysPayments.length)
  ) * 100
  const previousRate = (stats.onTimePayments - last90DaysPayments.length) / 
    Math.max(1, stats.totalPayments - last90DaysPayments.length) * 100
  
  const trend = previousPunctualityRate >= previousRate ? 'improving' : 'worsening'
  const trendChange = previousPunctualityRate - previousRate
  
  // 4. AJUSTAR POR TENDENCIA
  let trendAdjustment = 0
  if (trend === 'improving' && trendChange > 10) trendAdjustment = +5
  else if (trend === 'worsening' && trendChange < -10) trendAdjustment = -10
  
  // 5. TOTAL SCORE
  const totalScore = Math.max(0, Math.min(100, 
    punctualityScore + lateDelayScore + maxDelayScore + completionScore + trendAdjustment
  ))
  
  // 6. ASIGNAR COLOR Y CONFIANZA
  let color: 'green' | 'yellow' | 'red'
  let recommendation: string
  
  if (totalScore >= 80) {
    color = 'green'
    recommendation = 'Confiar — Cliente confiable, historial limpio'
  } else if (totalScore >= 50) {
    color = 'yellow'
    recommendation = 'Confiar con cautela — Retrasos ocasionales, probable pago'
  } else {
    color = 'red'
    recommendation = 'NO confiar — LLAMAR para confirmar, alto riesgo'
  }
  
  // 7. DETECTAR RIESGO INMINENTE
  let isAtRisk = false
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
  let shouldPrepay = false
  
  if (stats.missedPayments > 2) {
    isAtRisk = true
    riskLevel = 'critical'
    shouldPrepay = true
    recommendation += ' — REDUCE EXPOSICIÓN, cobro adelantado'
  } else if (trend === 'worsening' && trendChange < -15) {
    isAtRisk = true
    riskLevel = 'high'
    shouldPrepay = true
    recommendation += ' — Tendencia negativa, considera cobro adelantado'
  } else if (stats.veryLatePayments > 2) {
    isAtRisk = true
    riskLevel = 'high'
  } else if (stats.averageDaysLate > 7) {
    riskLevel = 'medium'
  }
  
  return {
    score: totalScore,
    color,
    punctuality: stats.punctualityRate,
    averageDaysLate: stats.averageDaysLate,
    maxDaysLate: stats.maxDaysLate,
    trend,
    trendChange,
    isAtRisk,
    riskLevel,
    shouldPrepayOrReduce: shouldPrepay,
    recommendation
  }
}
```

### 1. MULTI-ACCOUNT TRANSFER RECOMMENDATION (Movimientos entre cuentas)

```typescript
function recommendMultiAccountTransfers(
  accounts: BankAccountMulti[],
  paymentsPlan: Payment[],
  deficit: number
): TransferRecommendation[] {
  
  const recommendations: TransferRecommendation[] = []
  
  // Ordenar cuentas por prioridad de transferencia
  const sortedAccounts = accounts.sort((a, b) => 
    a.priority_for_transfers - b.priority_for_transfers
  )
  
  let remainingDeficit = deficit
  
  for (const account of sortedAccounts) {
    if (remainingDeficit <= 0) break
    
    // Verificar si cuenta tiene dinero disponible (respetando mínimo)
    const availableBalance = Math.max(0, 
      account.current_balance - (account.minimum_balance_threshold || 0)
    )
    
    if (availableBalance > 0) {
      const transferAmount = Math.min(availableBalance, remainingDeficit)
      
      recommendations.push({
        fromAccount: account.id,
        toAccount: findOperationalAccount(accounts).id,
        amount: transferAmount,
        reason: remainingDeficit > 0 
          ? "Cubrir déficit de flujo"
          : "Optimizar distribución de fondos",
        priority: remainingDeficit > transferAmount ? 1 : 2,
        urgency: remainingDeficit > 50000 ? 'critical' : 'high'
      })
      
      remainingDeficit -= transferAmount
    }
  }
  
  return recommendations
}
```

### 1. CAPACIDAD DE PAGO (¿Puedo pagar?)

```typescript
function calculatePaymentCapacity(
  currentBalance: number,
  projectedInflows: number,
  projectedOutflows: number,
  proposedPayments: Payment[]
): PaymentCapacityResult {
  
  // Flujo neto sin los pagos propuestos
  const netFlowWithoutPayments = 
    (currentBalance + projectedInflows) - projectedOutflows
  
  // Dinero disponible después de flujo operacional
  const availableAfterOperations = 
    netFlowWithoutPayments - (proyectedOutflows * 0.15) // Buffer 15%
  
  // Costo total de pagos propuestos
  const totalProposedPayments = proposedPayments
    .reduce((sum, p) => sum + p.amount, 0)
  
  // ¿Puedo pagar?
  const canAfford = availableAfterOperations >= totalProposedPayments
  
  // ¿Cuánto me sobra/falta?
  const surplus = availableAfterOperations - totalProposedPayments
  
  return {
    canAfford,
    surplus,
    capacity: availableAfterOperations,
    recommendation: surplus > 0 ? 'SAFE' : 'AT_RISK'
  }
}
```

### 2. PAGO EXTRA IMPACTO (¿Qué pasa si pago $X más?)

```typescript
function simulateExtraPayment(
  credit: Credit,
  extraPaymentAmount: number,
  paymentDate: Date
): CreditProjection {
  
  // Calcular nuevo plan de pagos
  const newSchedule = amortizeCredit(
    credit.remainingBalance,
    credit.interestRate,
    credit.paymentAmount + extraPaymentAmount, // Pago aumentado
    credit.startDate
  )
  
  return {
    scenario: "Pay Extra $" + extraPaymentAmount,
    newPayoffDate: newSchedule.payoffDate,
    monthsReduced: credit.originalPayoffMonths - newSchedule.months,
    interestSaved: credit.originalInterestCost - newSchedule.totalInterest,
    newPaymentSchedule: newSchedule.payments,
    impactSummary: `Pagas ${newSchedule.months} meses en lugar de ${credit.originalPayoffMonths}, ahorras $${interestSaved}`
  }
}
```

### 3. INTERÉS ACUMULADO (Créditos con interés)

```typescript
function calculateInterestAccrued(
  principal: number,
  monthlyRate: number,
  daysElapsed: number,
  interestType: 'simple' | 'compound'
): number {
  
  const monthsPassed = daysElapsed / 30
  
  if (interestType === 'simple') {
    // I = P × r × t
    return principal * monthlyRate * monthsPassed
  } else if (interestType === 'compound') {
    // A = P(1 + r)^t
    return principal * (Math.pow(1 + monthlyRate, monthsPassed) - 1)
  }
}
```

### 4. AMORTIZACIÓN (Plan de pagos de crédito)

```typescript
function amortizeCredit(
  principal: number,
  monthlyRate: number,
  monthlyPayment: number,
  startDate: Date
): AmortizationSchedule {
  
  const schedule = []
  let balance = principal
  let totalInterest = 0
  let paymentCount = 0
  let currentDate = startDate
  
  while (balance > 0 && paymentCount < 360) { // Max 30 años
    paymentCount++
    
    // Interés del mes
    const interestThisMonth = balance * monthlyRate
    
    // Principal reducido
    const principalThisMonth = monthlyPayment - interestThisMonth
    
    // Nuevo balance
    balance = Math.max(0, balance - principalThisMonth)
    totalInterest += interestThisMonth
    
    // Siguiente fecha
    currentDate = addMonths(currentDate, 1)
    
    schedule.push({
      paymentNumber: paymentCount,
      paymentDate: currentDate,
      paymentAmount: monthlyPayment,
      interestPortion: interestThisMonth,
      principalPortion: principalThisMonth,
      balanceAfter: balance
    })
  }
  
  return {
    payments: schedule,
    totalInterest,
    payoffDate: currentDate,
    months: paymentCount
  }
}
```

---

## 🤖 ALGORITMOS: Decisiones Inteligentes

### 1. PRIORIDAD PAGO (Qué pagar primero)

```typescript
function rankPayablesByPriority(
  payables: Payable[],
  availableCash: number
): RankedPayable[] {
  
  return payables.map(p => ({
    ...p,
    priorityScore: calculatePriorityScore(p)
  })).sort((a, b) => b.priorityScore - a.priorityScore)
}

function calculatePriorityScore(payable: Payable): number {
  let score = 0
  
  // 1. VENCIMIENTO (40 puntos)
  const daysUntilDue = daysDifference(new Date(), payable.dueDate)
  if (daysUntilDue < 0) score += 40      // VENCIDA
  else if (daysUntilDue <= 7) score += 35 // Vence esta semana
  else if (daysUntilDue <= 14) score += 25
  else if (daysUntilDue <= 30) score += 15
  
  // 2. IMPACTO LEGAL/REPUTACIONAL (30 puntos)
  if (payable.payeeType === 'government') score += 30  // SAT, IMSS
  else if (payable.payeeType === 'bank') score += 25   // Bancos
  else if (payable.payeeType === 'critical_vendor') score += 20
  
  // 3. COSTO DE NO PAGAR (20 puntos)
  if (payable.has_interest) {
    const dailyCost = (payable.remainingBalance * payable.interestRate) / 30
    if (dailyCost > 1000) score += 20
    else if (dailyCost > 500) score += 15
  }
  
  // 4. MONTO (10 puntos)
  if (payable.remainingBalance > 100000) score += 10
  
  return score
}
```

### 2. PLAN PAGO AUTOMÁTICO (Qué pagar con el dinero disponible)

```typescript
function generatePaymentPlan(
  payables: RankedPayable[],
  availableCash: number,
  targetStrategy: 'aggressive' | 'balanced' | 'conservative'
): PaymentPlan {
  
  const plan = new PaymentPlan()
  let remainingCash = availableCash
  
  for (const payable of payables) {
    if (remainingCash <= 0) break
    
    const paymentDecision = decidePayment(
      payable,
      remainingCash,
      targetStrategy
    )
    
    if (paymentDecision.shouldPay) {
      plan.addPayment(payable.id, paymentDecision.amount)
      remainingCash -= paymentDecision.amount
    }
  }
  
  return plan
}

function decidePayment(
  payable: Payable,
  availableCash: number,
  strategy: string
): PaymentDecision {
  
  const minPayment = payable.minimumPaymentDue
  const fullPayment = payable.remainingBalance
  
  switch(strategy) {
    case 'aggressive':
      // Pagar lo máximo posible
      return {
        shouldPay: true,
        amount: Math.min(fullPayment, availableCash)
      }
    
    case 'balanced':
      // Pagar mínimo + 20% extra si puedo
      const balanced = minPayment + (fullPayment * 0.2)
      return {
        shouldPay: availableCash >= minPayment,
        amount: Math.min(balanced, availableCash)
      }
    
    case 'conservative':
      // Solo pagos mínimos
      return {
        shouldPay: availableCash >= minPayment,
        amount: minPayment
      }
  }
}
```

---

## 📊 INTEGRACIONES

### ENTRADA: De otros módulos

```
GastoCheck → Egresos (gastos, anticipos, reembolsos)
  └─ cash_flow_transactions (outflow)
  
CobraCheck → Ingresos (cobros, depósitos)
  └─ cash_flow_transactions (inflow)
  
BancoCheck → Saldos reales, movimientos
  └─ Validar cash_flow_periods (actual vs proyectado)
  
FacturaCheck → Documentación de transacciones
  └─ Clasificación de payables (qué es deuda)
```

### SALIDA: Hacia otros módulos

```
BancoCheck ← Sugerencias pago
  └─ "Paga $15K BBVA esta semana" → BancoCheck marca como "planned"
  
CobraCheck ← Proyecciones ingresos
  └─ "Necesitamos $40K extra, acelera cobros"
  
GastoCheck ← Controles gasto
  └─ "Reduce gastos, estamos en déficit"
  
Reportes → Dashboard empresa
  └─ "Flujo semanal, proyecciones, salud financiera"
```

---

## 🎯 CASOS DE USO

### Caso 1: Pago Normal Semanal

```
USUARIO: CEO
ACCIÓN: Abre FlujoCheck el lunes

RESULTADO:
├─ Saldo inicial: $450K
├─ Ingresos proyectados: $280K (CobraCheck)
├─ Egresos proyectados: $320K (GastoCheck)
├─ Saldo final proyectado: $410K ✅
│
└─ RECOMENDACIÓN:
   ├─ SAT: $30K (vence hoy)
   ├─ BBVA: $12K (min) o $15K (ahorrar intereses)
   ├─ Proveedor: $75K
   ├─ Servicios: $18K
   │
   └─ TOTAL PLAN: $135K
   └─ SALDO DESPUÉS: $275K ✅
```

### Caso 2: Déficit (Qué hacer?)

```
USUARIO: CEO
ACCIÓN: Proyección muestra déficit -$40K

RESULTADO:
├─ ❌ NO PUEDO pagar todo lo planeado
├─ OPCIONES:
│  ├─ A) Diferir Proveedor ABC ($75K) → Negocia 15 días
│  ├─ B) Usar línea crédito BBVA (disponible $50K)
│  ├─ C) Acelerar cobros CobraCheck
│  └─ D) Mix: A + C
│
└─ RECOMENDACIÓN: A + C
   ├─ Diferir Proveedor (ahorra $75K)
   ├─ Acelerar cobros $50K (+3 días)
   └─ RESULTADO: $410K saldo ✅
```

### Caso 3: Pago Extra en Crédito

```
USUARIO: CFO
ACCIÓN: "¿Qué pasa si pago $3K extra al BBVA?"

RESULTADO:
├─ Pago extra: +$3,000
├─ Nueva vida del crédito: 16 semanas (vs 20)
├─ Interés ahorrado: $831
├─ Nuevo payoff: 2026-10-25 (vs 2026-11-15)
│
└─ IMPACTO SALDO:
   ├─ Plan actual: Saldo $275K
   ├─ Con pago extra: Saldo $272K (-$3K)
   └─ Decisión: RECOMENDADO (ahorras $831 a largo plazo)
```

### Caso 4: Gestión de Intereses

```
USUARIO: Contador
ACCIÓN: Monitoreo mensual de créditos

RESULTADO:
├─ Crédito BBVA: $180K @ 18% anual
│  ├─ Interés acumulado este mes: $2,700
│  ├─ Pagos registrados: $15,000
│  ├─ Principal reducido: $12,300
│  └─ Nuevo balance: $167,700 ✓
│
├─ Crédito Proveedor ABC: $200K @ 0% (30 días)
│  ├─ Vence: 2026-08-15
│  ├─ Días restantes: 15
│  └─ Acción: Preparar pago completo antes vencimiento
│
└─ RESUMEN:
   ├─ Total intereses acumulados: $2,700
   ├─ Proyección año completo: $32,400
   └─ Oportunidad: Pagar extra $3K/mes = ahorras $5K/año
```

---

## 📱 MOBILE VS WEB

### Mobile (CobraCheck context)
```
Vendedor en ruta ve:
├─ "Tu empresa tiene $410K disponible esta semana"
├─ "Recuerda: Pagos pendientes $135K"
└─ "Puedes comprometer dinero cobros hasta $280K"
```

### Web (GastoCheck/FacturaCheck context)
```
Admin ve:
├─ Dashboard flujo completo (4 columnas)
├─ Proyecciones créditos (12 semanas)
├─ Escenarios "qué pasa si"
└─ Alertas vencimientos
```

---

## 🚀 ROADMAP IMPLEMENTACIÓN

### Fase 1 (Semanas 1-2): MVP Core
```
✅ Schema DB (cash_flow_periods, payables, payment_schedule)
✅ Dashboard semanal básico (4 columnas)
✅ Cálculo capacidad pago
✅ Integración GastoCheck inflows/outflows
✅ Plan pago recomendado
```

### Fase 2 (Semanas 3-4): Credit Management
```
✅ Créditos con interés (simple + compound)
✅ Amortización automática
✅ Pago extra impacto
✅ Proyección 12 semanas
✅ Escenarios "qué pasa si"
```

### Fase 3 (Semanas 5-6): Advanced
```
✅ Algoritmo prioridad inteligente
✅ Plan pago automático (3 estrategias)
✅ Alertas multi-canal
✅ Analytics histórico
✅ Reportes para contador/CEO
```

---

## ✅ DOCUMENTO LISTO

**Para Daniel**: Arquitectura completa, cases de uso, lógica, UI mockups  
**Para Juan**: Decisiones en próxima sesión sobre prioridades + timeline

