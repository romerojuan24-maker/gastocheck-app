// Types para módulo CobraCheck mobile

export interface RouteClient {
  id: string
  name: string
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
