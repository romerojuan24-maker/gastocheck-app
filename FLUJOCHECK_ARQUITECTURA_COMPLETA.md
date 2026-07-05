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

SECCIÓN 2: CUENTAS POR PAGAR (4 COLUMNAS)

┌─────────────────────┬──────────────────┬──────────────────┬─────────────────┐
│  ADEUDOS TOTALES    │  PAGOS A HACER   │  PAGOS           │  SALDO DESPUÉS  │
│  ESTA SEMANA        │  ESTA SEMANA     │  SELECCIONADOS   │  DE PAGO        │
├─────────────────────┼──────────────────┼──────────────────┼─────────────────┤
│                     │                  │                  │                 │
│ Proveedor ABC       │ Min: $50,000     │                  │ Antes: $200K    │
│ Total adeudado      │ Sugerido: $75K   │  ✓ $75,000       │ Después: $125K  │
│ $200,000            │                  │                  │                 │
│ Vence: 2026-07-21   │                  │  STATUS: PAGABLE │ Vida crédito: ↑ │
│ [VER DETALLE]       │                  │                  │ (2 meses menos) │
│                     │                  │                  │                 │
├─────────────────────┼──────────────────┼──────────────────┼─────────────────┤
│                     │                  │                  │                 │
│ BBVA - Crédito      │ Min: $12,000     │  ✓ $15,000       │ Antes: $180K    │
│ Total adeudado      │ Sugerido: $12K   │                  │ Después: $165K  │
│ $180,000            │ (Interés: $450)  │  STATUS: OK      │                 │
│ Vence: 2026-07-30   │                  │                  │ Interés anual:  │
│ Interés: 18% anual  │ Extra: $3,000    │ ⚠️  Pagaste $3K  │ (ahorra $200)   │
│ [VER PROYECCIÓN]    │ para ahorrar      │ extra            │                 │
│                     │ interés          │                  │ Payoff: 2026-11 │
│                     │                  │                  │ (2 meses antes) │
│                     │                  │                  │                 │
├─────────────────────┼──────────────────┼──────────────────┼─────────────────┤
│                     │                  │                  │                 │
│ Impuestos (SAT)     │ Min: $30,000     │  ✗ NO            │ Antes: $95K     │
│ Total adeudado      │ Sugerido: $30K   │                  │ Después: $95K   │
│ $95,000             │ CRÍTICO: Vence   │ RAZÓN: Déficit   │ (sin cambios)   │
│ Vence: 2026-07-15   │ en 3 días        │ de $40K          │                 │
│ VENCIDA!!! 🔴       │ PRIORITARIO      │                  │ ACCIÓN: Buscar  │
│ [PAGAR AHORA!]      │                  │ ACCIÓN: Financiar│ línea crédito   │
│                     │                  │ esta cuenta      │ antes jul 15    │
│                     │                  │                  │                 │
├─────────────────────┼──────────────────┼──────────────────┼─────────────────┤
│                     │                  │                  │                 │
│ Servicios           │ Min: $18,000     │  ✓ $18,000       │ Antes: $72K     │
│ Total adeudado      │ Sugerido: $18K   │                  │ Después: $54K   │
│ $72,000             │                  │  STATUS: OK      │                 │
│ Vence: 2026-07-25   │                  │                  │                 │
│                     │                  │                  │                 │
├─────────────────────┼──────────────────┼──────────────────┼─────────────────┤
│                     │                  │                  │                 │
│ 📊 TOTALES          │ 📊 TOTALES       │ 📊 TOTALES       │ 📊 TOTALES      │
│ $547,000            │ $110,000         │ $108,000         │ $622K → $574K   │
│ (12 cuentas más)    │ (Recomendado)    │ (Tu plan)        │ (-$48K = plan)  │
│                     │                  │                  │                 │
│ Vencidas: $95K 🔴   │ Críticas: $30K   │ Diferencia: $2K  │ Sobra/Falta:    │
│ Próximas 7d: $200K  │ Próximas 7d: $50K│ (bajo plan)     │ -$40K = DÉFICIT │
│                     │                  │                  │                 │
└─────────────────────┴──────────────────┴──────────────────┴─────────────────┘

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

SECCIÓN 5: CONTROLES ADICIONALES

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│ [Histórico de Flujos] [Proyecciones Futuras] [Escenarios] [Reportes]       │
│ [Integración Bancos] [Sync CobraCheck] [Sync GastoCheck] [Settings]         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🧮 LÓGICA: Cálculos Clave

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

