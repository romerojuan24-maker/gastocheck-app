/**
 * FlujoCheck — Tipos COMPLETOS (Dashboard Integrado)
 * Lee: BancoCheck + CobraCheck + GastoCheck + NomiCheck + InventarioCheck
 * Calcula: flujo real + proyecciones 30/60/90 días + alertas
 */

// ============================================================================
// ENUMS
// ============================================================================

export type AlertSeverity = 'critical' | 'warning' | 'info'
export type ScenarioType = 'pessimistic' | 'realistic' | 'optimistic'
export type CommitmentType = 'payroll' | 'supplier_payment' | 'tax' | 'commission' | 'other'

// ============================================================================
// BANK ACCOUNT SUMMARY (Saldo de cada cuenta)
// ============================================================================

export interface BankAccountSummary {
  id: string
  name: string
  bank_name: string | null
  currency: string
  current_balance: number
  percentage_of_total: number
  inflows_today: number
  outflows_today: number
  inflows_month: number
  outflows_month: number
}

// ============================================================================
// COLLECTION IN HAND (Cobranza registrada, no depositada)
// ============================================================================

export interface CollectionInHand {
  id: string
  client_name: string
  amount: number
  payment_method: string
  received_date: string
  collector_name: string | null
  days_in_hand: number
}

// ============================================================================
// COMMITMENT (Pago que debe salir)
// ============================================================================

export interface Commitment {
  id: string
  type: CommitmentType
  entity_name: string
  amount: number
  due_date: string
  days_until_due: number
  severity: AlertSeverity
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'pending' | 'approved' | 'overdue'
}

// ============================================================================
// PENDING COLLECTION (Factura no cobrada)
// ============================================================================

export interface PendingCollection {
  id: string
  client_name: string
  amount: number
  due_date: string
  days_overdue: number
  severity: AlertSeverity
  status: 'overdue' | 'today' | 'upcoming'
}

// ============================================================================
// CASH POSITION (Posición consolidada)
// ============================================================================

export interface CashPosition {
  // Hoy
  bank_balance: number
  cash_in_hand: number
  available_today: number

  // 7/30/60 días
  projected_7d: number
  projected_30d: number
  projected_60d: number

  // Escenarios
  scenarios: {
    [key in ScenarioType]: {
      day_7: number
      day_30: number
      day_60: number
    }
  }
}

// ============================================================================
// FORECAST (Proyección detallada)
// ============================================================================

export interface FlowForecast {
  scenario: ScenarioType
  description: string
  assumptions: string[]

  points: Array<{
    date: string
    days_from_now: number
    balance: number
    inflows: number
    outflows: number
  }>
}

// ============================================================================
// ALERT (Alerta de flujo)
// ============================================================================

export interface FlowAlert {
  id: string
  type: 'shortage' | 'overdue' | 'risk' | 'positive'
  severity: AlertSeverity
  title: string
  message: string
  action_url?: string
  action_label?: string
}

// ============================================================================
// DASHBOARD (Lo que renderiza)
// ============================================================================

export interface FlujoCheckDashboard {
  // Resumen
  cash_position: CashPosition

  // Cuentas bancarias
  bank_accounts: BankAccountSummary[]
  total_balance: number
  account_count: number

  // Cobranzas en mano (no depositadas)
  collections_in_hand: CollectionInHand[]
  total_cash_in_hand: number
  oldest_collection_days: number

  // Pagos próximos
  upcoming_commitments: Commitment[]
  total_commitments_7d: number
  total_commitments_30d: number

  // Cobranzas en riesgo
  pending_collections: PendingCollection[]
  total_at_risk: number
  overdue_count: number

  // Proyecciones
  forecasts: FlowForecast[]

  // Alertas
  alerts: FlowAlert[]

  // Recomendaciones
  recommendations: string[]
}

// ============================================================================
// HEALTH METRICS
// ============================================================================

export interface HealthMetrics {
  days_of_runway: number
  collection_efficiency: number
  payment_efficiency: number
  risk_score: number
  health_status: 'critical' | 'warning' | 'healthy'
}

// ============================================================================
// HELPERS
// ============================================================================

export const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: '#E53935', // 🔴
  warning: '#FB8C00',  // 🟠
  info: '#43A047',     // 🟢
}

export const PRIORITY_ORDER: Record<Commitment['priority'], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

// ============================================================================
// CASH FLOW RISK METADATA
// ============================================================================

export const CASH_FLOW_RISK_META: Record<'critical' | 'warning' | 'healthy', { label: string; color: string; icon: string }> = {
  critical: { label: 'Crítico', color: '#E53935', icon: '🔴' },
  warning: { label: 'Advertencia', color: '#FB8C00', icon: '🟠' },
  healthy: { label: 'Saludable', color: '#43A047', icon: '🟢' },
}

// ============================================================================
// CASH FLOW PROJECTION HELPER
// ============================================================================

export function projectCashFlow(
  currentBalance: number,
  items: Array<{ amount: number; expected_date: string }>,
  horizonDays: number = 7,
): { balance: number; risk: 'critical' | 'warning' | 'healthy' } {
  const now = new Date()
  const horizon = new Date(now)
  horizon.setDate(horizon.getDate() + horizonDays)

  let projectedBalance = currentBalance
  for (const item of items) {
    const itemDate = new Date(item.expected_date)
    if (itemDate <= horizon) {
      projectedBalance += item.amount
    }
  }

  let risk: 'critical' | 'warning' | 'healthy'
  if (projectedBalance < 0) {
    risk = 'critical'
  } else if (projectedBalance < currentBalance * 0.2) {
    risk = 'warning'
  } else {
    risk = 'healthy'
  }

  return { balance: projectedBalance, risk }
}
