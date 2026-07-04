export interface BankAccount {
  id: string
  company_id: string
  name: string
  account_type: 'bank_account' | 'cash_register' | 'savings' | 'investment' | 'credit_card' | 'debit_card' | 'bank_loan' | 'private_loan'
  bank_name: string | null
  account_number: string | null
  rfc: string | null
  currency: string
  current_balance: number
  balance_last_reconcile: number | null
  last_reconcile_date: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface BankTransaction {
  id: string
  company_id: string
  bank_account_id: string
  description: string
  amount: number
  currency: string
  transaction_date: string
  source_module: 'gastocheck' | 'cobracheck' | 'manual' | 'ocr' | null
  source_id: string | null
  payment_method: string | null
  bank_reference_number: string | null
  commission: number
  tax_on_commission: number
  category: string | null
  status: 'new' | 'explained' | 'personal' | 'ignored' | 'matched' | 'pending_document' | 'pending_invoice' | 'reconciled'
  ocr_data: any | null
  receipt_image_url: string | null
  created_at: string
  updated_at: string
}

export interface BankReconciliation {
  id: string
  company_id: string
  bank_account_id: string
  period_month: number
  period_year: number
  bank_statement_balance: number
  system_balance: number
  difference: number
  status: 'pending' | 'reconciled' | 'needs_review'
  reconciled_at: string | null
  reconciled_by: string | null
  notes: string | null
  created_at: string
}

export interface AccountingVoucher {
  id: string
  company_id: string
  voucher_number: string
  voucher_type: 'INCOME' | 'EXPENSE' | 'TRANSFER'
  source_module: string
  source_ids: string[]
  total_debit: number
  total_credit: number
  currency: string
  entries: VoucherEntry[]
  exported_format: string | null
  exported_at: string | null
  exported_by: string | null
  status: 'draft' | 'exported' | 'reconciled'
  created_at: string
}

export interface VoucherEntry {
  account_code: string
  description: string
  debit: number
  credit: number
  tax_code?: string
}

export type TransactionTab = 'all' | 'pending' | 'reconciled' | 'gastocheck' | 'cobracheck'
