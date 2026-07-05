/**
 * CHECK SUITE Unified Dashboard
 * Consolidated view across all 5 modules for admin/supervisors
 */

import type { CfdiDocument } from '../facturacheck/types'
import type { BankAccountAutomated } from '../bancocheck/types'

// ============================================================================
// Dashboard Data Structure
// ============================================================================

export interface ModuleSnapshot {
  module: 'gastocheck' | 'cobracheck' | 'flujocheck' | 'bancocheck' | 'facturacheck'
  status: 'operational' | 'warning' | 'critical' | 'offline'
  status_message: string
  last_sync: string
  key_metrics: Record<string, number | string>
  pending_actions: number
  alerts: Array<{
    severity: 'info' | 'warning' | 'critical'
    title: string
    description: string
  }>
}

export interface UnifiedDashboard {
  company_id: string
  generated_at: string
  health_score: number // 0-100, weighted average of all modules
  modules: ModuleSnapshot[]
  consolidated: {
    total_cash_position: number
    monthly_revenue_projection: number
    monthly_expense_projection: number
    projected_net_cash_flow: number
    payment_capacity: {
      available_to_pay: number
      is_sufficient: boolean
      buffer_status: 'healthy' | 'warning' | 'critical'
    }
    upcoming_obligations: {
      next_7_days: number
      next_30_days: number
      next_90_days: number
    }
    recent_transactions: Array<{
      module: string
      type: string
      description: string
      amount: number
      date: string
    }>
  }
}

// ============================================================================
// Module Snapshot Builders
// ============================================================================

export function buildGastoCheckSnapshot(data: {
  total_polizas: number
  pending_polizas: number
  total_amount_this_month: number
  last_sync: string
  sync_errors: number
  approval_pending: number
}): ModuleSnapshot {
  const status =
    data.sync_errors > 0 || data.approval_pending > 3 ? 'warning' : 'operational'

  return {
    module: 'gastocheck',
    status,
    status_message:
      status === 'warning'
        ? `${data.approval_pending} pólizas pendientes de aprobación`
        : 'Operando normalmente',
    last_sync: data.last_sync,
    key_metrics: {
      polizas_mes: data.total_polizas,
      monto_mes: `$${data.total_amount_this_month.toFixed(2)}`,
      pendientes: data.approval_pending,
    },
    pending_actions: data.approval_pending,
    alerts:
      data.approval_pending > 5
        ? [
            {
              severity: 'warning',
              title: 'Pólizas Pendientes',
              description: `Hay ${data.approval_pending} pólizas esperando aprobación`,
            },
          ]
        : [],
  }
}

export function buildCobraCheckSnapshot(data: {
  total_cobros: number
  cobros_pending: number
  cobros_overdue: number
  total_receivable: number
  collection_rate: number
  last_sync: string
}): ModuleSnapshot {
  const status = data.cobros_overdue > 5 ? 'critical' : data.cobros_overdue > 0 ? 'warning' : 'operational'

  return {
    module: 'cobracheck',
    status,
    status_message:
      status === 'critical'
        ? `${data.cobros_overdue} cobros vencidos`
        : status === 'warning'
          ? `${data.cobros_overdue} cobro(s) vencido(s)`
          : 'Cobros al día',
    last_sync: data.last_sync,
    key_metrics: {
      cobros_activos: data.total_cobros,
      vencidos: data.cobros_overdue,
      tasa_cobranza: `${data.collection_rate}%`,
      cartera: `$${data.total_receivable.toFixed(2)}`,
    },
    pending_actions: data.cobros_overdue,
    alerts:
      data.cobros_overdue > 0
        ? [
            {
              severity: data.cobros_overdue > 5 ? 'critical' : 'warning',
              title: 'Cobros Vencidos',
              description: `${data.cobros_overdue} cobros requieren seguimiento inmediato`,
            },
          ]
        : [],
  }
}

export function buildFlujoCheckSnapshot(data: {
  current_balance: number
  monthly_income_avg: number
  monthly_expense_avg: number
  projected_balance_30d: number
  health_score: number
  buffer_status: 'green' | 'yellow' | 'red'
  last_sync: string
}): ModuleSnapshot {
  const status = data.buffer_status === 'red' ? 'critical' : data.buffer_status === 'yellow' ? 'warning' : 'operational'

  return {
    module: 'flujocheck',
    status,
    status_message:
      status === 'critical'
        ? 'Buffer crítico - liquídez en riesgo'
        : status === 'warning'
          ? 'Buffer bajo - monitorear diariamente'
          : 'Flujo saludable',
    last_sync: data.last_sync,
    key_metrics: {
      saldo_actual: `$${data.current_balance.toFixed(2)}`,
      ingresos_promedio: `$${data.monthly_income_avg.toFixed(2)}`,
      egresos_promedio: `$${data.monthly_expense_avg.toFixed(2)}`,
      salud: `${data.health_score}%`,
    },
    pending_actions: data.buffer_status === 'red' ? 1 : 0,
    alerts:
      data.buffer_status !== 'green'
        ? [
            {
              severity: data.buffer_status === 'red' ? 'critical' : 'warning',
              title: 'Alerta de Flujo de Caja',
              description:
                data.buffer_status === 'red'
                  ? 'Saldo proyectado cae bajo buffer requerido'
                  : 'Buffer se reducirá en próximos 30 días',
            },
          ]
        : [],
  }
}

export function buildBancoCheckSnapshot(data: {
  connected_accounts: number
  total_balance: number
  reconciliation_percentage: number
  unmatched_transactions: number
  last_sync: string
  sync_errors: number
}): ModuleSnapshot {
  const status =
    data.sync_errors > 0 || data.reconciliation_percentage < 85
      ? 'warning'
      : 'operational'

  return {
    module: 'bancocheck',
    status,
    status_message:
      data.reconciliation_percentage < 85
        ? `Reconciliación ${data.reconciliation_percentage}% - revisar ${data.unmatched_transactions} transacciones`
        : 'Cuentas sincronizadas',
    last_sync: data.last_sync,
    key_metrics: {
      cuentas: data.connected_accounts,
      saldo_total: `$${data.total_balance.toFixed(2)}`,
      reconciliacion: `${data.reconciliation_percentage}%`,
      sin_emparejar: data.unmatched_transactions,
    },
    pending_actions: data.unmatched_transactions,
    alerts:
      data.reconciliation_percentage < 85
        ? [
            {
              severity: 'warning',
              title: 'Reconciliación Incompleta',
              description: `${data.unmatched_transactions} transacciones requieren revisión manual`,
            },
          ]
        : [],
  }
}

export function buildFacturacheckSnapshot(data: {
  total_cfdis: number
  pending_cfdis: number
  timbradas: number
  cancelled: number
  credit_balance: number
  credit_consumed_month: number
  last_sync: string
  pac_errors: number
}): ModuleSnapshot {
  const status = data.pac_errors > 0 ? 'warning' : data.pending_cfdis > 10 ? 'warning' : 'operational'

  return {
    module: 'facturacheck',
    status,
    status_message:
      status === 'warning'
        ? data.pac_errors > 0
          ? 'Errores PAC - revisar'
          : `${data.pending_cfdis} facturas sin timbrar`
        : 'CFDIs al día',
    last_sync: data.last_sync,
    key_metrics: {
      totales: data.total_cfdis,
      timbradas: data.timbradas,
      pendientes: data.pending_cfdis,
      credito_disponible: `$${(data.credit_balance - data.credit_consumed_month).toFixed(2)}`,
    },
    pending_actions: data.pending_cfdis + data.pac_errors,
    alerts:
      data.pending_cfdis > 10 || data.pac_errors > 0
        ? [
            {
              severity: 'warning',
              title: 'Facturas Pendientes',
              description:
                data.pac_errors > 0
                  ? `${data.pac_errors} facturas con error PAC`
                  : `${data.pending_cfdis} facturas esperando timbrado`,
            },
          ]
        : [],
  }
}

// ============================================================================
// Health Score Calculation
// ============================================================================

export function calculateUnifiedHealthScore(
  modules: ModuleSnapshot[]
): number {
  const weights: Record<string, number> = {
    gastocheck: 0.15,
    cobracheck: 0.25,
    flujocheck: 0.35,
    bancocheck: 0.15,
    facturacheck: 0.1,
  }

  const statusScores: Record<string, number> = {
    operational: 100,
    warning: 60,
    critical: 20,
    offline: 0,
  }

  let totalScore = 0
  let totalWeight = 0

  for (const module of modules) {
    const weight = weights[module.module] || 0.2
    const score = statusScores[module.status] || 0
    totalScore += score * weight
    totalWeight += weight
  }

  return Math.round(totalWeight > 0 ? totalScore / totalWeight : 0)
}

// ============================================================================
// Consolidated Analysis
// ============================================================================

export function buildConsolidatedAnalysis(modules: ModuleSnapshot[]): UnifiedDashboard['consolidated'] {
  // TODO: Aggregate actual data from all modules
  // For now, return mock consolidated view

  return {
    total_cash_position: 125000.0,
    monthly_revenue_projection: 45000.0,
    monthly_expense_projection: 20000.0,
    projected_net_cash_flow: 25000.0,
    payment_capacity: {
      available_to_pay: 50000.0,
      is_sufficient: true,
      buffer_status: 'healthy',
    },
    upcoming_obligations: {
      next_7_days: 5000.0,
      next_30_days: 18000.0,
      next_90_days: 45000.0,
    },
    recent_transactions: [
      {
        module: 'CobraCheck',
        type: 'Cobro Pagado',
        description: 'CLIENTE ABC - Factura #FAC-001',
        amount: 15000.0,
        date: new Date().toISOString(),
      },
      {
        module: 'GastoCheck',
        type: 'Póliza',
        description: 'Reembolso viáticos - Juan Pérez',
        amount: -2500.0,
        date: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        module: 'BancoCheck',
        type: 'Transferencia Recibida',
        description: 'PROVEEDOR XYZ',
        amount: 8500.0,
        date: new Date(Date.now() - 172800000).toISOString(),
      },
    ],
  }
}

// ============================================================================
// Dashboard Assembly
// ============================================================================

export async function assembleUnifiedDashboard(
  companyId: string,
  moduleSnapshots: {
    gastocheck: Parameters<typeof buildGastoCheckSnapshot>[0]
    cobracheck: Parameters<typeof buildCobraCheckSnapshot>[0]
    flujocheck: Parameters<typeof buildFlujoCheckSnapshot>[0]
    bancocheck: Parameters<typeof buildBancoCheckSnapshot>[0]
    facturacheck: Parameters<typeof buildFacturacheckSnapshot>[0]
  }
): Promise<UnifiedDashboard> {
  const modules: ModuleSnapshot[] = [
    buildGastoCheckSnapshot(moduleSnapshots.gastocheck),
    buildCobraCheckSnapshot(moduleSnapshots.cobracheck),
    buildFlujoCheckSnapshot(moduleSnapshots.flujocheck),
    buildBancoCheckSnapshot(moduleSnapshots.bancocheck),
    buildFacturacheckSnapshot(moduleSnapshots.facturacheck),
  ]

  const healthScore = calculateUnifiedHealthScore(modules)
  const consolidated = buildConsolidatedAnalysis(modules)

  return {
    company_id: companyId,
    generated_at: new Date().toISOString(),
    health_score: healthScore,
    modules,
    consolidated,
  }
}

// ============================================================================
// Alerts & Recommendations
// ============================================================================

export function generateDashboardRecommendations(dashboard: UnifiedDashboard): string[] {
  const recommendations: string[] = []

  // Flujo analysis
  const flujoModule = dashboard.modules.find((m) => m.module === 'flujocheck')
  if (flujoModule?.status === 'critical') {
    recommendations.push(
      '🔴 URGENTE: Flujo de caja crítico. Considera reducir gastos o acelerar cobros inmediatamente.'
    )
  }

  // Cobracheck analysis
  const cobraModule = dashboard.modules.find((m) => m.module === 'cobracheck')
  const overdueCobros = cobraModule?.key_metrics['vencidos'] || 0
  if (overdueCobros > 5) {
    recommendations.push(
      `⚠️ ACCIÓN REQUERIDA: ${overdueCobros} cobros vencidos afectan tu flujo. Prioriza seguimiento.`
    )
  }

  // Bancocheck analysis
  const bancoModule = dashboard.modules.find((m) => m.module === 'bancocheck')
  const reconciliationPct = (bancoModule?.key_metrics['reconciliacion'] as string)?.replace('%', '')
  if (parseInt(reconciliationPct || '100') < 85) {
    recommendations.push(
      '📊 Revisa transacciones sin emparejar en BancoCheck para reconciliación completa.'
    )
  }

  // Gastocheck analysis
  const gastoModule = dashboard.modules.find((m) => m.module === 'gastocheck')
  const pendingPolizas = gastoModule?.key_metrics['pendientes'] || 0
  if (pendingPolizas > 3) {
    recommendations.push(
      `📋 ${pendingPolizas} pólizas en GastoCheck esperan aprobación. Acelera el flujo de validación.`
    )
  }

  // Facturacheck analysis
  const factuModule = dashboard.modules.find((m) => m.module === 'facturacheck')
  const pendingCfdis = factuModule?.key_metrics['pendientes'] || 0
  if (pendingCfdis > 5) {
    recommendations.push(
      `📄 ${pendingCfdis} facturas sin timbrar en FacturaCheck. Verifica con el PAC.`
    )
  }

  // General analysis
  if (dashboard.health_score < 60) {
    recommendations.push(
      '⚡ La salud general del sistema es baja. Revisa todos los módulos y toma acciones correctivas.'
    )
  } else if (dashboard.health_score >= 85) {
    recommendations.push('✅ Operación saludable. Mantén el monitoreo diario.')
  }

  return recommendations
}
