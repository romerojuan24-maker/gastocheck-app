# 🏗️ FLUJOCHECK — ARCHITECTURE DIAGRAM

**Visualización de flujo de datos, componentes, API y base de datos**

---

## 📊 HIGH LEVEL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MOBILE APP (React Native)                       │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  Flujo Tab   │  │ Créditos Tab │  │Proyección Tab│  │ Config Tab │ │
│  │              │  │              │  │              │  │            │ │
│  │ • Semanal    │  │ • CRUD créditos│ • 12 meses   │  │ • Banks    │ │
│  │ • Payables   │  │ • OCR scan   │  │ • Health     │  │ • Rules    │ │
│  │ • Receivables│  │ • Amortización│ │ • Chart     │  │            │ │
│  │ • Capacity   │  │              │  │              │  │            │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
│         ↑                  ↑                  ↑                  ↑      │
│         └──────────────────┼──────────────────┼──────────────────┘      │
│                            │                  │                        │
│              ┌─────────────────────────────────┐                        │
│              │  Context + Hooks (State Mgmt)   │                        │
│              │                                 │                        │
│              │ • useFlujoContext()             │                        │
│              │ • usePaymentCapacity()          │                        │
│              │ • useHealthScore()              │                        │
│              │ • useMultiAccount()             │                        │
│              └─────────────────────────────────┘                        │
│                            ↑                                            │
│              ┌─────────────────────────────────┐                        │
│              │    API Service Layer            │                        │
│              │                                 │                        │
│              │ • flujoService.ts               │                        │
│              │ • creditService.ts              │                        │
│              │ • projectionService.ts          │                        │
│              │ • recommendationService.ts      │                        │
│              └─────────────────────────────────┘                        │
│                            ↑                                            │
└────────────────────────────┼────────────────────────────────────────────┘
                             │ HTTPS + JWT
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ↓                    ↓                    ↓
   ┌─────────┐        ┌──────────┐        ┌──────────────────┐
   │ Next.js │        │ Supabase │        │ Edge Functions   │
   │  API    │        │  (PostgreSQL)     │ (Correlations)   │
   │         │        │                   │                  │
   │ /api/   │        │ • 14 tablas       │ • Heavy lifting  │
   │ flujo/* │        │ • RLS policies    │ • ML inference   │
   │         │        │ • Índices         │                  │
   └─────────┘        └──────────────────┘ └──────────────────┘
        │                     ↑                      │
        └─────────────────────┼──────────────────────┘
                              │
            ┌─────────────────────────────────┐
            │   External APIs (Optional)      │
            │                                 │
            │ • Banxico (TIIE, UDI)          │
            │ • Tax Authority (SAT)          │
            │ • Bank APIs (Balance sync)     │
            └─────────────────────────────────┘
```

---

## 🔄 DATA FLOW: GET DASHBOARD

**El flujo más común: usuario abre Flujo tab → ve dashboard**

```
User Opens FlujoCheck
        │
        ↓
FlujoDashboard Component
        │
        ├─ useWeeklyData() hook
        │        │
        │        ├─ Get current week_start from date
        │        │
        │        └─ Call API: GET /api/flujo/dashboard?period_id=X
        │                │
        │                ├─ Backend finds period
        │                │
        │                ├─ Query cash_flow_periods (1 row)
        │                │        │
        │                │        └─ Calculate:
        │                │           • cash_available
        │                │           • cash_committed
        │                │           • cash_buffer
        │                │           • health_score
        │                │
        │                ├─ Query payables WHERE week in [start, end]
        │                │        │
        │                │        └─ 5 rows (Prov A, Prov B, ...)
        │                │
        │                ├─ Query receivables WHERE week in [start, end]
        │                │        │
        │                │        └─ 3 rows (Cliente X, Cliente Y, ...)
        │                │
        │                ├─ Query credit_projection WHERE org_id
        │                │        │
        │                │        └─ 2 rows (Banco Z, Proveedor W)
        │                │
        │                ├─ Calculate recommendations:
        │                │   • recommendAccountTransfers()
        │                │   • recommendPayments()
        │                │
        │                ├─ Return full dashboard JSON
        │                │
        │                └─ RLS policy checks org_id
        │
        └─ Render widgets
                │
                ├─ DashboardWidget: cash_available
                ├─ DashboardWidget: cash_committed
                ├─ HealthIndicator: score + status
                ├─ Payables list (sortable by due_date)
                ├─ Receivables list (sortable by expected_date)
                ├─ Recommendations cards
                │
                └─ User can click:
                   • Edit payable → CreditosPanel
                   • View projection → ProyeccionAnual
                   • Transfer → Configuracion
```

**Timing**: ~500ms (100ms Supabase + 200ms calculations + 200ms rendering)

---

## 🔄 DATA FLOW: SCAN CREDIT

**Usuario escanea documento de crédito → OCR → Guardar**

```
User taps OCR button in CreditosPanel
        │
        ├─ Camera permission check
        │
        ├─ Take photo (base64 data URI)
        │
        └─ POST /api/flujo/credit-scan
                │
                ├─ Payload: { image_uri, document_type: 'loan_agreement' }
                │
                └─ Backend:
                    │
                    ├─ Decode base64 → JPG file
                    │
                    ├─ Call OCR (Google ML Kit or tesseract)
                    │   Extracts:
                    │   • "Crédito Banco X"
                    │   • "$100,000"
                    │   • "12% anual"
                    │   • "60 meses"
                    │   • "2026-07-01"
                    │
                    ├─ Parse extracted text:
                    │   credit_name = "Crédito Banco X"
                    │   original_amount = 100000
                    │   interest_rate = 12.0
                    │   term_months = 60
                    │   start_date = "2026-07-01"
                    │   end_date = "2031-06-30" (calculated)
                    │
                    ├─ INSERT credit_projection
                    │   { id, org_id, credit_name, original_amount, ... }
                    │
                    ├─ INSERT credit_amortization_rules
                    │   { credit_id, amortization_type: 'fixed', ... }
                    │
                    ├─ Calculate amortization_schedule:
                    │   for each month:
                    │     • interest = balance × monthly_rate
                    │     • principal = PMT - interest
                    │   store payment schedule in payment_schedule table
                    │
                    └─ Return:
                        {
                          credit_id: "uuid",
                          extracted_data: { ... },
                          confidence: 87,
                          warnings: ["Interés variable detectado"]
                        }
        │
        └─ App:
            ├─ Show confirmation modal
            ├─ User can edit/confirm
            └─ Refresh credits list (now shows new credit)
```

**Timing**: ~2000ms (camera + OCR ~1500ms + DB ~500ms)

---

## 📊 DATA FLOW: CALCULATE ANNUAL PROJECTION

**Generar 12 meses de proyección con health scores**

```
User opens ProyeccionAnual tab
        │
        ├─ useAnnualProjection() hook
        │        │
        │        └─ Call API: GET /api/flujo/projection/annual?scenario=realistic
        │                │
        │                └─ Backend:
        │                    │
        │                    ├─ Loop for month 0..11 (next 12 months)
        │                    │
        │                    ├─ For each month:
        │                    │     │
        │                    │     ├─ Query receivables
        │                    │     │   WHERE expected_date IN [month_start, month_end]
        │                    │     │   AND collection_status != 'collected'
        │                    │     │
        │                    │     ├─ Apply scenario adjustment:
        │                    │     │   realistic: × 1.0
        │                    │     │   pessimistic: × 0.7
        │                    │     │   optimistic: × 1.3
        │                    │     │   → projected_income
        │                    │     │
        │                    │     ├─ Query payables
        │                    │     │   WHERE due_date IN [month_start, month_end]
        │                    │     │
        │                    │     ├─ Query recurring_payments
        │                    │     │   WHERE active AND next_due in month
        │                    │     │
        │                    │     ├─ Query credit_projection
        │                    │     │   WHERE status = 'active'
        │                    │     │   → add next_payment_amount
        │                    │     │   → projected_expenses
        │                    │     │
        │                    │     ├─ Calculate net:
        │                    │     │   net = projected_income - projected_expenses
        │                    │     │
        │                    │     ├─ Calculate health_score:
        │                    │     │   calculateHealthScore(net, debt_ratio, ...)
        │                    │     │   → 0-100
        │                    │     │
        │                    │     ├─ Determine health_indicator:
        │                    │     │   score >= 70 → 'healthy'
        │                    │     │   score >= 40 → 'caution'
        │                    │     │   else → 'critical'
        │                    │     │
        │                    │     ├─ Calculate confidence:
        │                    │     │   month 1: 90%
        │                    │     │   month 12: 50%
        │                    │     │
        │                    │     └─ Store in annual_projection table
        │                    │
        │                    ├─ Identify risks:
        │                    │   • critical_months (net < 0)
        │                    │   • debt_spike_months (expenses > 2x average)
        │                    │
        │                    └─ Return:
        │                        {
        │                          months: [
        │                            { month: "2026-07", income: 500k, expenses: 350k, net: 150k, health: 85 },
        │                            { month: "2026-08", income: 400k, expenses: 400k, net: 0, health: 40 },
        │                            ...
        │                          ],
        │                          risks: { ... }
        │                        }
        │
        └─ Render:
            │
            ├─ Loop months:
            │   ├─ MonthCard:
            │   │   ├─ Title: "Julio 2026"
            │   │   ├─ Income/Expenses/Net bars
            │   │   ├─ Health indicator (green/yellow/red)
            │   │   └─ Confidence score (90%)
            │   │
            │   └─ Repeat 12x
            │
            ├─ HealthChart (gráfica línea score por mes)
            │
            ├─ Risks panel:
            │   • "Octubre: Net negativo (-$100k)"
            │   • "Abril: Spike de deuda"
            │
            └─ Recommendations:
                • "Preparar fondos para Octubre"
                • "Renegociar con proveedor en Abril"
```

**Timing**: ~1000ms (12 queries + calculations)

---

## 🗄️ DATABASE SCHEMA SIMPLIFIED

```
CASH_FLOW_PERIODS (1 por semana)
├─ id, organization_id
├─ week_start, week_end
├─ cash_available, cash_committed, cash_buffer
└─ health_score

PAYABLES (Gastos empresa)
├─ id, cash_flow_period_id
├─ creditor_name, amount, due_date
├─ payment_status
└─ recurring, recurring_type

RECEIVABLES (Ingresos esperados)
├─ id, cash_flow_period_id
├─ debtor_name, amount, expected_date
└─ collection_status

CREDIT_PROJECTION (Créditos)
├─ id, organization_id
├─ credit_name, original_amount, remaining_balance
├─ interest_rate, term_months
├─ amortization_type
└─ credit_status

PAYMENT_SCHEDULE (Plan pago individual)
├─ id, payable_id
├─ scheduled_date, scheduled_amount
└─ payment_status

WEEKLY_PAYMENT_PLAN (Qué pagar cada día)
├─ id, cash_flow_period_id
├─ day_of_week (1-7)
├─ payment_priority (1-4)
└─ total_planned, total_executed

BANK_ACCOUNTS_MULTI (Múltiples cuentas)
├─ id, organization_id
├─ account_name, bank_name, account_number
├─ available_balance, total_balance
└─ is_primary, connected

MULTI_ACCOUNT_RECOMMENDATIONS
├─ id, organization_id
├─ from_account_id, to_account_id
├─ recommended_amount, reason
└─ urgency, confidence_score

ANNUAL_PROJECTION (12 meses)
├─ id, organization_id
├─ month_date, scenario
├─ projected_income, projected_expenses, projected_net
├─ health_score, health_indicator
└─ confidence_score

ECONOMIC_INDICATORS (Pública)
├─ id
├─ indicator_type (TIIE, UDI, inflation, exchange)
├─ indicator_value
└─ measurement_date
```

---

## 🔐 RLS POLICY PATTERN

**Cada tabla con `organization_id` está protegida**

```
┌─────────────────────────────────────────┐
│  Usuario Juan (org_id = "org-123")      │
│                                         │
│  Query: SELECT * FROM payables          │
│  ↓                                      │
│  RLS Policy activado:                   │
│    WHERE organization_id = auth.uid()'s org
│  ↓                                      │
│  Juan solo VE payables donde            │
│    payables.organization_id = "org-123" │
│  ↓                                      │
│  Retorna: 5 payables                    │
│  ↓                                      │
│  Si intenta acceder org-456:            │
│  ↓                                      │
│  ERROR: Permission denied ✓             │
└─────────────────────────────────────────┘
```

---

## 🎯 ALGORITHM PIPELINE

```
Raw financial data
        │
        ├─ Payables[]
        ├─ Receivables[]
        ├─ Credits[]
        └─ BankAccounts[]
        │
        ↓
    ┌─────────────────────────────────┐
    │  Normalize & Validate Data      │
    │  • Check dates are valid        │
    │  • Verify amounts > 0           │
    │  • Confirm org_id matches       │
    └─────────────────────────────────┘
        │
        ↓
    ┌─────────────────────────────────┐
    │  Calculate Core Metrics         │
    │  • cash_available               │
    │  • payment_capacity             │
    │  • debt_ratio                   │
    └─────────────────────────────────┘
        │
        ├─ Branch 1: Health Scoring
        │   │
        │   └─ calculateHealthScore()
        │       → score 0-100
        │       → status (healthy/caution/critical)
        │
        ├─ Branch 2: Projections
        │   │
        │   └─ generateAnnualProjection()
        │       → 12 months with net + health
        │
        ├─ Branch 3: Amortization (Credits)
        │   │
        │   └─ generateAmortizationSchedule()
        │       → Fixed/Graduated/Balloon/InterestOnly
        │       → 60-month payment plan
        │
        ├─ Branch 4: AI/ML Confidence
        │   │
        │   └─ calculatePaymentConfidence()
        │       → probability of collection
        │       → factors & recommendation
        │
        └─ Branch 5: Recommendations
            │
            ├─ recommendExcessFundsStrategy()
            │   → PAY vs INVEST vs SPLIT
            │
            └─ recommendAccountTransfers()
                → From/To + amount + urgency
        │
        ↓
    ┌─────────────────────────────────┐
    │  Combine & Return Dashboard     │
    │  • All metrics                  │
    │  • All calculations             │
    │  • All recommendations          │
    └─────────────────────────────────┘
        │
        ↓
    React Components
        │
        └─ Render dashboards, charts, cards
```

---

## 🔄 COMPONENT HIERARCHY

```
FlujoCheckHome (index.tsx)
│
├─ TopBar
│   └─ "Flujo" "Check" + ⚙️ + 👁️ (admin)
│
├─ [Active Tab Content]
│   │
│   ├─ FlujoDashboard (Tab 0)
│   │   ├─ HealthIndicator
│   │   ├─ DashboardWidget (cash_available)
│   │   ├─ DashboardWidget (cash_committed)
│   │   ├─ PayablesList
│   │   │   └─ PayableListItem[]
│   │   ├─ ReceivablesList
│   │   │   └─ ReceivableListItem[]
│   │   └─ RecommendationCard[]
│   │
│   ├─ CreditosPanel (Tab 1)
│   │   ├─ CreditList
│   │   │   └─ CreditListItem[]
│   │   │       ├─ Credit name + balance
│   │   │       ├─ Payment schedule (next 3 meses)
│   │   │       └─ Edit/Delete buttons
│   │   ├─ OCRScanner
│   │   │   ├─ Camera button
│   │   │   └─ Preview + confirm
│   │   └─ AmortizationModal (rules editor)
│   │
│   ├─ ProyeccionAnual (Tab 2)
│   │   ├─ ScenarioSelector (pessimistic/realistic/optimistic)
│   │   ├─ MonthCard[] (12x)
│   │   │   ├─ Income/Expenses/Net bars
│   │   │   ├─ Health indicator
│   │   │   └─ Confidence score
│   │   ├─ HealthChart (line graph)
│   │   └─ RisksPanel
│   │
│   ├─ Configuracion (Tab 3)
│   │   ├─ BankAccountsSetup
│   │   │   ├─ Account list
│   │   │   ├─ Connect new
│   │   │   └─ Edit primary
│   │   └─ PaymentRulesEditor
│   │       ├─ Amortization type selector
│   │       └─ Rule parameters
│   │
│   └─ ProfileTab (Tab 4)
│       ├─ Avatar
│       ├─ User info
│       ├─ Role display
│       └─ Logout button
│
└─ BottomTabBar
    ├─ Tab indicator (active)
    ├─ Badge counts (pending credits, etc)
    └─ 5 tab buttons
```

---

## ⏱️ TIMING ESTIMATES

```
Operation                  Time    Components Used
────────────────────────────────────────────────────────
GET dashboard              500ms   FlujoDashboard
  - Supabase query         100ms   
  - Calculations           200ms   calculateHealthScore
  - Render widgets         200ms   DashboardWidget[]

Scan credit (OCR)         2000ms   CreditosPanel
  - Camera capture         500ms   Camera API
  - OCR processing        1000ms   ML Kit / Tesseract
  - DB insert + amort      500ms   credit_amortization_rules

Annual projection         1000ms   ProyeccionAnual
  - 12x queries            400ms   annual_projection
  - Calculate health       400ms   generateAnnualProjection
  - Render chart           200ms   HealthChart

Simulate payment          300ms    Configuracion
  - Calculate impact       200ms   calculatePaymentCapacity
  - Render results         100ms   Modal

Recommend transfers       400ms    useMultiAccount
  - Query accounts         100ms   bank_accounts_multi
  - Algorithm run          200ms   recommendAccountTransfers
  - Store recs             100ms   multi_account_recommendations
```

---

## 📌 KEY INTEGRATION POINTS

```
GastoCheck                          FlujoCheck
├─ bank_accounts_multi              ├─ Reads bank_accounts_multi
│  (connected by user)              │  → Display available balance
│                                   │
├─ organizations                    ├─ Filters by organization_id
│  (company context)                │  → RLS policy
│                                   │
└─ user_roles                       └─ Checks role (admin/supervisor/accountant)
   (admin/supervisor/accountant)       → Show/hide tabs, data
```

**They share:**
- `organizations` table
- `bank_accounts_multi` table (GastoCheck populates, FlujoCheck reads)
- `user_roles` table
- Same Supabase project + RLS

---

## 🚀 DEPLOYMENT FLOW

```
1. Code ready on branch: feature/flujocheck-core

2. Create tables + RLS:
   ├─ Run migration SQL
   └─ Verify 14 tables created

3. Deploy API endpoints:
   ├─ /api/flujo/periods
   ├─ /api/flujo/dashboard
   ├─ /api/flujo/credit-scan
   ├─ /api/flujo/projection/annual
   └─ /api/flujo/simulate-payment

4. Deploy mobile app (EAS):
   ├─ Build on EAS
   ├─ Test on preview device
   ├─ Collect feedback
   └─ Push to production

5. Monitor:
   ├─ Supabase logs (errors, slow queries)
   ├─ API response times
   ├─ Mobile crash reports
   └─ User feedback
```

---

**This architecture is designed to be:**
- ✅ Scalable (12 db queries can be cached)
- ✅ Secure (RLS on every table)
- ✅ Fast (indexed queries, edge function caching)
- ✅ Maintainable (clear separation of concerns)
- ✅ Testable (pure functions for algorithms)

