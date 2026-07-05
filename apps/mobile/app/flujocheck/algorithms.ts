/**
 * FlujoCheck Algorithms
 * Core financial calculation logic
 */

import type {
  AmortizationType,
  PaymentScheduleItem,
  AnnualProjection,
  PaymentCapacityResult,
  AmortizationCalculation,
  AmortizationResult,
} from './types'

// ============================================================================
// AMORTIZATION CALCULATIONS
// ============================================================================

/**
 * Fixed Payment Amortization (cuota fija)
 * Same payment every month, principal increases, interest decreases
 */
export function calculateFixedAmortization(
  principal: number,
  annual_rate: number,
  months: number,
  start_date: Date
): PaymentScheduleItem[] {
  const schedule: PaymentScheduleItem[] = []
  const monthly_rate = annual_rate / 12
  const fixed_payment =
    (principal *
      (monthly_rate * Math.pow(1 + monthly_rate, months))) /
    (Math.pow(1 + monthly_rate, months) - 1)

  let remaining_balance = principal
  let current_date = new Date(start_date)

  for (let i = 1; i <= months; i++) {
    const interest_payment = remaining_balance * monthly_rate
    const principal_payment = fixed_payment - interest_payment
    remaining_balance = Math.max(0, remaining_balance - principal_payment)

    const due_date = new Date(current_date)
    due_date.setMonth(due_date.getMonth() + 1)

    schedule.push({
      id: `payment_${i}`,
      credit_id: '',
      payment_number: i,
      due_date: due_date.toISOString().split('T')[0],
      principal_payment: Math.max(0, principal_payment),
      interest_payment,
      total_payment: fixed_payment,
      balance_after: Math.max(0, remaining_balance),
      status: 'scheduled',
      paid_date: null,
      paid_amount: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    current_date = new Date(due_date)
  }

  return schedule
}

/**
 * Graduated Amortization (cuota creciente)
 * Payment increases over time, starting low
 */
export function calculateGraduatedAmortization(
  principal: number,
  annual_rate: number,
  months: number,
  start_date: Date,
  graduation_rate: number = 0.05
): PaymentScheduleItem[] {
  const schedule: PaymentScheduleItem[] = []
  const monthly_rate = annual_rate / 12

  // Calculate base payment and apply graduation
  const base_payment = principal / months
  let remaining_balance = principal
  let current_date = new Date(start_date)
  let payment_multiplier = 1

  for (let i = 1; i <= months; i++) {
    const interest_payment = remaining_balance * monthly_rate
    const principal_payment = base_payment * payment_multiplier
    const total_payment = interest_payment + principal_payment
    remaining_balance = Math.max(0, remaining_balance - principal_payment)

    const due_date = new Date(current_date)
    due_date.setMonth(due_date.getMonth() + 1)

    schedule.push({
      id: `payment_${i}`,
      credit_id: '',
      payment_number: i,
      due_date: due_date.toISOString().split('T')[0],
      principal_payment,
      interest_payment,
      total_payment,
      balance_after: Math.max(0, remaining_balance),
      status: 'scheduled',
      paid_date: null,
      paid_amount: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    // Increase payment by graduation rate each period
    payment_multiplier += graduation_rate

    current_date = new Date(due_date)
  }

  return schedule
}

/**
 * Balloon Payment Amortization (pago global al final)
 * Low payments, large final payment
 */
export function calculateBalloonAmortization(
  principal: number,
  annual_rate: number,
  months: number,
  balloon_percentage: number,
  start_date: Date
): PaymentScheduleItem[] {
  const schedule: PaymentScheduleItem[] = []
  const monthly_rate = annual_rate / 12
  const balloon_amount = principal * (balloon_percentage / 100)
  const amortizing_principal = principal - balloon_amount
  const monthly_payment = amortizing_principal / (months - 1)

  let remaining_balance = principal
  let current_date = new Date(start_date)

  for (let i = 1; i <= months; i++) {
    const interest_payment = remaining_balance * monthly_rate
    let principal_payment = 0

    if (i === months) {
      // Last payment: balloon + remaining interest
      principal_payment = remaining_balance
    } else {
      principal_payment = monthly_payment
    }

    const total_payment = interest_payment + principal_payment
    remaining_balance = Math.max(0, remaining_balance - principal_payment)

    const due_date = new Date(current_date)
    due_date.setMonth(due_date.getMonth() + 1)

    schedule.push({
      id: `payment_${i}`,
      credit_id: '',
      payment_number: i,
      due_date: due_date.toISOString().split('T')[0],
      principal_payment,
      interest_payment,
      total_payment,
      balance_after: Math.max(0, remaining_balance),
      status: 'scheduled',
      paid_date: null,
      paid_amount: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    current_date = new Date(due_date)
  }

  return schedule
}

/**
 * Interest Only Amortization (solo interés)
 * Only interest paid monthly, principal due at end
 */
export function calculateInterestOnlyAmortization(
  principal: number,
  annual_rate: number,
  months: number,
  start_date: Date
): PaymentScheduleItem[] {
  const schedule: PaymentScheduleItem[] = []
  const monthly_rate = annual_rate / 12
  const monthly_interest = principal * monthly_rate

  let current_date = new Date(start_date)

  for (let i = 1; i <= months; i++) {
    const interest_payment = monthly_interest
    const principal_payment = i === months ? principal : 0
    const total_payment = interest_payment + principal_payment
    const balance_after = i === months ? 0 : principal

    const due_date = new Date(current_date)
    due_date.setMonth(due_date.getMonth() + 1)

    schedule.push({
      id: `payment_${i}`,
      credit_id: '',
      payment_number: i,
      due_date: due_date.toISOString().split('T')[0],
      principal_payment,
      interest_payment,
      total_payment,
      balance_after,
      status: 'scheduled',
      paid_date: null,
      paid_amount: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    current_date = new Date(due_date)
  }

  return schedule
}

// ============================================================================
// PAYMENT CAPACITY
// ============================================================================

/**
 * Calculate available amount for payment considering buffer
 */
export function calculatePaymentCapacity(
  current_balance: number,
  buffer_required: number,
  outstanding_payables: number,
  credit_payments_due: number
): PaymentCapacityResult {
  const total_obligations = outstanding_payables + credit_payments_due
  const available_after_buffer = current_balance - buffer_required
  const available_to_pay = Math.max(0, available_after_buffer - total_obligations)
  const buffer_remaining = Math.max(0, current_balance - total_obligations)
  const is_sufficient = available_to_pay > 0

  const recommendations: string[] = []
  if (!is_sufficient) {
    recommendations.push('⚠️ Insufficient availability for obligations')
    if (buffer_remaining < buffer_required) {
      recommendations.push('Buffer below minimum required')
    }
  } else if (available_to_pay > buffer_required * 0.5) {
    recommendations.push('✅ Healthy payment capacity')
  }

  return {
    available_to_pay,
    buffer_remaining,
    is_sufficient,
    recommendations,
  }
}

// ============================================================================
// ANNUAL PROJECTION
// ============================================================================

/**
 * Project 12-month cash flow with health scoring
 */
export function generateAnnualProjection(
  starting_balance: number,
  monthly_income_avg: number,
  monthly_expense_avg: number,
  monthly_credit_payments: number = 0
): AnnualProjection[] {
  const projections: AnnualProjection[] = []
  let running_balance = starting_balance
  const now = new Date()

  for (let i = 1; i <= 12; i++) {
    const projected_income = monthly_income_avg
    const projected_expenses = monthly_expense_avg + monthly_credit_payments
    const projected_net_cash = projected_income - projected_expenses
    running_balance += projected_net_cash

    // Health status based on balance trend
    const health_ratio = running_balance / starting_balance
    let health_status: 'green' | 'yellow' | 'red' = 'green'
    let health_score = 100

    if (health_ratio < 0.5) {
      health_status = 'red'
      health_score = 30
    } else if (health_ratio < 0.9) {
      health_status = 'yellow'
      health_score = 60
    } else if (health_ratio > 1.5) {
      health_score = 100
    }

    const projection_date = new Date(now)
    projection_date.setMonth(projection_date.getMonth() + i)

    projections.push({
      id: `projection_${i}`,
      company_id: '',
      projection_month: i,
      projection_year: projection_date.getFullYear(),
      projected_income,
      projected_expenses,
      projected_net_cash,
      health_status,
      health_score,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  return projections
}

// ============================================================================
// EARLY PAYMENT OPTIMIZATION
// ============================================================================

/**
 * Analyze if early payment is beneficial
 */
export function analyzeEarlyPaymentBenefit(
  current_credit_balance: number,
  monthly_interest_rate: number,
  months_remaining: number,
  excess_cash_available: number,
  investment_return_rate: number = 0.03
): {
  should_pay_early: boolean
  interest_saved: number
  opportunity_cost: number
  net_benefit: number
  recommendation: string
} {
  // Calculate interest that would be saved
  const total_future_interest = current_credit_balance * monthly_interest_rate * months_remaining
  const interest_saved = (excess_cash_available / current_credit_balance) * total_future_interest

  // Calculate opportunity cost (money not invested)
  const opportunity_cost = excess_cash_available * investment_return_rate * (months_remaining / 12)

  // Net benefit = interest saved - opportunity cost
  const net_benefit = interest_saved - opportunity_cost
  const should_pay_early = net_benefit > 0

  let recommendation = ''
  if (should_pay_early && net_benefit > excess_cash_available * 0.05) {
    recommendation = '✅ Strongly recommend early payment (high net benefit)'
  } else if (should_pay_early) {
    recommendation = '✓ Early payment slightly beneficial'
  } else if (net_benefit > -excess_cash_available * 0.02) {
    recommendation = '≈ Neutral; can pay early or invest'
  } else {
    recommendation = '💰 Better to invest; early payment not optimal'
  }

  return {
    should_pay_early,
    interest_saved,
    opportunity_cost,
    net_benefit,
    recommendation,
  }
}
