// ── Tipos CobraCheck ─────────────────────────────────────────────────────────
// Alineados con supabase/migrations/20260618200001_cobra_check_tables.sql

export interface CobraClient {
  id:                string
  company_id:        string
  name:              string
  rfc?:              string
  email?:            string
  phone?:            string
  contact_name?:     string
  credit_limit?:     number
  current_balance:   number          // campo real en DB es current_balance
  risk_score:        number          // 0-100
  status:            'active' | 'inactive' | 'blacklist'  // DB usa 'blacklist', no 'suspended'
  last_payment_date?: string
  created_at:        string
  updated_at:        string
}

export interface CobraInvoice {
  id:           string
  company_id:   string
  client_id:    string
  folio:        string               // campo real es 'folio', no 'invoice_number'
  uuid_sat?:    string
  amount:       number               // total de la factura
  tax?:         number
  subtotal?:    number
  issue_date:   string
  due_date:     string
  payment_date?: string
  status:       'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled'
  days_overdue: number
  created_at:   string
  updated_at:   string
}

export interface CobraPayment {
  id:           string
  company_id:   string
  invoice_id:   string
  client_id:    string
  amount:       number
  payment_date: string
  method?:      'cash' | 'transfer' | 'check' | 'credit_card' | 'other'  // DB usa credit_card, no card
  reference?:   string
  notes?:       string
  created_at:   string
}

export interface CobraReminder {
  id:                 string
  company_id:         string
  invoice_id:         string
  client_id:          string
  reminder_type:      'whatsapp' | 'email' | 'push' | 'call'  // DB no tiene 'sms'
  status:             'pending' | 'sent' | 'failed' | 'opened'
  sent_at:            string
  next_reminder_date?: string
  notes?:             string
  created_at:         string
}

export interface CobraAgingRow {
  company_id:          string
  client_id:           string
  client_name:         string
  phone?:              string
  email?:              string
  invoice_count:       number
  outstanding_balance: number
  max_days_overdue:    number
  overdue_count:       number
  pending_count:       number
  partial_count:       number
  oldest_due_date?:    string
}

export interface CobraPromise {
  id:              string
  company_id:      string
  invoice_id:      string
  client_id:       string
  promise_date:    string
  amount:          number
  status:          'pending' | 'fulfilled' | 'broken'
  notes?:          string
  created_at:      string
}

export interface CobraMovement {
  id:              string
  company_id:      string
  user_id:         string             // Cobrador que registra
  route_point_ts:  string             // ISO timestamp del punto de ruta
  client_id:       string
  invoice_id?:     string
  folio?:          string             // Folio de factura
  amount_original: number             // Monto original de la factura
  movement_type:   'collected' | 'promise' | 'not_paid'  // Tipo de movimiento
  collected_amount?: number           // Si collected: monto cobrado
  promise_date?:   string             // Si promise: fecha comprometida
  reason_not_paid?: string            // Si not_paid: motivo
  photo_uri?:      string             // Comprobante opcional
  notes?:          string
  created_at:      string
  updated_at:      string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export const COBRA_STATUS_META = {
  pending:   { label: 'Pendiente',  color: '#FF9800' },
  partial:   { label: 'Parcial',    color: '#1565C0' },
  paid:      { label: 'Pagada',     color: '#00A650' },
  overdue:   { label: 'Vencida',    color: '#E53935' },
  cancelled: { label: 'Cancelada',  color: '#90A4AE' },
} as const

export const COBRA_CLIENT_STATUS_META = {
  active:    { label: 'Activo',    color: '#00A650' },
  inactive:  { label: 'Inactivo',  color: '#90A4AE' },
  blacklist: { label: 'Bloqueado', color: '#E53935' },
} as const

export const COBRA_PAYMENT_METHODS = {
  cash:        'Efectivo',
  transfer:    'Transferencia',
  check:       'Cheque',
  credit_card: 'Tarjeta',
  other:       'Otro',
} as const

export const COBRA_MOVEMENT_TYPE_META = {
  collected: { label: 'Cobrado',  icon: '✓', color: '#00A650' },
  promise:   { label: 'Promesa',  icon: '⏰', color: '#FF9800' },
  not_paid:  { label: 'No Pagó',  icon: '✗', color: '#E53935' },
} as const

export const COBRA_NO_PAY_REASONS = [
  'Sin fondos',
  'Disputa',
  'Rechazó',
  'Cerrado',
  'No localizados',
  'Otro',
] as const

// ── Tipos CobraRoutes (Separados de daily_routes a partir de 2026-07-04) ─────
// daily_routes = GPS tracking (user_id, points[], timestamps)
// cobra_routes = Cobranza (actor_id, clients_assigned[], status)

export interface CobraRoute {
  id:                      string
  company_id:              string
  actor_id:                string                    // UUID de auth.users
  actor_type:              'cobrador' | 'comprador'  // Tipo de actor
  assigned_date:           string                    // Fecha de la ruta (YYYY-MM-DD)

  // Planificación
  clients_assigned:        string[]                  // Array ordenado de cobra_clients.id
  total_distance_km?:      number
  estimated_duration_hours?: number

  // Estado
  status:                  'planned' | 'in_progress' | 'completed' | 'cancelled'
  route_priority:          'baja' | 'media' | 'alta' | 'crítica'

  // Resultados
  clients_visited:         number                    // Clientes visitados
  payments_collected:      number                    // Total cobrado
  promises_made:           number                    // Promesas de pago
  rejections:              number                    // Rechazos/no pagos
  actual_duration_minutes?: number

  // Auditoría
  created_at:              string
  updated_at:              string
  completed_at?:           string
}

export interface CobraRouteSummary {
  id:                    string
  company_id:            string
  actor_id:              string
  assigned_date:         string
  status:                'planned' | 'in_progress' | 'completed' | 'cancelled'
  route_priority:        'baja' | 'media' | 'alta' | 'crítica'
  total_clients_assigned: number
  clients_visited:       number
  completion_percentage: number                     // (clients_visited / assigned) * 100
  payments_collected:    number
  promises_made:         number
  rejections:            number
  created_at:            string
  updated_at:            string
}

export const COBRA_ROUTE_STATUS_META = {
  planned:      { label: 'Planeada',     color: '#90A4AE' },
  in_progress:  { label: 'En Progreso',  color: '#1565C0' },
  completed:    { label: 'Completada',   color: '#00A650' },
  cancelled:    { label: 'Cancelada',    color: '#E53935' },
} as const

export const COBRA_ROUTE_PRIORITY_META = {
  baja:     { label: 'Baja',     color: '#90A4AE', order: 1 },
  media:    { label: 'Media',    color: '#FF9800', order: 2 },
  alta:     { label: 'Alta',     color: '#FF5722', order: 3 },
  crítica:  { label: 'Crítica',  color: '#E53935', order: 4 },
} as const

// ── Helpers & Utilities ───────────────────────────────────────────────────────

export function getRiskLevel(score: number): 'green' | 'yellow' | 'orange' | 'red' {
  if (score < 40) return 'green'
  if (score < 60) return 'yellow'
  if (score < 80) return 'orange'
  return 'red'
}

export function getRiskColor(score: number): string {
  const level = getRiskLevel(score)
  switch (level) {
    case 'green': return '#22c55e'
    case 'yellow': return '#fbbf24'
    case 'orange': return '#f97316'
    case 'red': return '#ef4444'
  }
}

export function getDaysOverdue(dueDate: string): number {
  const due = new Date(dueDate)
  const today = new Date()
  const days = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, days)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount)
}
