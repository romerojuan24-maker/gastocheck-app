/**
 * FlujoCheck — Lógica de Negocio COMPLETA
 * - Agregación de datos de todos los módulos
 * - Cálculos de flujo y proyecciones
 * - Generación de alertas
 * - Health metrics
 */

import { supabase } from './supabase'
import type {
  FlujoCheckDashboard,
  BankAccountSummary,
  CollectionInHand,
  Commitment,
  PendingCollection,
  CashPosition,
  FlowForecast,
  FlowAlert,
  HealthMetrics,
} from '@gastocheck/shared'

/**
 * ============================================================================
 * 1. LEER SALDOS BANCARIOS (De BancoCheck)
 * ============================================================================
 */

async function getBankAccountsSummary(company_id: string): Promise<BankAccountSummary[]> {
  const { data: accounts, error } = await supabase
    .from('bank_accounts')
    .select('id, name, bank_name, currency, current_balance')
    .eq('company_id', company_id)
    .eq('is_active', true)

  if (error) throw error

  if (!accounts || accounts.length === 0) return []

  const total_balance = accounts.reduce((sum, a) => sum + (a.current_balance || 0), 0)

  // Para cada cuenta, obtener movimientos de hoy
  const summaries = await Promise.all(
    accounts.map(async (account) => {
      const today = new Date().toISOString().split('T')[0]

      const { data: todayMovements } = await supabase
        .from('bank_transactions')
        .select('amount')
        .eq('bank_account_id', account.id)
        .eq('date', today)
        .neq('status', 'rejected')

      const inflows_today = (todayMovements || [])
        .filter((m) => m.amount > 0)
        .reduce((sum, m) => sum + m.amount, 0)

      const outflows_today = (todayMovements || [])
        .filter((m) => m.amount < 0)
        .reduce((sum, m) => sum + Math.abs(m.amount), 0)

      // Mes
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
        .filter((m) => m.amount > 0)
        .reduce((sum, m) => sum + m.amount, 0)

      const outflows_month = (monthMovements || [])
        .filter((m) => m.amount < 0)
        .reduce((sum, m) => sum + Math.abs(m.amount), 0)

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
      } as BankAccountSummary
    }),
  )

  return summaries
}

/**
 * ============================================================================
 * 2. LEER COBRANZAS EN MANO (De CobraCheck)
 * ============================================================================
 */

async function getCollectionsInHand(company_id: string): Promise<CollectionInHand[]> {
  const { data: collections, error } = await supabase
    .from('cobra_collections')
    .select('id, client_name, amount_received, payment_method, received_date, collector_name')
    .eq('company_id', company_id)
    .eq('status', 'registered') // No depositadas aún
    .order('received_date', { ascending: false })

  if (error) throw error

  const today = new Date()

  return (collections || []).map((c) => {
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
    } as CollectionInHand
  })
}

/**
 * ============================================================================
 * 3. LEER COMPROMISOS DE PAGO (De GastoCheck + NomiCheck + BancoCheck)
 * ============================================================================
 */

async function getUpcomingCommitments(company_id: string): Promise<Commitment[]> {
  const commitments: Commitment[] = []

  // A. Pagos a proveedores (GastoCheck)
  const { data: payables } = await supabase
    .from('company_payable')
    .select('id, supplier_id, amount_due, due_date')
    .eq('company_id', company_id)
    .eq('status', 'unpaid')

  if (payables) {
    const commitmentPayables = await Promise.all(
      payables.map(async (p) => {
        const { data: supplier } = await supabase
          .from('suppliers')
          .select('name')
          .eq('id', p.supplier_id)
          .single()

        const today = new Date()
        const due = new Date(p.due_date)
        const days_until_due = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        return {
          id: p.id,
          type: 'supplier_payment' as const,
          entity_name: supplier?.name || 'Proveedor',
          amount: p.amount_due,
          due_date: p.due_date,
          days_until_due,
          severity: days_until_due < 0 ? ('critical' as const) : days_until_due < 7 ? ('warning' as const) : ('info' as const),
          priority: 'medium' as const,
          status: days_until_due < 0 ? ('overdue' as const) : 'pending' as const,
        } as Commitment
      }),
    )
    commitments.push(...commitmentPayables)
  }

  // B. Nómina (NomiCheck)
  const { data: payrolls } = await supabase
    .from('nomi_payroll')
    .select('id, net_amount, payroll_date')
    .eq('company_id', company_id)
    .eq('status', 'approved')
    .is('paid_at', null)

  if (payrolls) {
    const today = new Date()
    const commitmentPayrolls = payrolls.map((p) => {
      const due = new Date(p.payroll_date)
      const days_until_due = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      return {
        id: p.id,
        type: 'payroll' as const,
        entity_name: 'Nómina',
        amount: p.net_amount,
        due_date: p.payroll_date,
        days_until_due,
        severity: days_until_due < 0 ? ('critical' as const) : days_until_due < 7 ? ('warning' as const) : ('info' as const),
        priority: 'critical' as const, // Alta prioridad
        status: days_until_due < 0 ? ('overdue' as const) : 'approved' as const,
      } as Commitment
    })
    commitments.push(...commitmentPayrolls)
  }

  // C. Impuestos
  const { data: taxes } = await supabase
    .from('tax_obligations')
    .select('id, amount, due_date')
    .eq('company_id', company_id)
    .eq('status', 'unpaid')

  if (taxes) {
    const today = new Date()
    const commitmentTaxes = taxes.map((t) => {
      const due = new Date(t.due_date)
      const days_until_due = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      return {
        id: t.id,
        type: 'tax' as const,
        entity_name: 'Impuestos',
        amount: t.amount,
        due_date: t.due_date,
        days_until_due,
        severity: 'critical' as const,
        priority: 'critical' as const,
        status: days_until_due < 0 ? ('overdue' as const) : 'pending' as const,
      } as Commitment
    })
    commitments.push(...commitmentTaxes)
  }

  // D. Comisiones de cobradores (CobraCheck)
  const { data: commissions } = await supabase
    .from('cobra_commissions')
    .select('id, collector_id, commission_amount')
    .eq('company_id', company_id)
    .eq('status', 'approved')
    .is('paid_at', null)

  if (commissions) {
    const today = new Date()
    const next5Days = new Date(today)
    next5Days.setDate(next5Days.getDate() + 5)

    const commitmentCommissions = await Promise.all(
      commissions.map(async (c) => {
        const { data: employee } = await supabase
          .from('nomi_employees')
          .select('name')
          .eq('id', c.collector_id)
          .single()

        return {
          id: c.id,
          type: 'commission' as const,
          entity_name: `Comisión: ${employee?.name || 'Cobrador'}`,
          amount: c.commission_amount,
          due_date: next5Days.toISOString().split('T')[0],
          days_until_due: 5,
          severity: 'info' as const,
          priority: 'medium' as const,
          status: 'pending' as const,
        } as Commitment
      }),
    )
    commitments.push(...commitmentCommissions)
  }

  return commitments.sort((a, b) => a.days_until_due - b.days_until_due)
}

/**
 * ============================================================================
 * 4. LEER COBRANZAS EN RIESGO (De GastoCheck)
 * ============================================================================
 */

async function getPendingCollections(company_id: string): Promise<PendingCollection[]> {
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, client_id, amount_due, due_date')
    .eq('company_id', company_id)
    .eq('status', 'unpaid')

  if (error) throw error

  const today = new Date()

  const withClients = await Promise.all(
    (invoices || []).map(async (inv) => {
      const { data: client } = await supabase
        .from('clients')
        .select('name')
        .eq('id', inv.client_id)
        .single()

      const due = new Date(inv.due_date)
      const days_overdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))

      let status: 'overdue' | 'today' | 'upcoming'
      let severity: 'critical' | 'warning' | 'info'

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
      } as PendingCollection
    }),
  )

  return withClients.sort((a, b) => a.due_date.localeCompare(b.due_date))
}

/**
 * ============================================================================
 * 5. CALCULAR POSICIÓN DE FLUJO
 * ============================================================================
 */

function calculateCashPosition(
  bankAccounts: BankAccountSummary[],
  collectionsInHand: CollectionInHand[],
  upcomingCommitments: Commitment[],
  pendingCollections: PendingCollection[],
): CashPosition {
  const bank_balance = bankAccounts.reduce((sum, a) => sum + a.current_balance, 0)
  const cash_in_hand = collectionsInHand.reduce((sum, c) => sum + c.amount, 0)
  const available_today = bank_balance + cash_in_hand

  // Proyecciones simples (para después, hacer más complejas)
  const today = new Date()

  const projected_7d = calculateProjection(
    available_today,
    upcomingCommitments,
    pendingCollections,
    7,
    0.7, // Cobro pesimista: 70%
  )

  const projected_30d = calculateProjection(
    available_today,
    upcomingCommitments,
    pendingCollections,
    30,
    0.8, // Cobro realista: 80%
  )

  const projected_60d = calculateProjection(
    available_today,
    upcomingCommitments,
    pendingCollections,
    60,
    0.9, // Cobro optimista: 90%
  )

  return {
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
}

function calculateProjection(
  available: number,
  commitments: Commitment[],
  pendingCollections: PendingCollection[],
  days: number,
  collectionRate: number,
): number {
  // Proyectar outflows (compromisos dentro del horizonte)
  const outflows = commitments
    .filter((c) => c.days_until_due <= days)
    .reduce((sum, c) => sum + c.amount, 0)

  // Proyectar inflows (cobranzas pendientes dentro del horizonte)
  const inflows = pendingCollections
    .filter((p) => Math.ceil((new Date(p.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= days)
    .reduce((sum, p) => sum + p.amount * collectionRate, 0)

  return available + inflows - outflows
}

/**
 * ============================================================================
 * 6. GENERAR ALERTAS
 * ============================================================================
 */

function generateAlerts(
  cashPosition: CashPosition,
  upcomingCommitments: Commitment[],
  pendingCollections: PendingCollection[],
  collectionsInHand: CollectionInHand[],
): FlowAlert[] {
  const alerts: FlowAlert[] = []
  const alertId = () => crypto.randomUUID()

  // A. Alerta: Disponible bajo
  if (cashPosition.available_today < 50000) {
    alerts.push({
      id: alertId(),
      type: 'shortage',
      severity: 'critical',
      title: 'Flujo muy bajo',
      message: `Disponible: $${cashPosition.available_today.toFixed(0)}. Riesgo de déficit.`,
      action_label: 'Ver detalles',
    })
  } else if (cashPosition.available_today < 150000) {
    alerts.push({
      id: alertId(),
      type: 'shortage',
      severity: 'warning',
      title: 'Flujo ajustado',
      message: `Disponible: $${cashPosition.available_today.toFixed(0)}. Monitorear gastos.`,
    })
  }

  // B. Alerta: Nómina próxima
  const payrollCommitments = upcomingCommitments.filter((c) => c.type === 'payroll' && c.days_until_due <= 7)
  if (payrollCommitments.length > 0) {
    const payroll = payrollCommitments[0]
    if (payroll.days_until_due < 0) {
      alerts.push({
        id: alertId(),
        type: 'overdue',
        severity: 'critical',
        title: 'Nómina VENCIDA',
        message: `Nómina de $${payroll.amount.toFixed(0)} vencida hace ${Math.abs(payroll.days_until_due)} días.`,
      })
    } else if (payroll.days_until_due === 0) {
      alerts.push({
        id: alertId(),
        type: 'overdue',
        severity: 'critical',
        title: 'Nómina HOY',
        message: `Nómina de $${payroll.amount.toFixed(0)} vence hoy. Disponible: $${cashPosition.available_today.toFixed(0)}.`,
      })
    } else {
      alerts.push({
        id: alertId(),
        type: 'risk',
        severity: 'warning',
        title: `Nómina en ${payroll.days_until_due} días`,
        message: `$${payroll.amount.toFixed(0)} a pagar. Disponible: $${cashPosition.available_today.toFixed(0)}.`,
      })
    }
  }

  // C. Alerta: Cobranzas en riesgo
  const overdueCollections = pendingCollections.filter((p) => p.status === 'overdue')
  if (overdueCollections.length > 0) {
    const totalAtRisk = overdueCollections.reduce((sum, p) => sum + p.amount, 0)
    alerts.push({
      id: alertId(),
      type: 'risk',
      severity: 'warning',
      title: `${overdueCollections.length} facturas vencidas`,
      message: `Total en riesgo: $${totalAtRisk.toFixed(0)}. Contacta clientes.`,
    })
  }

  // D. Alerta: Cobranzas en mano (cash no depositado)
  if (collectionsInHand.length > 0) {
    const totalInHand = collectionsInHand.reduce((sum, c) => sum + c.amount, 0)
    const oldestDays = Math.max(...collectionsInHand.map((c) => c.days_in_hand))
    if (oldestDays > 3) {
      alerts.push({
        id: alertId(),
        type: 'risk',
        severity: 'warning',
        title: 'Cobranzas sin depositar',
        message: `$${totalInHand.toFixed(0)} en caja hace ${oldestDays} días. Deposita pronto.`,
      })
    }
  }

  // E. Alerta: Proyección positiva
  if (cashPosition.projected_30d > cashPosition.available_today * 1.2) {
    alerts.push({
      id: alertId(),
      type: 'positive',
      severity: 'info',
      title: 'Flujo positivo',
      message: `Proyección 30d: $${cashPosition.projected_30d.toFixed(0)}. Mejora esperada.`,
    })
  }

  return alerts
}

/**
 * ============================================================================
 * 7. DASHBOARD COMPLETO
 * ============================================================================
 */

export async function loadFlujoCheckDashboard(company_id: string): Promise<FlujoCheckDashboard> {
  const bankAccounts = await getBankAccountsSummary(company_id)
  const collectionsInHand = await getCollectionsInHand(company_id)
  const upcomingCommitments = await getUpcomingCommitments(company_id)
  const pendingCollections = await getPendingCollections(company_id)

  const total_balance = bankAccounts.reduce((sum, a) => sum + a.current_balance, 0)
  const total_cash_in_hand = collectionsInHand.reduce((sum, c) => sum + c.amount, 0)
  const oldest_collection_days = collectionsInHand.length > 0 ? Math.max(...collectionsInHand.map((c) => c.days_in_hand)) : 0

  const total_commitments_7d = upcomingCommitments
    .filter((c) => c.days_until_due <= 7)
    .reduce((sum, c) => sum + c.amount, 0)

  const total_commitments_30d = upcomingCommitments
    .filter((c) => c.days_until_due <= 30)
    .reduce((sum, c) => sum + c.amount, 0)

  const total_at_risk = pendingCollections.reduce((sum, p) => sum + p.amount, 0)
  const overdue_count = pendingCollections.filter((p) => p.status === 'overdue').length

  const cashPosition = calculateCashPosition(bankAccounts, collectionsInHand, upcomingCommitments, pendingCollections)

  const alerts = generateAlerts(cashPosition, upcomingCommitments, pendingCollections, collectionsInHand)

  // Forecasts (proyecciones)
  const forecasts: FlowForecast[] = [
    {
      scenario: 'realistic',
      description: 'Proyección realista (80% cobro)',
      assumptions: ['Cobro del 80% de facturas', 'Pagos según cronograma', 'Sin eventos extraordinarios'],
      points: generateForecastPoints(cashPosition.available_today, upcomingCommitments, pendingCollections, 'realistic'),
    },
    {
      scenario: 'pessimistic',
      description: 'Proyección pesimista (50% cobro)',
      assumptions: ['Cobro del 50% de facturas', 'Todos los pagos se adelantan', 'Mayor riesgo de déficit'],
      points: generateForecastPoints(cashPosition.available_today, upcomingCommitments, pendingCollections, 'pessimistic'),
    },
    {
      scenario: 'optimistic',
      description: 'Proyección optimista (90% cobro)',
      assumptions: ['Cobro del 90% de facturas', 'Pagos se retrasan 5 días', 'Entrada de inversión'],
      points: generateForecastPoints(cashPosition.available_today, upcomingCommitments, pendingCollections, 'optimistic'),
    },
  ]

  // Recomendaciones
  const recommendations: string[] = []
  if (overdue_count > 0) recommendations.push(`Contacta ${overdue_count} clientes con facturas vencidas`)
  if (collectionsInHand.length > 0) recommendations.push(`Deposita $${total_cash_in_hand.toFixed(0)} en caja`)
  if (total_balance < 100000) recommendations.push('Considera línea de crédito por disponible bajo')
  if (cashPosition.projected_30d < total_balance * 0.5) recommendations.push('Riesgo de déficit a 30 días')

  return {
    cash_position: cashPosition,
    bank_accounts: bankAccounts,
    total_balance,
    account_count: bankAccounts.length,
    collections_in_hand: collectionsInHand,
    total_cash_in_hand,
    oldest_collection_days,
    upcoming_commitments: upcomingCommitments.slice(0, 10), // Top 10
    total_commitments_7d,
    total_commitments_30d,
    pending_collections: pendingCollections.slice(0, 10), // Top 10
    total_at_risk,
    overdue_count,
    forecasts,
    alerts,
    recommendations,
  }
}

/**
 * ============================================================================
 * HELPER: Generar puntos para gráfico
 * ============================================================================
 */

function generateForecastPoints(
  available: number,
  commitments: Commitment[],
  pendingCollections: PendingCollection[],
  scenario: 'realistic' | 'pessimistic' | 'optimistic',
): FlowForecast['points'] {
  const points = []
  const collectionRates = {
    realistic: 0.8,
    pessimistic: 0.5,
    optimistic: 0.9,
  }
  const collectionRate = collectionRates[scenario]

  for (let day = 0; day <= 60; day += 7) {
    const outflows = commitments
      .filter((c) => c.days_until_due <= day)
      .reduce((sum, c) => sum + c.amount, 0)

    const inflows = pendingCollections
      .filter((p) => Math.ceil((new Date(p.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= day)
      .reduce((sum, p) => sum + p.amount * collectionRate, 0)

    const balance = available + inflows - outflows
    const dateStr = new Date(new Date().getTime() + day * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    points.push({
      date: dateStr,
      days_from_now: day,
      balance,
      inflows,
      outflows,
    })
  }

  return points
}
