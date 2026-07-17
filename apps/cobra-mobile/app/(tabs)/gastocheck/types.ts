// Types para módulo GastoCheck en cobra-mobile

export interface RouteClient {
  id: string
  name: string
  lat: number
  lng: number
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
  actor_id: string
  movement_date: string
  status: 'paid' | 'unpaid' | 'promise'
  amount: number
  method?: 'cash' | 'transfer' | 'check' | 'card'
  payment_date?: string
  unpaid_reason?: string
  promise_date?: string
  notes?: string
  proof_documents?: Array<{
    file_url: string
    file_name: string
    uploaded_at: string
  }>
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
