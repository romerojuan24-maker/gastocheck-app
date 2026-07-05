/**
 * FlujoCheck Types (Expanded)
 * Todas las interfaces y tipos para cash flow management
 */

// ── Core Cash Flow Item (Existing from OTA 137) ────────────────────────────

export interface CashFlowItem {
  id: string
  company_id: string
  description: string
  amount: number
  direction: 'in' | 'out'
  item_type: 'income' | 'expense'
  expected_date: string
  status: 'pending' | 'paid' | 'collected' | 'at_risk' | 'overdue' | 'cancelled'
  source: 'manual' | 'cobracheck' | 'gastocheck' | 'bancocheck' | 'inventariocheck'
  notes: string | null
  is_scenario: boolean
  created_at: string
}

export interface RiskStatus {
  status: 'green' | 'yellow' | 'red'
  balance: number
}

// ── Cash Flow Periods ─────────────────────────────────────────────────────

export interface CashFlowPeriod {
  id: string
  company_id: string
  period_start: string        // ISO date
  period_end: string
  balance_start: number
  balance_projected: number
  balance_actual: number | null
  risk_level: 'green' | 'yellow' | 'red'
  notes?: string
  created_at: string
  updated_at: string
}

// ── Payables (Deudas) ─────────────────────────────────────────────────────

export interface Payable {
  id: string
  company_id: string
  period_id: string
  description: string
  amount: number
  due_date: string            // ISO date
  paid_date: string | null
  status: 'pending' | 'paid' | 'overdue' | 'cancelled'
  created_at: string
  updated_at: string
}

export type PayableInput = Omit<Payable, 'id' | 'created_at' | 'updated_at'>

// ── Receivables (Ingresos/Cobros) ──────────────────────────────────────────

export interface Receivable {
  id: string
  company_id: string
  period_id: string
  description: string
  amount: number
  expected_date: string       // ISO date
  received_date: string | null
  status: 'pending' | 'received' | 'overdue' | 'cancelled'
  created_at: string
  updated_at: string
}

export type ReceivableInput = Omit<Receivable, 'id' | 'created_at' | 'updated_at'>

// ── Credits (Financiamientos) ─────────────────────────────────────────────

export type AmortizationType = 'fixed_payment' | 'amortized_balance' | 'last_payment_balloon' | 'interest_only'

export interface Credit {
  id: string
  company_id: string
  name: string
  principal: number
  current_balance: number
  interest_rate: number       // 0.1250 = 12.50%
  amortization_type: AmortizationType
  start_date: string          // ISO date
  end_date: string | null
  monthly_payment: number | null
  payments_remaining: number | null
  terms_document_url?: string
  created_at: string
  updated_at: string
}

export type CreditInput = Omit<Credit, 'id' | 'created_at' | 'updated_at'>

// ── Credit Amortization Rules ─────────────────────────────────────────────

export type AmortizationRuleType =
  | 'early_payment_allowed'
  | 'early_payment_penalty'
  | 'extra_payments_apply_to_principal'
  | 'extra_payments_apply_to_last_payment'

export interface CreditAmortizationRule {
  id: string
  credit_id: string
  rule_type: AmortizationRuleType
  rule_value: number | null
  description?: string
  created_at: string
}

// ── Payment Schedule (Plan de pagos de crédito) ───────────────────────────

export interface PaymentScheduleItem {
  id: string
  credit_id: string
  payment_number: number
  due_date: string            // ISO date
  principal_payment: number
  interest_payment: number
  total_payment: number
  balance_after: number
  status: 'scheduled' | 'paid' | 'overdue' | 'missed'
  paid_date: string | null
  paid_amount: number | null
  created_at: string
  updated_at: string
}

// ── Weekly Payment Plan (Qué pagar cada día) ──────────────────────────────

export interface WeeklyPaymentItem {
  type: 'credit' | 'payable'
  id: string
  amount: number
  description: string
}

export interface WeeklyPaymentPlan {
  id: string
  company_id: string
  period_id: string
  day_of_week: number         // 0=Mon, 6=Sun
  payment_items: WeeklyPaymentItem[]
  total_amount: number
  created_at: string
  updated_at: string
}

// ── Bank Accounts Multi (Múltiples cuentas) ───────────────────────────────

export type AccountPurpose = 'operational' | 'reserve' | 'payroll' | 'investment'

export interface BankAccountMulti {
  id: string
  company_id: string
  name: string
  bank_name?: string
  account_number?: string
  purpose: AccountPurpose
  balance_current: number
  min_buffer?: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type BankAccountMultiInput = Omit<BankAccountMulti, 'id' | 'created_at' | 'updated_at'>

// ── Multi Account Recommendations ─────────────────────────────────────────

export interface MultiAccountRecommendation {
  id: string
  company_id: string
  period_id: string
  from_account_id: string
  to_account_id: string
  recommended_amount: number
  reason?: string
  priority: number            // 0-100
  action_status: 'pending' | 'executed' | 'dismissed'
  executed_date?: string      // ISO date
  created_at: string
}

// ── Recurring Payments (Automáticos) ──────────────────────────────────────

export type PaymentFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual'

export interface RecurringPayment {
  id: string
  company_id: string
  name: string
  amount: number
  frequency: PaymentFrequency
  next_due_date: string       // ISO date
  is_active: boolean
  created_at: string
  updated_at: string
}

export type RecurringPaymentInput = Omit<RecurringPayment, 'id' | 'created_at' | 'updated_at'>

// ── Payment Collection Confidence (IA/ML scoring) ──────────────────────────

export type ConfidenceLevel = 'green' | 'yellow' | 'red'

export interface PaymentCollectionConfidence {
  id: string
  receivable_id: string
  confidence_score: number    // 0-100
  confidence_level: ConfidenceLevel
  reasoning?: string
  created_at: string
}

// ── Cash Flow Transactions (Historial) ────────────────────────────────────

export type TransactionType = 'payable' | 'receivable' | 'transfer' | 'adjustment'

export interface CashFlowTransaction {
  id: string
  company_id: string
  period_id: string
  transaction_date: string    // ISO date
  transaction_type: TransactionType
  reference_id?: string
  description: string
  amount: number
  balance_after: number | null
  created_at: string
}

// ── Annual Projection (12-month forecast) ─────────────────────────────────

export interface AnnualProjection {
  id: string
  company_id: string
  projection_month: number    // 1-12
  projection_year: number
  projected_income: number | null
  projected_expenses: number | null
  projected_net_cash: number | null
  health_status: 'green' | 'yellow' | 'red'
  health_score: number        // 0-100
  created_at: string
  updated_at: string
}

// ── Economic Indicators (TIIE, UDI, inflación) ────────────────────────────

export interface EconomicIndicator {
  id: string
  indicator_name: string      // "TIIE 28", "UDI", "Inflación"
  indicator_date: string      // ISO date
  indicator_value: number
  source?: string             // "Banxico", "INEGI"
  created_at: string
}

// ── Dashboard Data Structures ─────────────────────────────────────────────

export interface FlujoBalance {
  current_balance: number
  period_start_balance: number
  difference: number          // current - start
  buffer_required: number
  buffer_available: number
}

export interface FlujoDashboard {
  period: CashFlowPeriod
  balance: FlujoBalance
  payables: Payable[]
  receivables: Receivable[]
  credits: Credit[]
  recommendations: MultiAccountRecommendation[]
  health_status: ConfidenceLevel
  upcoming_payments: PaymentScheduleItem[]
}

// ── API Response Types ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  timestamp?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}

// ── Algorithm Input/Output ────────────────────────────────────────────────

export interface AmortizationCalculation {
  credit_id: string
  principal: number
  interest_rate: number
  months: number
  start_date: string          // ISO date
  amortization_type: AmortizationType
}

export interface AmortizationResult {
  payment_schedule: PaymentScheduleItem[]
  total_interest: number
  total_payments: number
  monthly_payment?: number
}

export interface ProjectionCalculation {
  company_id: string
  starting_balance: number
  receivables: Receivable[]
  payables: Payable[]
  recurring_payments: RecurringPayment[]
  months: number              // How many months to project
}

export interface ProjectionResult {
  monthly_projections: AnnualProjection[]
  ending_balance: number
  health_status: ConfidenceLevel
  warnings: string[]
}

export interface PaymentCapacityInput {
  current_balance: number
  outstanding_payables: number
  buffer_required: number
  credit_payments_due: number
}

export interface PaymentCapacityResult {
  available_to_pay: number
  buffer_remaining: number
  is_sufficient: boolean
  recommendations: string[]
}
