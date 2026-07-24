/**
 * FlujoCheck API Routes — COMPLETO
 * GET /api/flujocheck/dashboard — obtener dashboard integrado
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

// ============================================================================
// GET /api/flujocheck/dashboard
// Cargar dashboard completo: bancos, cobranzas, pagos, proyecciones
// ============================================================================

// Roles con visibilidad de tesorería/flujo (el dashboard expone saldos
// bancarios y compromisos de nómina — datos sensibles).
const FLUJO_ROLES = ['owner', 'admin', 'accountant', 'contador_general', 'office']

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const company_id = searchParams.get('company_id')

    if (!company_id) {
      return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })
    }

    // ── Autorización: el route corre con service_role (salta RLS), así que la
    //    autorización DEBE ser explícita. Sin esto, cualquiera podía pedir el
    //    dashboard de OTRA empresa pasando su company_id en el query string.
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })
    }
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })
    }
    const { data: caller } = await supabase
      .from('company_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('company_id', company_id)
      .eq('status', 'active')
      .maybeSingle()
    if (!caller) {
      // No es miembro activo de ESA empresa → no puede ver su tesorería.
      return NextResponse.json({ error: 'Sin acceso a esta empresa' }, { status: 403 })
    }
    if (!FLUJO_ROLES.includes(caller.role)) {
      return NextResponse.json({ error: 'Tu rol no tiene acceso a FlujoCheck' }, { status: 403 })
    }

    // 1. SALDOS BANCARIOS
    const { data: accounts } = await supabase
      .from('bank_accounts')
      .select('id, name, bank_name, currency, current_balance')
      .eq('company_id', company_id)
      .eq('is_active', true)

    const total_balance = (accounts || []).reduce((sum, a) => sum + (a.current_balance || 0), 0)

    const bankAccounts = await Promise.all(
      (accounts || []).map(async (account) => {
        const today = new Date().toISOString().split('T')[0]

        const { data: todayMovements } = await supabase
          .from('bank_transactions')
          .select('amount')
          .eq('bank_account_id', account.id)
          .eq('date', today)
          .neq('status', 'rejected')

        const inflows_today = (todayMovements || [])
          .filter((m: any) => m.amount > 0)
          .reduce((sum: number, m: any) => sum + m.amount, 0)

        const outflows_today = (todayMovements || [])
          .filter((m: any) => m.amount < 0)
          .reduce((sum: number, m: any) => sum + Math.abs(m.amount), 0)

        const monthStart = new Date()
        monthStart.setDate(1)
        const monthStartStr = monthStart.toISOString().split('T')[0]

        const { data: monthMovements } = await supabase
          .from('bank_transactions')
          .select('amount')
          .eq('bank_account_id', account.id)
          .gte('date', monthStartStr)
          .neq('status', 'rejected')

        const inflows_month = (monthMovements || [])
          .filter((m: any) => m.amount > 0)
          .reduce((sum: number, m: any) => sum + m.amount, 0)

        const outflows_month = (monthMovements || [])
          .filter((m: any) => m.amount < 0)
          .reduce((sum: number, m: any) => sum + Math.abs(m.amount), 0)

        return {
          id: account.id,
          name: account.name,
          bank_name: account.bank_name || null,
          currency: account.currency || 'MXN',
          current_balance: account.current_balance || 0,
          percentage_of_total: total_balance > 0 ? (account.current_balance || 0) / total_balance : 0,
          inflows_today,
          outflows_today,
          inflows_month,
          outflows_month,
        }
      }),
    )

    // 2. COBRANZAS EN MANO (No depositadas)
    const { data: collections } = await supabase
      .from('cobra_collections')
      .select('id, client_name, amount_received, payment_method, received_date, collector_name')
      .eq('company_id', company_id)
      .eq('status', 'registered')
      .order('received_date', { ascending: false })

    const today = new Date()
    const collectionsInHand = (collections || []).map((c: any) => {
      const received = new Date(c.received_date)
      const days_in_hand = Math.floor((today.getTime() - received.getTime()) / (1000 * 60 * 60 * 24))

      return {
        id: c.id,
        client_name: c.client_name,
        amount: c.amount_received,
        payment_method: c.payment_method,
        received_date: c.received_date,
        collector_name: c.collector_name,
        days_in_hand,
      }
    })

    const total_cash_in_hand = collectionsInHand.reduce((sum: number, c: any) => sum + c.amount, 0)
    const oldest_collection_days =
      collectionsInHand.length > 0 ? Math.max(...collectionsInHand.map((c: any) => c.days_in_hand)) : 0

    // 3. COMPROMISOS DE PAGO
    const commitments: any[] = []

    // A. Pagos a proveedores
    const { data: payables } = await supabase
      .from('company_payable')
      .select('id, supplier_id, amount_due, due_date')
      .eq('company_id', company_id)
      .eq('status', 'unpaid')

    if (payables) {
      for (const p of payables) {
        const { data: supplier } = await supabase
          .from('suppliers')
          .select('name')
          .eq('id', p.supplier_id)
          .single()

        const due = new Date(p.due_date)
        const days_until_due = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        commitments.push({
          id: p.id,
          type: 'supplier_payment',
          entity_name: supplier?.name || 'Proveedor',
          amount: p.amount_due,
          due_date: p.due_date,
          days_until_due,
          severity: days_until_due < 0 ? 'critical' : days_until_due < 7 ? 'warning' : 'info',
          priority: 'medium',
          status: days_until_due < 0 ? 'overdue' : 'pending',
        })
      }
    }

    // B. Nómina — vía capa estable nomi_cashflow_commitments (la vista ya
    // filtra aprobados + no pagados; desacopla de la estructura de nomi_payroll)
    const { data: payrolls } = await supabase
      .from('nomi_cashflow_commitments')
      .select('id, amount, due_date')
      .eq('company_id', company_id)

    if (payrolls) {
      for (const p of payrolls) {
        const due = new Date(p.due_date)
        const days_until_due = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        commitments.push({
          id: p.id,
          type: 'payroll',
          entity_name: 'Nómina',
          amount: p.amount,
          due_date: p.due_date,
          days_until_due,
          severity: days_until_due < 0 ? 'critical' : days_until_due < 7 ? 'warning' : 'info',
          priority: 'critical',
          status: days_until_due < 0 ? 'overdue' : 'approved',
        })
      }
    }

    // C. Impuestos
    const { data: taxes } = await supabase
      .from('tax_obligations')
      .select('id, amount, due_date')
      .eq('company_id', company_id)
      .eq('status', 'unpaid')

    if (taxes) {
      for (const t of taxes) {
        const due = new Date(t.due_date)
        const days_until_due = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        commitments.push({
          id: t.id,
          type: 'tax',
          entity_name: 'Impuestos',
          amount: t.amount,
          due_date: t.due_date,
          days_until_due,
          severity: 'critical',
          priority: 'critical',
          status: days_until_due < 0 ? 'overdue' : 'pending',
        })
      }
    }

    // D. Comisiones
    const { data: commissionsData } = await supabase
      .from('cobra_commissions')
      .select('id, collector_id, commission_amount')
      .eq('company_id', company_id)
      .eq('status', 'approved')
      .is('paid_at', null)

    if (commissionsData) {
      const next5Days = new Date(today)
      next5Days.setDate(next5Days.getDate() + 5)

      for (const c of commissionsData) {
        // El cobrador es entidad de CobraCheck, no de nómina. Etiqueta genérica.
        commitments.push({
          id: c.id,
          type: 'commission',
          entity_name: 'Comisión de cobrador',
          amount: c.commission_amount,
          due_date: next5Days.toISOString().split('T')[0],
          days_until_due: 5,
          severity: 'info',
          priority: 'medium',
          status: 'pending',
        })
      }
    }

    commitments.sort((a, b) => a.days_until_due - b.days_until_due)

    const total_commitments_7d = commitments
      .filter((c) => c.days_until_due <= 7)
      .reduce((sum, c) => sum + c.amount, 0)

    const total_commitments_30d = commitments
      .filter((c) => c.days_until_due <= 30)
      .reduce((sum, c) => sum + c.amount, 0)

    // 4. COBRANZAS PENDIENTES
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, client_id, amount_due, due_date')
      .eq('company_id', company_id)
      .eq('status', 'unpaid')

    const pendingCollections = await Promise.all(
      (invoices || []).map(async (inv: any) => {
        const { data: client } = await supabase
          .from('clients')
          .select('name')
          .eq('id', inv.client_id)
          .single()

        const due = new Date(inv.due_date)
        const days_overdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))

        let status: string
        let severity: string

        if (days_overdue > 0) {
          status = 'overdue'
          severity = days_overdue > 7 ? 'critical' : 'warning'
        } else if (days_overdue === 0) {
          status = 'today'
          severity = 'warning'
        } else {
          status = 'upcoming'
          severity = 'info'
        }

        return {
          id: inv.id,
          client_name: client?.name || 'Cliente desconocido',
          amount: inv.amount_due,
          due_date: inv.due_date,
          days_overdue: Math.max(0, days_overdue),
          severity,
          status,
        }
      }),
    )

    pendingCollections.sort((a, b) => a.due_date.localeCompare(b.due_date))

    const total_at_risk = pendingCollections.reduce((sum, p) => sum + p.amount, 0)
    const overdue_count = pendingCollections.filter((p) => p.status === 'overdue').length

    // 5. CALCULAR CASH POSITION
    const bank_balance = bankAccounts.reduce((sum, a) => sum + a.current_balance, 0)
    const cash_in_hand = total_cash_in_hand
    const available_today = bank_balance + cash_in_hand

    const projected_7d = calculateProjection(available_today, commitments, pendingCollections, 7, 0.7)
    const projected_30d = calculateProjection(available_today, commitments, pendingCollections, 30, 0.8)
    const projected_60d = calculateProjection(available_today, commitments, pendingCollections, 60, 0.9)

    const cashPosition = {
      bank_balance,
      cash_in_hand,
      available_today,
      projected_7d,
      projected_30d,
      projected_60d,
      scenarios: {
        pessimistic: { day_7: projected_7d * 0.8, day_30: projected_30d * 0.7, day_60: projected_60d * 0.6 },
        realistic: { day_7: projected_7d, day_30: projected_30d, day_60: projected_60d },
        optimistic: { day_7: projected_7d * 1.2, day_30: projected_30d * 1.3, day_60: projected_60d * 1.4 },
      },
    }

    // 6. GENERAR ALERTAS
    const alerts: any[] = []

    if (available_today < 50000) {
      alerts.push({
        id: crypto.randomUUID(),
        type: 'shortage',
        severity: 'critical',
        title: 'Flujo muy bajo',
        message: `Disponible: $${available_today.toFixed(0)}. Riesgo de déficit.`,
      })
    } else if (available_today < 150000) {
      alerts.push({
        id: crypto.randomUUID(),
        type: 'shortage',
        severity: 'warning',
        title: 'Flujo ajustado',
        message: `Disponible: $${available_today.toFixed(0)}. Monitorear gastos.`,
      })
    }

    const payrollCommitments = commitments.filter((c) => c.type === 'payroll' && c.days_until_due <= 7)
    if (payrollCommitments.length > 0) {
      const payroll = payrollCommitments[0]
      if (payroll.days_until_due < 0) {
        alerts.push({
          id: crypto.randomUUID(),
          type: 'overdue',
          severity: 'critical',
          title: 'Nómina VENCIDA',
          message: `Nómina de $${payroll.amount.toFixed(0)} vencida hace ${Math.abs(payroll.days_until_due)} días.`,
        })
      }
    }

    if (overdue_count > 0) {
      alerts.push({
        id: crypto.randomUUID(),
        type: 'risk',
        severity: 'warning',
        title: `${overdue_count} facturas vencidas`,
        message: `Total en riesgo: $${total_at_risk.toFixed(0)}. Contacta clientes.`,
      })
    }

    // 7. RECOMENDACIONES
    const recommendations: string[] = []
    if (overdue_count > 0) recommendations.push(`Contacta ${overdue_count} clientes con facturas vencidas`)
    if (collectionsInHand.length > 0) recommendations.push(`Deposita $${total_cash_in_hand.toFixed(0)} en caja`)
    if (bank_balance < 100000) recommendations.push('Considera línea de crédito por disponible bajo')

    return NextResponse.json({
      cash_position: cashPosition,
      bank_accounts: bankAccounts,
      total_balance,
      account_count: bankAccounts.length,
      collections_in_hand: collectionsInHand,
      total_cash_in_hand,
      oldest_collection_days,
      upcoming_commitments: commitments.slice(0, 10),
      total_commitments_7d,
      total_commitments_30d,
      pending_collections: pendingCollections.slice(0, 10),
      total_at_risk,
      overdue_count,
      alerts,
      recommendations,
    })
  } catch (error: any) {
    console.error('[flujocheck/dashboard GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function calculateProjection(
  available: number,
  commitments: any[],
  pendingCollections: any[],
  days: number,
  collectionRate: number,
): number {
  const outflows = commitments
    .filter((c) => c.days_until_due <= days)
    .reduce((sum, c) => sum + c.amount, 0)

  const inflows = pendingCollections
    .filter((p) => {
      const due = new Date(p.due_date)
      const daysUntilDue = Math.ceil((due.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      return daysUntilDue <= days
    })
    .reduce((sum, p) => sum + p.amount * collectionRate, 0)

  return available + inflows - outflows
}
