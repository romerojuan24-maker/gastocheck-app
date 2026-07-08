/**
 * GastoCheck — Lógica de Negocio COMPLETA
 * - Captura de gastos
 * - Aprobación y flujo de autorización
 * - Integración contable
 * - Dashboard con análisis
 */

import type {
  Expense,
  Viatic,
  GastoCheckDashboard,
  GastoCheckAlert,
  ExpenseCategory,
} from '@gastocheck/shared'
import { supabase } from './supabase'

/**
 * ============================================================================
 * 1. REGISTRAR GASTO
 * ============================================================================
 */

export async function submitExpense(data: {
  company_id: string
  category: ExpenseCategory
  description: string
  amount: number
  expense_date: string
  iva?: number
  ieps?: number
  receipt_reference?: string
  notes?: string
  submitted_by: string
}): Promise<{ expense_id: string; status: string }> {
  const expense_id = crypto.randomUUID()
  const total = data.amount + (data.iva || 0) + (data.ieps || 0)

  const { error } = await supabase.from('expenses').insert({
    id: expense_id,
    company_id: data.company_id,
    category: data.category,
    description: data.description,
    amount: data.amount,
    iva: data.iva || null,
    ieps: data.ieps || null,
    total,
    expense_date: data.expense_date,
    period_month: new Date(data.expense_date).getMonth() + 1,
    period_year: new Date(data.expense_date).getFullYear(),
    receipt_reference: data.receipt_reference || null,
    receipt_status: 'pending',
    notes: data.notes || null,
    status: 'draft',
    submitted_by: data.submitted_by,
    submitted_at: new Date().toISOString(),
  })

  if (error) throw error

  return { expense_id, status: 'draft' }
}

/**
 * ============================================================================
 * 2. APROBAR GASTO
 * ============================================================================
 */

export async function approveExpense(
  expense_id: string,
  approved_by: string,
  notes?: string,
): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({
      status: 'approved',
      approved_by,
      approved_at: new Date().toISOString(),
    })
    .eq('id', expense_id)

  if (error) throw error
}

/**
 * ============================================================================
 * 3. RECHAZAR GASTO
 * ============================================================================
 */

export async function rejectExpense(
  expense_id: string,
  rejected_by: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      approved_by: rejected_by,
      approved_at: new Date().toISOString(),
    })
    .eq('id', expense_id)

  if (error) throw error
}

/**
 * ============================================================================
 * 4. CREAR VIÁTICO
 * ============================================================================
 */

export async function submitViatic(data: {
  company_id: string
  employee_id: string
  amount: number
  category: 'meals' | 'transport' | 'accommodation' | 'other'
  trip_date: string
  city: string
  description?: string
  created_by: string
}): Promise<{ viatic_id: string }> {
  const viatic_id = crypto.randomUUID()

  const { error } = await supabase.from('viaticos').insert({
    id: viatic_id,
    company_id: data.company_id,
    person_id: data.employee_id,
    category: data.category,
    amount: data.amount,
    trip_date: data.trip_date,
    city: data.city,
    description: data.description || null,
    status: 'pending',
    created_by: data.created_by,
  })

  if (error) throw error

  return { viatic_id }
}

/**
 * ============================================================================
 * 5. CARGAR DASHBOARD
 * ============================================================================
 */

export async function loadGastoCheckDashboard(company_id: string): Promise<GastoCheckDashboard> {
  const now = new Date()
  const period_month = now.getMonth() + 1
  const period_year = now.getFullYear()

  // A. Gastos del mes
  const monthStart = new Date(period_year, period_month - 1, 1)
    .toISOString()
    .split('T')[0]
  const monthEnd = new Date(period_year, period_month, 0)
    .toISOString()
    .split('T')[0]

  const { data: expensesMonth } = await supabase
    .from('expenses')
    .select('*')
    .eq('company_id', company_id)
    .gte('expense_date', monthStart)
    .lte('expense_date', monthEnd)

  const total_expenses_month = expensesMonth?.length || 0
  const total_amount_month = (expensesMonth || []).reduce((sum, e) => sum + e.total, 0)
  const approved_amount = (expensesMonth || [])
    .filter((e) => e.status === 'approved')
    .reduce((sum, e) => sum + e.total, 0)
  const pending_amount = (expensesMonth || [])
    .filter((e) => e.status === 'draft' || e.status === 'submitted')
    .reduce((sum, e) => sum + e.total, 0)

  // B. Por categoría
  const expensesByCategory = (expensesMonth || [])
    .reduce(
      (acc, e) => {
        const existing = acc.find((c) => c.category === e.category)
        if (existing) {
          existing.count++
          existing.total += e.total
        } else {
          acc.push({ category: e.category, count: 1, total: e.total })
        }
        return acc
      },
      [] as Array<{ category: ExpenseCategory; count: number; total: number }>,
    )
    .map((c) => ({
      ...c,
      percentage: total_amount_month > 0 ? (c.total / total_amount_month) * 100 : 0,
    }))

  // C. Gastos recientes
  const recent_expenses = (expensesMonth || [])
    .sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime())
    .slice(0, 5)

  // D. Viáticos activos
  const { data: viatics } = await supabase
    .from('viaticos')
    .select('*')
    .eq('company_id', company_id)
    .neq('status', 'rejected')

  const active_viatics = (viatics || []).filter((v) => v.status === 'pending')
  const total_viatics = viatics?.length || 0
  const pending_viatics_amount = (active_viatics || []).reduce((sum, v) => sum + v.amount, 0)

  // E. Aprobaciones pendientes
  const pending_approvals = (expensesMonth || [])
    .filter((e) => e.status === 'submitted')
    .sort((a, b) => new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime())
  const pending_approvals_count = pending_approvals.length
  const pending_approvals_amount = pending_approvals.reduce((sum, e) => sum + e.total, 0)

  // F. Alertas
  const alerts: GastoCheckAlert[] = []
  if (pending_approvals_count > 5) {
    alerts.push({
      id: crypto.randomUUID(),
      severity: 'warning',
      title: `${pending_approvals_count} gastos pendientes de aprobación`,
      message: `$${pending_approvals_amount.toFixed(0)} en espera de revisión`,
    })
  }

  if (pending_viatics_amount > total_amount_month * 0.2) {
    alerts.push({
      id: crypto.randomUUID(),
      severity: 'info',
      title: 'Viáticos pendientes altos',
      message: `$${pending_viatics_amount.toFixed(0)} en anticipos sin rendir`,
    })
  }

  // G. Recomendaciones
  const recommendations: string[] = []
  if (pending_approvals_count > 0) recommendations.push(`Aprueba ${pending_approvals_count} gastos pendientes`)
  if (pending_viatics_amount > 0) recommendations.push(`Sigue viáticos de $${pending_viatics_amount.toFixed(0)}`)
  if (total_amount_month > 0)
    recommendations.push(`Costo promedio: $${(total_amount_month / total_expenses_month).toFixed(0)} por gasto`)

  return {
    period_month,
    period_year,
    total_expenses_month,
    total_amount_month,
    pending_amount,
    approved_amount,
    expenses_by_category: expensesByCategory,
    recent_expenses,
    active_viatics,
    total_viatics,
    pending_viatics_amount,
    pending_approvals,
    pending_approvals_count,
    pending_approvals_amount,
    alerts,
    recommendations,
  }
}
