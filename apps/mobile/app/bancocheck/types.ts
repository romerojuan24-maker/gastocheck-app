export interface BankAccount {
  id: string
  company_id: string
  name: string
  bank_name: string
  account_number: string
  current_balance: number
  is_active: boolean
  created_at: string
}

export interface BankTransaction {
  id: string
  company_id: string
  bank_account_id: string
  description: string
  amount: number
  transaction_date: string
  category: string | null
  status: 'new' | 'explained' | 'personal' | 'ignored' | 'matched' | 'pending_document' | 'pending_invoice'
  created_at: string
}

export type TransactionTab = 'new' | 'explained' | 'pending'
