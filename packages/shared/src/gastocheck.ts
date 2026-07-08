/**
 * GastoCheck — Tipos SIMPLIFICADOS
 * Usa reembolsos + viaticos EXISTENTES en la BD
 * Contador: aprueba reembolsos/viáticos → genera journal_entries
 */

// ============================================================================
// REEMBOLSO (comprador pagó de su bolsillo)
// ============================================================================

export interface Reembolso {
  id: string
  company_id: string
  employee_id: string          // Quién pagó
  employee_email: string | null
  status: 'draft' | 'pending_auth' | 'closed' | 'rejected'  // closed = listo para contador
  total: number
  notes: string
  created_at: string
  updated_at: string
}

export interface Receipt {
  id: string
  company_id: string
  uploaded_by: string
  total_amount: number
  supplier_id: string | null
  receipt_date: string
  status: string
  created_at: string
}

export interface ReceiptReembolso {
  id: string
  reembolso_id: string
  receipt_id: string
  created_at: string
}

// ============================================================================
// VIÁTICO (anticipo para viaje)
// ============================================================================

export interface Viatico {
  id: string
  company_id: string
  person_id: string            // Quién recibe el viático
  created_by: string
  amount: number
  category: string
  trip_date: string
  city: string | null
  status: 'pending' | 'approved' | 'rejected'  // pending = listo para contador
  approved_by: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// LO QUE CONTADOR VE: REEMBOLSOS/VIÁTICOS PENDIENTES
// ============================================================================

export interface ReembolsoPendiente {
  id: string
  employee_email: string
  total: number
  receipts_count: number
  created_at: string
  status: 'pending_auth' | 'closed'
}

export interface ViaticoPendiente {
  id: string
  person_id: string
  person_email: string
  amount: number
  trip_date: string
  city: string | null
  category: string
  created_at: string
  status: 'pending'
}

// ============================================================================
// DASHBOARD CONTADOR: PENDIENTES
// ============================================================================

export interface GastoCheckDashboard {
  reembolsos_pendientes: ReembolsoPendiente[]
  reembolsos_pendientes_count: number
  reembolsos_pendientes_total: number

  viaticos_pendientes: ViaticoPendiente[]
  viaticos_pendientes_count: number
  viaticos_pendientes_total: number

  // Total para contador
  total_pendiente: number
}

export interface GastoCheckAlert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  message: string
}

// ============================================================================
// REQUESTS
// ============================================================================

export interface ApproveReembolsoRequest {
  reembolso_id: string
  user_id: string  // contador que aprueba
}

export interface ApproveViaticRequest {
  viatico_id: string
  user_id: string  // contador que aprueba
}
