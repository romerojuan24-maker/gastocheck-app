/**
 * FlujoCheck Amortization & Projection Hooks
 * Financial calculations for cash flow
 */

import { useState, useCallback } from 'react'
import type { PaymentScheduleItem, AnnualProjection, PaymentCapacityResult } from '../types'

// ============================================================================
// useAmortizationCalculation
// ============================================================================

export function useAmortizationCalculation() {
  const [schedule, setSchedule] = useState<PaymentScheduleItem[]>([])
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calculate = useCallback(
    async (
      type: 'fixed' | 'graduated' | 'balloon' | 'interest_only',
      principal: number,
      annualRate: number,
      months: number,
      startDate: Date,
      balloonPercentage?: number
    ): Promise<PaymentScheduleItem[]> => {
      setCalculating(true)
      setError(null)

      try {
        // TODO: Call backend API /api/flujo/amortization with parameters
        // For now, generate mock schedule
        const mockSchedule: PaymentScheduleItem[] = []
        let balance = principal
        const monthlyRate = annualRate / 12

        for (let i = 1; i <= months; i++) {
          const interest = balance * monthlyRate
          const principal_payment = principal / months
          balance -= principal_payment

          mockSchedule.push({
            id: `payment_${i}`,
            credit_id: '',
            payment_number: i,
            due_date: new Date(startDate.setMonth(startDate.getMonth() + 1))
              .toISOString()
              .split('T')[0],
            principal_payment,
            interest_payment: interest,
            total_payment: principal_payment + interest,
            balance_after: Math.max(0, balance),
            status: 'scheduled',
            paid_date: null,
            paid_amount: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }

        setSchedule(mockSchedule)
        return mockSchedule
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Calculation failed'
        setError(msg)
        return []
      } finally {
        setCalculating(false)
      }
    },
    []
  )

  return { schedule, calculating, error, calculate }
}

// ============================================================================
// usePaymentCapacity
// ============================================================================

export function usePaymentCapacity() {
  const [capacity, setCapacity] = useState<PaymentCapacityResult | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calculate = useCallback(
    async (
      currentBalance: number,
      bufferRequired: number,
      outstandingPayables: number,
      creditPaymentsDue: number
    ): Promise<PaymentCapacityResult> => {
      setCalculating(true)
      setError(null)

      try {
        const totalObligations = outstandingPayables + creditPaymentsDue
        const availableAfterBuffer = currentBalance - bufferRequired
        const availableToPay = Math.max(0, availableAfterBuffer - totalObligations)
        const bufferRemaining = Math.max(0, currentBalance - totalObligations)
        const isSufficient = availableToPay > 0

        const recommendations: string[] = []
        if (!isSufficient) {
          recommendations.push('⚠️ Insufficient availability for obligations')
          if (bufferRemaining < bufferRequired) {
            recommendations.push('Buffer below minimum required')
          }
        } else if (availableToPay > bufferRequired * 0.5) {
          recommendations.push('✅ Healthy payment capacity')
        }

        const result: PaymentCapacityResult = {
          available_to_pay: availableToPay,
          buffer_remaining: bufferRemaining,
          is_sufficient: isSufficient,
          recommendations,
        }

        setCapacity(result)
        return result
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Calculation failed'
        setError(msg)
        return {
          available_to_pay: 0,
          buffer_remaining: 0,
          is_sufficient: false,
          recommendations: ['Error calculating capacity'],
        }
      } finally {
        setCalculating(false)
      }
    },
    []
  )

  return { capacity, calculating, error, calculate }
}

// ============================================================================
// useAnnualProjection
// ============================================================================

export function useAnnualProjection() {
  const [projections, setProjections] = useState<AnnualProjection[]>([])
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calculate = useCallback(
    async (
      startingBalance: number,
      monthlyIncomeAvg: number,
      monthlyExpenseAvg: number,
      monthlyCreditPayments?: number
    ): Promise<AnnualProjection[]> => {
      setCalculating(true)
      setError(null)

      try {
        const results: AnnualProjection[] = []
        let runningBalance = startingBalance
        const now = new Date()

        for (let i = 1; i <= 12; i++) {
          const projectedIncome = monthlyIncomeAvg
          const projectedExpenses = monthlyExpenseAvg + (monthlyCreditPayments || 0)
          const projectedNetCash = projectedIncome - projectedExpenses
          runningBalance += projectedNetCash

          const healthRatio = runningBalance / startingBalance
          let healthStatus: 'green' | 'yellow' | 'red' = 'green'
          let healthScore = 100

          if (healthRatio < 0.5) {
            healthStatus = 'red'
            healthScore = 30
          } else if (healthRatio < 0.9) {
            healthStatus = 'yellow'
            healthScore = 60
          } else if (healthRatio > 1.5) {
            healthScore = 100
          }

          const projectionDate = new Date(now)
          projectionDate.setMonth(projectionDate.getMonth() + i)

          results.push({
            id: `projection_${i}`,
            company_id: '',
            projection_month: i,
            projection_year: projectionDate.getFullYear(),
            projected_income: projectedIncome,
            projected_expenses: projectedExpenses,
            projected_net_cash: projectedNetCash,
            health_status: healthStatus,
            health_score: healthScore,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }

        setProjections(results)
        return results
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Projection calculation failed'
        setError(msg)
        return []
      } finally {
        setCalculating(false)
      }
    },
    []
  )

  return { projections, calculating, error, calculate }
}
