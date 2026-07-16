/**
 * CobraCheck — Tipos COMPLETOS (OTA 171+)
 * Recepción de cobranzas, comisiones, rutas de cobradores
 */

// ============================================================================
// ENUMS Y TIPOS PRIMITIVOS
// ============================================================================

export type PaymentMethod = 'cash' | 'transfer' | 'cheque' | 'card' | 'app'

export type CollectionStatus =
  | 'pending'       // Registrada, sin depositar
  | 'registered'    // Cobrada, registrada en sistema
  | 'deposited'     // Depositada en banco
  | 'reconciled'    // Reconciliada con extracto
  | 'disputed'      // Disputada (cliente reclama)

export type CommissionStatus =
  | 'pending'       // Calculada, esperando aprobación
  | 'approved'      // Aprobada por contador
  | 'paid'          // Pagada al cobrador
  | 'disputed'      // Disputada

// ============================================================================
// COLLECTION (Cobranza individual)
// ============================================================================

export interface CobraCollection {
  id: string
  company_id: string

  // Cliente que pagó
  client_id: string | null
  client_name: string

  // Dinero recibido
  amount_received: number
  payment_method: PaymentMethod
  payment_reference: string | null
  received_date: string // YYYY-MM-DD
  received_time: string | null // HH:MM:SS

  // Vinculación automática
  linked_invoice_id: string | null
  linked_bank_transaction_id: string | null

  // Cobrador
  collector_id: string
  collector_name: string | null

  // Estado
  status: CollectionStatus

  // Comisión
  commission_percentage: number | null
  commission_amount: number | null
  commission_status: CommissionStatus

  created_at: string
  updated_at: string
}

// ============================================================================
// COMMISSION (Comisión a cobrador, por período)
// ============================================================================

export interface CobraCommission {
  id: string
  company_id: string

  // Cobrador
  collector_id: string

  // Período
  period_month: number
  period_year: number

  // Cálculo
  total_collections: number
  commission_rate: number // % (ej: 5.00 = 5%)
  commission_amount: number

  // Estado
  status: CommissionStatus
  approved_by: string | null
  approved_at: string | null
  paid_at: string | null

  // Pago
  paid_via_bank_transaction_id: string | null

  created_at: string
  updated_at: string
}

// ============================================================================
// ROUTE (Ruta de cobranza)
// ============================================================================

export interface CobraRoute {
  id: string
  company_id: string

  name: string
  collector_id: string

  // Clientes en la ruta
  client_ids: string[]

  // Estado
  status: 'active' | 'inactive' | 'paused'

  created_at: string
  updated_at: string
}

// ============================================================================
// DASHBOARD
// ============================================================================

export interface CobraCheckDashboard {
  // Hoy
  collections_today: number
  amount_collected_today: number

  // Mes
  collections_month: number
  amount_collected_month: number
  target_amount: number
  target_percentage: number // % del target alcanzado

  // Cobradores
  collectors_count: number
  pending_commissions: number
  pending_commission_amount: number

  // Últimas cobranzas
  recent_collections: CobraCollection[]

  // Por cobrar
  pending_invoices_count: number
  pending_invoices_amount: number
}

export interface CollectorPerformance {
  collector_id: string
  collector_name: string
  collections_count: number
  amount_collected: number
  target_amount: number
  commission_percentage: number
  commission_earned: number
  pending_commission: number
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface RegisterCollectionRequest {
  client_id: string | null
  client_name: string
  amount_received: number
  payment_method: PaymentMethod
  payment_reference?: string
  received_date: string
  received_time?: string
  collector_id: string
  linked_invoice_id?: string
}

export interface ApproveCommissionRequest {
  commission_id: string
  action: 'approve' | 'reject' | 'dispute'
  notes?: string
  user_id: string
}

export interface PayCommissionRequest {
  commission_id: string
  payment_method: PaymentMethod
  payment_reference: string
  bank_transaction_id?: string
  user_id: string
}

// ============================================================================
// FILTERS
// ============================================================================

export interface CollectionFilter {
  company_id: string
  collector_id?: string
  status?: CollectionStatus
  date_from?: string
  date_to?: string
  client_id?: string
  amount_min?: number
  amount_max?: number
  limit?: number
  offset?: number
}

export interface CommissionFilter {
  company_id: string
  collector_id?: string
  status?: CommissionStatus
  period_month?: number
  period_year?: number
  limit?: number
  offset?: number
}
