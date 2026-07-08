/**
 * GastoCheck API Routes — COMPLETO
 * GET /api/gastocheck/dashboard — obtener dashboard de gastos
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const company_id = searchParams.get('company_id')

    if (!company_id) {
      return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })
    }

    const now = new Date()
    const period_month = now.getMonth() + 1
    const period_year = now.getFullYear()

    const monthStart = new Date(period_year, period_month - 1, 1).toISOString().split('T')[0]
    const monthEnd = new Date(period_year, period_month, 0).toISOString().split('T')[0]

    // Gastos del mes
    const { data: expensesMonth } = await supabase
      .from('expenses')
      .select('*')
      .eq('company_id', company_id)
      .gte('expense_date', monthStart)
      .lte('expense_date', monthEnd)

    const total_expenses_month = expensesMonth?.length || 0
    const total_amount_month = (expensesMonth || []).reduce((sum: number, e: any) => sum + e.total, 0)
    const approved_amount = (expensesMonth || [])
      .filter((e: any) => e.status === 'approved')
      .reduce((sum: number, e: any) => sum + e.total, 0)
    const pending_amount = (expensesMonth || [])
      .filter((e: any) => e.status === 'draft' || e.status === 'submitted')
      .reduce((sum: number, e: any) => sum + e.total, 0)

    // Por categoría
    const expensesByCategory = (expensesMonth || [])
      .reduce(
        (acc: any, e: any) => {
          const existing = acc.find((c: any) => c.category === e.category)
          if (existing) {
            existing.count++
            existing.total += e.total
          } else {
            acc.push({ category: e.category, count: 1, total: e.total })
          }
          return acc
        },
        [],
      )
      .map((c: any) => ({
        ...c,
        percentage: total_amount_month > 0 ? (c.total / total_amount_month) * 100 : 0,
      }))

    // Gastos recientes
    const recent_expenses = (expensesMonth || [])
      .sort((a: any, b: any) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime())
      .slice(0, 5)

    // Viáticos
    const { data: viatics } = await supabase
      .from('viaticos')
      .select('*')
      .eq('company_id', company_id)
      .neq('status', 'rejected')

    const active_viatics = (viatics || []).filter((v: any) => v.status === 'pending')
    const total_viatics = viatics?.length || 0
    const pending_viatics_amount = (active_viatics || []).reduce((sum: number, v: any) => sum + v.amount, 0)

    // Aprobaciones pendientes
    const pending_approvals = (expensesMonth || [])
      .filter((e: any) => e.status === 'submitted')
      .sort((a: any, b: any) => new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime())
    const pending_approvals_count = pending_approvals.length
    const pending_approvals_amount = pending_approvals.reduce((sum: number, e: any) => sum + e.total, 0)

    // Alertas
    const alerts: any[] = []
    if (pending_approvals_count > 5) {
      alerts.push({
        id: crypto.randomUUID(),
        severity: 'warning',
        title: `${pending_approvals_count} gastos pendientes de aprobación`,
        message: `$${pending_approvals_amount.toFixed(0)} en espera de revisión`,
      })
    }

    // Recomendaciones
    const recommendations: string[] = []
    if (pending_approvals_count > 0) recommendations.push(`Aprueba ${pending_approvals_count} gastos pendientes`)
    if (pending_viatics_amount > 0) recommendations.push(`Sigue viáticos de $${pending_viatics_amount.toFixed(0)}`)

    return NextResponse.json({
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
    })
  } catch (error: any) {
    console.error('[gastocheck/dashboard GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
