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
