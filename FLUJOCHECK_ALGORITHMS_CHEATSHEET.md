# 📐 FLUJOCHECK — ALGORITHMS CHEATSHEET

**Para tener a mano mientras codificas**  
**Imprimir o abrir en split-screen**

---

## 1️⃣ PAYMENT CAPACITY

**¿Cuánto PUEDO pagar esta semana?**

```
Entrada:
  cash_available = 150,000 MXN
  critical_buffer = 50,000 MXN (operaciones mínimas)
  obligations = [
    { amount: 80,000, priority: 'critical' },  ← Salario
    { amount: 30,000, priority: 'high' }       ← Proveedor
  ]

Cálculo:
  1. operational_cash = cash - buffer
     → 150,000 - 50,000 = 100,000
  
  2. critical_sum = SUM(priority == 'critical')
     → 80,000
  
  3. capacity = operational_cash - critical_sum
     → 100,000 - 80,000 = 20,000 MXN

Salida: 20,000 MXN (cuánto más puedo pagar en pagos no-críticos)
```

**Código**:
```typescript
function calculatePaymentCapacity(
  cashAvailable: number,
  criticalBuffer: number,
  obligations: Array<{ amount: number; priority: string }>
): number {
  const operational = cashAvailable - criticalBuffer;
  const critical = obligations
    .filter(o => o.priority === 'critical')
    .reduce((sum, o) => sum + o.amount, 0);
  return Math.max(0, operational - critical);
}
```

---

## 2️⃣ FIXED AMORTIZATION

**Cuota igual cada mes (60 meses)**

```
Entrada:
  principal = 100,000 MXN
  annual_rate = 12% (1% mensual)
  months = 60

Fórmula PMT (Payment):
  r = 0.12 / 12 = 0.01
  PMT = P × [r(1+r)^n] / [(1+r)^n - 1]
  
  Numerador = 0.01 × (1.01)^60 = 0.01 × 1.8167 = 0.018167
  Denominador = (1.01)^60 - 1 = 1.8167 - 1 = 0.8167
  
  PMT = 100,000 × 0.018167 / 0.8167
  PMT = 1,817 / 0.8167
  PMT ≈ 2,224 MXN (cuota fija)

Para cada mes (1..60):
  interest = remaining_balance × monthly_rate
  principal = PMT - interest
  remaining = remaining - principal
  
Mes 1:
  interest = 100,000 × 0.01 = 1,000
  principal = 2,224 - 1,000 = 1,224
  remaining = 100,000 - 1,224 = 98,776

Mes 60:
  interest = ~22
  principal = ~2,202
  remaining = 0 ✓
```

**Validar**: 
- `total_interest = sum(interest)` debe ser ~33k
- `sum(principal)` debe ser = 100k
- `remaining_balance` en último mes = ~0

---

## 3️⃣ GRADUATED AMORTIZATION

**Cuota aumenta cada año (5% anual)**

```
Entrada:
  principal = 100,000 MXN
  annual_rate = 12%
  term = 60 meses
  initial_payment = 1,500 MXN
  annual_increase = 5%

Para cada mes:
  if (mes == 12, 24, 36, 48, 60):
    payment = payment × 1.05  ← Aumentar 5%

Ejemplo:
  Mes 1-12: $1,500
  Mes 13-24: $1,575 ($1,500 × 1.05)
  Mes 25-36: $1,654 ($1,575 × 1.05)
  Mes 37-48: $1,737
  Mes 49-60: $1,824

Cada mes:
  interest = remaining × 0.01
  principal = payment - interest
  remaining = remaining - principal
```

**Caso real**: Crédito profesional joven, pagos bajos inicialmente.

---

## 4️⃣ BALLOON AMORTIZATION

**Cuota baja + pago final GRANDE**

```
Entrada:
  principal = 100,000 MXN
  term = 60 meses
  balloon_payment = 40,000 MXN (pago final mes 60)
  regular_payment = 1,500 MXN (meses 1-59)
  annual_rate = 12%

Para meses 1-59:
  interest = remaining × 0.01
  principal = regular_payment - interest
  remaining = remaining - principal

Mes 60 (¡ESPECIAL!):
  interest = remaining × 0.01
  principal = remaining + balloon_payment ← Pago final GRANDE
  remaining = 0

Ejemplo:
  Mes 59: remaining = 45,000
  Mes 60: principal = 45,000 + 40,000 = 85,000 ← ¡Balloon!
          pago_total = 85,000 + (45,000 × 0.01) = 85,450
```

**Caso real**: Auto arrendado, refinanciar al final o comprar usado.

---

## 5️⃣ INTEREST-ONLY AMORTIZATION

**Solo interés mensual, principal al final**

```
Entrada:
  principal = 100,000 MXN
  annual_rate = 12% (1% mensual)
  term = 60 meses

Para meses 1-59:
  interest = 100,000 × 0.01 = 1,000 MXN
  principal = 0
  remaining = 100,000 (sin cambios)

Mes 60:
  interest = 100,000 × 0.01 = 1,000
  principal = 100,000 (PAGO COMPLETO)
  remaining = 0

Total pagado:
  59 × 1,000 (interés) + 100,000 (principal) = 159,000
```

**Caso real**: Línea de crédito comercial, refinanciar al vencimiento.

---

## 6️⃣ ANNUAL PROJECTION (12 MESES)

**Predecir cash flow + health cada mes**

```
Para cada mes (próximos 12):
  
  1. INGRESOS DEL MES
     receivables_ese_mes = SUM(receivables.due_date en mes)
     
     Ajuste por escenario:
       pessimistic → receivables × 0.7
       realistic → receivables × 1.0
       optimistic → receivables × 1.3
  
  2. GASTOS DEL MES
     gastos = SUM(payables) + SUM(recurring) + SUM(credit_payments)
  
  3. NET CASH FLOW
     net = ingresos - gastos
  
  4. HEALTH SCORE (0-100)
     score = 50 (base)
     if (net > 0) score += 30
     if (debt_ratio < 40%) score += 20
     if (obligaciones_vencidas == 0) score += 20
     if (buffer > 50k) score += 20
     score = clamp(0, 100)
  
  5. HEALTH INDICATOR
     if (score >= 70) → 'healthy' (verde)
     if (score >= 40) → 'caution' (amarillo)
     else → 'critical' (rojo)
  
  6. CONFIDENCE (decrece con distancia)
     mes 1: 90%
     mes 6: 70%
     mes 12: 50% (muy lejano)

Ejemplo:
  Julio:
    ingresos = 500,000
    gastos = 350,000
    net = 150,000 (+30 pts) ✓
    score = 50 + 30 + 20 + 20 + 20 = 140 → clamp a 100
    → 'healthy'
  
  Octubre (pico de pagos):
    ingresos = 300,000
    gastos = 500,000 (impuestos + proveedores)
    net = -200,000 (-30 pts) ✗
    score = 50 - 30 = 20
    → 'critical'
```

---

## 7️⃣ HEALTH SCORE CALCULATION

**¿Qué tan "saludable" está el cash flow?**

```
Base: 50 puntos

+30 Net cash flow POSITIVO (income > expenses)
+20 Debt ratio < 40% (deuda total < 40% de ingresos)
+20 Sin obligaciones VENCIDAS (0 payables overdue)
+20 Buffer caja > 50,000 MXN (no vivir al límite)
+10 Proyección ESTABLE (varianza mes-a-mes baja)

Total máximo: 130 → clamp a 100

Categorías:
  70-100 → HEALTHY (verde) → No preocuparse
  40-69  → CAUTION (amarillo) → Monitorear
  0-39   → CRITICAL (rojo) → Acción inmediata

Ejemplo:
  Empresa A:
    net = +50,000 (+30)
    debt_ratio = 30% (+20)
    vencidas = 0 (+20)
    buffer = 100,000 (+20)
    stable = sí (+10)
    TOTAL: 100 → 'healthy' ✓

  Empresa B:
    net = -10,000 (-30)
    debt_ratio = 60% (0)
    vencidas = 2 payables (0)
    buffer = 10,000 (0)
    TOTAL: 20 → 'critical' ✗
```

---

## 8️⃣ PAYMENT CONFIDENCE (AI/ML)

**¿Qué probabilidad tengo de COBRAR este dinero?**

```
Base: 50 (neutral)

Factor 1: DEBTOR HISTORY (-20 a +20)
  on_time_rate = payments_on_time / total_payments
  score = (on_time_rate - 0.5) × 40
  
  Ej: 100% on time → 100%: (1.0 - 0.5) × 40 = +20
  Ej: 50% on time → 50%: (0.5 - 0.5) × 40 = 0
  Ej: 0% on time → 0%: (0 - 0.5) × 40 = -20

Factor 2: AMOUNT VS INDUSTRY (-15 a +15)
  industry_avg = 50,000 MXN
  ratio = amount / industry_avg
  score = (ratio - 0.5) × 30
  
  Ej: $100k / $50k = 2.0 → (2.0 - 0.5) × 30 = +45 → clamp +15
  Ej: $25k / $50k = 0.5 → (0.5 - 0.5) × 30 = 0

Factor 3: DAYS SINCE INVOICE (-20 a +15)
  if (days <= 7) → +15 (cobro fresco)
  if (days > 60) → -20 (probable mora)
  
Factor 4: MARKET CONDITIONS (-10 a +10)
  recession → -10
  normal → 0
  boom → +10

TOTAL: Base 50 + Factores

Categorías:
  75-100 → HIGH (verde) → Confianza alta
  50-74  → MEDIUM (amarillo) → Media
  25-49  → LOW (rojo) → Baja
  0-24   → UNKNOWN (gris) → Sin datos

Ejemplo:
  Debtor histórico BUENO, $100k (arriba promedio), invoice reciente
  50 + 20 (historia) + 10 (monto) + 15 (fresco) = 95 → HIGH ✓
```

---

## 9️⃣ EXCESS FUNDS STRATEGY

**¿Pago deuda O invierto el dinero excedente?**

```
Entrada:
  excess = 50,000 MXN
  credits = [
    { id: 'C1', interest_rate: 12%, remaining: 500k, months: 48 }
  ]
  savings_account = { rate: 4.5% APY }

Paso 1: HIGHEST INTEREST CREDIT
  C1 tiene 12% → mayor que 4.5% de savings
  
Paso 2: INTEREST SAVINGS (si pago HOY)
  savings = excess × (rate / 100) × (months_remaining / 12)
  savings = 50,000 × 0.12 × (48 / 12)
  savings = 50,000 × 0.12 × 4
  savings = 24,000 MXN en intereses ahorrados

Paso 3: INVESTMENT RETURNS (si invierto)
  returns = excess × rate
  returns = 50,000 × 0.045
  returns = 2,250 MXN anuales

Paso 4: COMPARAR
  savings (24,000) > returns (2,250) × 1.5 → ¡PAGAR DEUDA!
  
  Recomendación:
    strategy: 'PAY'
    reason: "Ahorrar $24,000 en intereses"
    action: { type: 'pay_credit', amount: 50000 }

Escenarios alternativos:
  
  A) Inversión mucho mejor:
     Si returns >> savings × 1.2 → strategy: 'INVEST'
  
  B) Similar:
     Si |savings - returns| pequeño → strategy: 'SPLIT'
     action: { pay: 25k, invest: 25k }
```

---

## 🔟 ACCOUNT TRANSFER RECOMMENDATIONS

**¿Transferir dinero entre mis cuentas?**

```
Entrada:
  accounts = [
    { id: 'A1', name: 'Operativa', balance: 150,000 },
    { id: 'A2', name: 'Pagos', balance: 10,000 },
    { id: 'A3', name: 'Ahorros', balance: 50,000 }
  ]
  upcoming_payments = [
    { due_date: '2026-07-09', amount: 80,000 },
    { due_date: '2026-07-15', amount: 30,000 }
  ]

Regla 1: BALANCE LOW ACCOUNT
  Si A2 (Pagos) < 20k:
    Transferir de A1 (Operativa) a A2
    amount = 50,000
    reason: "Equilibrar saldos"
    urgency: 'medium'

Regla 2: PREPOSITION FOR PAYMENTS
  total_due_7days = 80,000 (2026-07-09)
  A2_balance = 10,000
  shortfall = 80,000 - 10,000 = 70,000
  
  Si shortfall > 0:
    transfer = shortfall + 10,000 buffer = 80,000
    from: A1 (tiene 150,000 > 80,000)
    to: A2
    reason: "Fondear pagos de la semana"
    urgency: 'high'

Salida:
  recommendations = [
    { from: A1, to: A2, amount: 80,000, reason: '...', urgency: 'high' }
  ]
```

---

## 1️⃣1️⃣ QUICK REFERENCE TABLE

| Algoritmo | Input | Output | Use Case |
|-----------|-------|--------|----------|
| **PaymentCapacity** | cash, buffer, obligations | capacity MXN | "¿Cuánto puedo pagar?" |
| **FixedAmort** | principal, rate, months | schedule[] | Crédito banco estándar |
| **GraduatedAmort** | principal, rate, months, increase% | schedule[] | Crédito profesional |
| **BalloonAmort** | principal, rate, months, balloon$ | schedule[] | Auto lease |
| **InterestOnly** | principal, rate, months | schedule[] | Línea crédito comercial |
| **AnnualProjection** | payables[], receivables[], credits[] | months[] + health | Planificación 12 meses |
| **HealthScore** | net, debt_ratio, overdue_count, buffer | score 0-100 | Dashboard indicador |
| **PaymentConfidence** | receivable, history, market | confidence_% | Color coding cobro |
| **ExcessFunds** | excess$, credits[], savings_rate | strategy PAY/INVEST/SPLIT | Optimizar dinero |
| **AccountTransfer** | accounts[], upcoming_payments[] | transfer[] | Multi-cuenta |

---

## 🎯 TESTING GUIDE

### FixedAmortization Test
```typescript
expect(schedule.length).toBe(60);
expect(schedule[0].total_payment).toBeCloseTo(schedule[59].total_payment);
expect(schedule[59].remaining_balance).toBeCloseTo(0);
```

### AnnualProjection Test
```typescript
expect(projection.length).toBe(12);
expect(projection.every(m => m.health_score >= 0 && m.health_score <= 100)).toBe(true);
```

### PaymentCapacity Test
```typescript
capacity = calculatePaymentCapacity(150000, 50000, [{amount: 80000, priority: 'critical'}]);
expect(capacity).toBe(20000);
```

---

## 🚨 COMMON MISTAKES

❌ Olvidar que `remaining_balance` DEBE ser 0 al final  
✅ Validar `remaining_balance ≈ 0` en último pago

❌ Confundir `interest_rate: 12` (anual) con `monthly_rate: 0.01`  
✅ Siempre dividir por 12 para convertir a mensual

❌ Sumar `principal + interest` pero pagar `PMT` diferente  
✅ `principal = PMT - interest` (orden correcto)

❌ No validar que `sum(payments) ≈ principal + interest_total`  
✅ Hacer sanity check en cada test

❌ Asumir que balance > 0 siempre permite transferencia  
✅ Validar `available_balance` (no total_balance)

---

**Última actualización**: 2026-07-05  
**Para preguntas**: Ver `FLUJOCHECK_IMPLEMENTATION_GUIDE.md`

