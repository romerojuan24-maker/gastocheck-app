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
