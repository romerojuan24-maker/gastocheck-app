// CobraCheck Types — Collections & Receivables Management

export interface CobraClient {
  id: string
  company_id: string
  name: string
  rfc: string
  email?: string
  phone?: string
  contact_name?: string
  credit_limit: number
  current_balance: number
  risk_score: number // 0-100
  status: 'active' | 'inactive' | 'blacklist'
  last_payment_date?: string
  created_at: string
  updated_at: string
}

export interface CobraInvoice {
  id: string
  company_id: string
  client_id: string
  folio: string
  uuid_sat?: string
  subtotal: number
  tax: number
  amount: number
  issue_date: string
  due_date: string
  payment_date?: string
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled'
  days_overdue: number
  created_at: string
  updated_at: string
}

export interface CobraPromise {
  id: string
  company_id: string
  client_id: string
  amount: number
  promise_date: string
  status: 'pending' | 'fulfilled' | 'broken'
  notes?: string
  created_at: string
  updated_at: string
}

export interface CobraCall {
  id: string
  company_id: string
  client_id: string
  recorded_by: string
  call_date: string
  duration_minutes?: number
  status: 'completed' | 'no_answer' | 'voicemail'
  notes: string
  created_at: string
}

export interface CobraPayment {
  id: string
  company_id: string
  invoice_id: string
  client_id: string
  amount: number
  payment_date: string
  method: 'cash' | 'transfer' | 'check' | 'credit_card' | 'other'
  reference?: string
  notes?: string
  bank_transaction_id?: string
  created_by?: string
  created_at: string
}

// Constants
export const COBRA_INVOICE_STATUSES = {
  pending: 'Pendiente',
  partial: 'Parcial',
  paid: 'Pagada',
  overdue: 'Vencida',
  cancelled: 'Cancelada',
} as const

export const COBRA_CLIENT_STATUSES = {
  active: 'Activo',
  inactive: 'Inactivo',
  blacklist: 'Bloqueado',
} as const

export const COBRA_PAYMENT_METHODS = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  check: 'Cheque',
  credit_card: 'Tarjeta de crédito',
  other: 'Otro',
} as const

export const COBRA_CALL_STATUSES = {
  completed: 'Completada',
  no_answer: 'No contesta',
  voicemail: 'Buzón',
} as const

// Risk Score Levels
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

// Helpers
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
