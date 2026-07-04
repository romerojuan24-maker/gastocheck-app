// Types para módulo CobraCheck mobile — OTA 132

export interface CobraInvoice {
  id: string
  company_id: string
  client_id: string
  folio: string
  amount: number
  subtotal?: number
  tax?: number
  issue_date: string
  due_date: string
  payment_date?: string
  status: 'pending' | 'overdue' | 'paid' | 'partial'
  days_overdue: number
  interest_rate: number // mensual, ej: 0.02 = 2%
  uuid_sat?: string
}

export interface CobraReminder {
  id: string
  company_id: string
  client_id: string
  invoice_id?: string
  actor_id?: string
  reminder_type: 'payment_due' | 'overdue' | 'promise_followup' | 'custom'
  channel: 'whatsapp' | 'sms' | 'email' | 'call'
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled'
  next_reminder_date: string
  message?: string
  notes?: string
  sent_at?: string
  created_at: string
}

export interface CobraPaymentLink {
  id: string
  company_id: string
  client_id: string
  invoice_id?: string
  token: string
  amount: number
  interest: number
  description?: string
  status: 'pending' | 'viewed' | 'paid' | 'expired'
  expires_at: string
  paid_at?: string
  created_by: string
  created_at: string
}

export interface RouteClient {
  id: string
  name: string
  rfc?: string
  lat?: number
  lng?: number
  address?: string
  phone?: string
  office_hours?: string
  distance?: number
  eta?: number
  status: 'pending' | 'visited' | 'completed'
  invoices_count: number
  total_amount: number
  current_balance?: number
}

export interface ScannerResult {
  amount?: number
  date?: string
  provider?: string
  confidence?: number
}

export interface Movement {
  id: string
  client_id: string
  invoice_id?: string
  user_id: string
  route_point_ts?: string
  movement_type: 'collected' | 'not_paid' | 'promise'
  collected_amount?: number
  amount_original?: number
  method?: 'cash' | 'transfer' | 'check' | 'card'
  reason_not_paid?: string
  promise_date?: string
  notes?: string
  route_id?: string
  company_id?: string
  photo_uri?: string
}

export interface DailyCash {
  amount: number
  deposit_date?: string
  reference?: string
}

export interface DailyReport {
  actor_id: string
  report_date: string
  clients_visited: number
  total_collected: number
  cash_deposits: DailyCash[]
  promises_made: number
  movements: Movement[]
  created_at: string
}
