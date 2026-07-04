export interface CashFlowItem {
  id: string
  company_id: string
  description: string
  amount: number
  direction: 'in' | 'out'
  item_type: 'income' | 'expense'
  expected_date: string
  status: 'pending' | 'paid' | 'collected' | 'at_risk' | 'overdue' | 'cancelled'
  source: 'manual' | 'cobracheck' | 'gastocheck' | 'bancocheck' | 'inventariocheck'
  notes: string | null
  is_scenario: boolean
  created_at: string
}

export interface RiskStatus {
  status: 'green' | 'yellow' | 'red'
  balance: number
}
