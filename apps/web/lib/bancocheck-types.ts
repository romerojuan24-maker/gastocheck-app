// Esquema REAL de producción (bank_accounts / bank_transactions). No usar
// los tipos BankAccount/BankTransaction de '@gastocheck/shared' — ese
// archivo describe un esquema aspiracional que nunca se conectó a la BD
// real y no coincide con las columnas que existen hoy.

export interface BankAccount {
  id: string
  company_id: string
  name: string
  bank_name: string | null
  last4: string | null
  currency: string
  account_type: 'checking' | 'savings' | 'credit_card' | 'other'
  current_balance: number
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type BankTransactionStatus =
  | 'new' | 'matched' | 'explained' | 'personal' | 'ignored'
  | 'pending_document' | 'pending_invoice' | 'unidentified'

export type ChargeCategory =
  | 'expense' | 'supplier' | 'advance' | 'refund' | 'tax' | 'bank_fee' | 'loan'
  | 'internal_transfer' | 'personal' | 'other'

export type DepositCategory =
  | 'client_payment' | 'unbilled_income' | 'loan' | 'owner_contribution'
  | 'refund' | 'internal_transfer' | 'personal' | 'other'

export type BankTransactionCategory = ChargeCategory | DepositCategory

export interface BankTransaction {
  id: string
  company_id: string
  bank_account_id: string
  transaction_date: string
  description: string
  reference: string | null
  amount: number
  balance_after: number | null
  currency: string
  status: BankTransactionStatus
  category: BankTransactionCategory | null
  notes: string | null
  is_personal: boolean
  confidence: number | null
  matched_entity_type: 'receipt' | 'invoice' | 'advance' | null
  related_receipt_id: string | null
  related_invoice_id: string | null
  related_advance_id: string | null
  linked_transaction_id: string | null
  imported_from: string
  import_batch_id: string | null
  created_at: string
  updated_at: string
}

export interface BankMatchSuggestion {
  id: string
  company_id: string
  transaction_id: string
  match_type: 'receipt' | 'invoice' | 'advance' | 'transfer'
  match_id: string
  confidence: number
  reason: string | null
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
}

export interface BankReconciliation {
  id: string
  company_id: string
  bank_account_id: string
  period_month: number
  period_year: number
  bank_statement_balance: number
  system_balance: number
  difference: number | null
  status: 'pending' | 'reconciled' | 'needs_review'
  reconciled_at: string | null
  reconciled_by: string | null
  notes: string | null
  created_at: string
}
