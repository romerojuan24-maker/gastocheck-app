/**
 * FlujoCheck Hooks
 * Custom hooks para cash flow management
 */

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type {
  CashFlowItem,
  CashFlowPeriod,
  Payable,
  Receivable,
  Credit,
  PaymentScheduleItem,
  FlujoBalance,
  ApiResponse,
} from './types'

// ============================================================================
// useFlujoBalance — Obtener saldo del período actual
// ============================================================================

export function useFlujoBalance(company_id: string) {
  const [balance, setBalance] = useState<FlujoBalance>({
    current_balance: 0,
    period_start_balance: 0,
    difference: 0,
    buffer_required: 0,
    buffer_available: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!company_id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // STUB: Fetch current period
      // TODO: Query cash_flow_periods table for current week
      const response = await fetch(
        `/api/flujo/dashboard?company_id=${company_id}`
      )
      if (!response.ok) throw new Error('Failed to fetch dashboard')

      const data: ApiResponse<any> = await response.json()
      if (data.success && data.data?.balance) {
        setBalance(data.data.balance)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('useFlujoBalance error:', message)
    } finally {
      setLoading(false)
    }
  }, [company_id])

  useEffect(() => {
    refetch()

    // Refresh every 5 minutes
    const interval = setInterval(refetch, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [refetch])

  return { balance, loading, error, refetch }
}

// ============================================================================
// useFlujoItems — Obtener payables + receivables del período
// ============================================================================

export function useFlujoItems(company_id: string) {
  const [items, setItems] = useState<CashFlowItem[]>([])
  const [risk, setRisk] = useState<'green' | 'yellow' | 'red'>('green')
  const [projected, setProjected] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async (currentBalance?: number) => {
    if (!company_id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // STUB: Fetch cash flow items
      // TODO: Query payables + receivables tables
      const response = await fetch(
        `/api/flujo/dashboard?company_id=${company_id}`
      )
      if (!response.ok) throw new Error('Failed to fetch items')

      const data: ApiResponse<any> = await response.json()
      if (data.success && data.data?.period) {
        // Combine payables (out) + receivables (in) into single items list
        const payables: CashFlowItem[] = (
          data.data.payables || []
        ).map((p: Payable) => ({
          id: p.id,
          direction: 'out' as const,
          amount: p.amount,
          description: p.description,
          expected_date: p.due_date,
          status: p.status as any,
        }))

        const receivables: CashFlowItem[] = (
          data.data.receivables || []
        ).map((r: Receivable) => ({
          id: r.id,
          direction: 'in' as const,
          amount: r.amount,
          description: r.description,
          expected_date: r.expected_date,
          status: r.status as any,
        }))

        setItems([...payables, ...receivables])
        setRisk(data.data.period.risk_level || 'green')
        setProjected(data.data.period.balance_projected || 0)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('useFlujoItems error:', message)
    } finally {
      setLoading(false)
    }
  }, [company_id])

  useEffect(() => {
    refetch()

    // Refresh every 5 minutes
    const interval = setInterval(refetch, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [refetch])

  return { items, risk, projected, loading, error, refetch }
}

// ============================================================================
// useFlujoMutations — Operaciones CRUD (crear, actualizar, eliminar)
// ============================================================================

export interface FlujoMutationResult {
  success: boolean
  error?: string
  data?: CashFlowItem
}

export function useFlujoMutations(company_id: string) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Crear o actualizar item
  const save = useCallback(
    async (item: Partial<CashFlowItem>): Promise<FlujoMutationResult> => {
      if (!company_id) {
        return {
          success: false,
          error: 'Company ID required',
        }
      }

      try {
        setSaving(true)
        setError(null)

        // TODO: Implement actual INSERT/UPDATE logic
        // For now, stub that returns success
        if (item.id) {
          // UPDATE
          console.log('[STUB] Updating item:', item.id)
        } else {
          // INSERT
          console.log('[STUB] Creating item:', item)
        }

        return {
          success: true,
          data: {
            id: item.id || crypto.randomUUID(),
            company_id,
            description: item.description || '',
            amount: item.amount || 0,
            direction: item.direction || 'in',
            item_type: item.direction === 'in' ? 'income' : 'expense',
            expected_date: item.expected_date || new Date().toISOString(),
            status: 'pending',
            source: 'manual',
            notes: null,
            is_scenario: false,
            created_at: new Date().toISOString(),
          },
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        console.error('useFlujoMutations save error:', message)
        return {
          success: false,
          error: message,
        }
      } finally {
        setSaving(false)
      }
    },
    [company_id]
  )

  // Eliminar item
  const remove = useCallback(
    async (item_id: string): Promise<FlujoMutationResult> => {
      if (!company_id || !item_id) {
        return {
          success: false,
          error: 'Company ID and Item ID required',
        }
      }

      try {
        setSaving(true)
        setError(null)

        // TODO: Implement actual DELETE logic
        console.log('[STUB] Deleting item:', item_id)

        return {
          success: true,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        console.error('useFlujoMutations remove error:', message)
        return {
          success: false,
          error: message,
        }
      } finally {
        setSaving(false)
      }
    },
    [company_id]
  )

  return { save, remove, saving, error }
}

// ============================================================================
// useCalculatePaymentCapacity — Calcular capacidad de pago semanal
// ============================================================================

export interface PaymentCapacityResult {
  available_to_pay: number
  buffer_remaining: number
  is_sufficient: boolean
  recommendations: string[]
}

export function useCalculatePaymentCapacity(
  current_balance: number,
  outstanding_payables: number,
  buffer_required: number,
  credit_payments_due: number
): PaymentCapacityResult {
  // Algoritmo: Capacidad de pago = Saldo - Buffer - Payables - Créditos
  const total_obligations = outstanding_payables + credit_payments_due
  const available_to_pay = current_balance - buffer_required - total_obligations
  const buffer_remaining = current_balance - outstanding_payables - credit_payments_due
  const is_sufficient = available_to_pay > 0

  const recommendations: string[] = []
  if (!is_sufficient) {
    recommendations.push('⚠️ Insuficiente disponibilidad')
    if (buffer_remaining < buffer_required) {
      recommendations.push('Buffer por debajo del mínimo recomendado')
    }
  } else if (available_to_pay > buffer_required * 0.5) {
    recommendations.push('✅ Capacidad de pago saludable')
  }

  return {
    available_to_pay: Math.max(0, available_to_pay),
    buffer_remaining: Math.max(0, buffer_remaining),
    is_sufficient,
    recommendations,
  }
}

// ============================================================================
// useAmortizationCalculation — Calcular tabla de amortización
// ============================================================================

export interface AmortizationPayment {
  payment_number: number
  due_date: string
  principal: number
  interest: number
  total: number
  balance_remaining: number
}

export function useAmortizationCalculation(
  principal: number,
  annual_rate: number,
  months: number,
  amortization_type: 'fixed_payment' | 'amortized_balance' | 'last_payment_balloon' | 'interest_only' = 'fixed_payment'
): AmortizationPayment[] {
  const [schedule, setSchedule] = useState<AmortizationPayment[]>([])

  useEffect(() => {
    if (principal <= 0 || months <= 0 || annual_rate < 0) {
      setSchedule([])
      return
    }

    // TODO: Implement full amortization algorithms
    // For now, simple fixed payment calculation
    const monthly_rate = annual_rate / 12
    const fixed_payment =
      (principal *
        (monthly_rate * Math.pow(1 + monthly_rate, months))) /
      (Math.pow(1 + monthly_rate, months) - 1)

    const payments: AmortizationPayment[] = []
    let remaining_balance = principal
    let current_date = new Date()

    for (let i = 1; i <= months; i++) {
      const interest_payment = remaining_balance * monthly_rate
      const principal_payment = fixed_payment - interest_payment
      remaining_balance -= principal_payment

      current_date.setMonth(current_date.getMonth() + 1)

      payments.push({
        payment_number: i,
        due_date: current_date.toISOString().split('T')[0],
        principal: Math.max(0, principal_payment),
        interest: interest_payment,
        total: fixed_payment,
        balance_remaining: Math.max(0, remaining_balance),
      })
    }

    setSchedule(payments)
  }, [principal, annual_rate, months, amortization_type])

  return schedule
}

// ============================================================================
// useAnnualProjection — Proyección 12 meses de cash flow
// ============================================================================

export interface MonthlyProjection {
  month: number
  projected_income: number
  projected_expenses: number
  projected_net: number
  health_status: 'green' | 'yellow' | 'red'
  health_score: number
}

export function useAnnualProjection(
  starting_balance: number,
  monthly_income_avg: number,
  monthly_expense_avg: number
): MonthlyProjection[] {
  const [projections, setProjections] = useState<MonthlyProjection[]>([])

  useEffect(() => {
    const months: MonthlyProjection[] = []
    let running_balance = starting_balance

    for (let i = 1; i <= 12; i++) {
      const projected_net = monthly_income_avg - monthly_expense_avg
      running_balance += projected_net

      // Determine health status based on running balance
      const health_ratio = running_balance / starting_balance
      let health_status: 'green' | 'yellow' | 'red' = 'green'
      let health_score = 100

      if (health_ratio < 0.5) {
        health_status = 'red'
        health_score = 30
      } else if (health_ratio < 1) {
        health_status = 'yellow'
        health_score = 60
      }

      months.push({
        month: i,
        projected_income: monthly_income_avg,
        projected_expenses: monthly_expense_avg,
        projected_net,
        health_status,
        health_score,
      })
    }

    setProjections(months)
  }, [starting_balance, monthly_income_avg, monthly_expense_avg])

  return projections
}
