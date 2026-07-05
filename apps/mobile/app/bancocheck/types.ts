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

// ── EXPANDED TYPES FOR DUAL IMPORT (Manual OCR + API) ──────────────────────

// Bank Accounts (Manual OCR Imports)
export interface BankAccountManual {
  id: string
  company_id: string
  account_name: string
  bank_name?: string
  account_number?: string
  currency: string
  import_method: 'pdf' | 'image' | 'csv' | 'manual'
  last_import_date?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Bank Statement Imports
export interface BankStatementImport {
  id: string
  company_id: string
  manual_account_id?: string
  import_date: string
  file_name?: string
  file_size?: number
  file_format: 'pdf' | 'jpg' | 'png' | 'csv'
  file_url?: string
  statement_start_date?: string
  statement_end_date?: string
  total_transactions: number
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message?: string
  created_at: string
  updated_at: string
}

// Bank Statement OCR Config
export type OCREngine = 'tesseract' | 'aws_textract' | 'google_vision'

export interface BankStatementOCRConfig {
  id: string
  bank_name: string
  ocr_engine: OCREngine
  table_detection_enabled: boolean
  field_mapping?: Record<string, [number, number]>
  confidence_threshold: number
  created_at: string
  updated_at: string
}

// Bank Accounts (Automated OAuth)
export type OAuthProvider = 'bbva' | 'santander' | 'belvo'
export type SyncStatus = 'connected' | 'syncing' | 'error' | 'disconnected'

export interface BankAccountAutomated {
  id: string
  company_id: string
  bank_name: string
  account_name?: string
  oauth_provider: OAuthProvider
  oauth_token_encrypted: string
  oauth_refresh_token?: string
  account_number?: string
  currency: string
  last_sync?: string
  sync_status: SyncStatus
  last_error?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Transaction Matching Log
export interface TransactionMatchingLog {
  id: string
  company_id: string
  transaction_a_id: string
  transaction_b_id: string
  match_algorithm: string
  confidence_score: number
  matched: boolean
  reason?: string
  created_at: string
}

// Reconciliation Status
export type ReconciliationStatusType = 'pending' | 'in_progress' | 'completed' | 'discrepancies'

export interface ReconciliationStatus {
  id: string
  company_id: string
  reconciliation_period_start: string
  reconciliation_period_end: string
  total_transactions: number
  matched_transactions: number
  unmatched_transactions: number
  disputed_transactions: number
  matching_percentage: number
  last_reconciliation?: string
  status: ReconciliationStatusType
  notes?: string
  created_at: string
  updated_at: string
}

// Unsupported Bank Requests
export type UnsupportedBankStatus = 'received' | 'evaluated' | 'in_progress' | 'completed' | 'rejected'

export interface UnsupportedBankRequest {
  id: string
  company_id: string
  bank_name: string
  bank_country?: string
  requester_email?: string
  request_date: string
  request_count: number
  last_request_date?: string
  priority_score: number
  status: UnsupportedBankStatus
  integration_status?: string
  admin_notes?: string
  created_at: string
  updated_at: string
}

// OCR Extraction Result
export interface OCRExtractionResult {
  confidence: number
  transactions: Array<{
    transaction_date: string
    description: string
    amount: number
    transaction_type: 'debit' | 'credit' | 'transfer'
    balance_after?: number
  }>
  errors?: string[]
  raw_text?: string
}

// Matching Result
export interface MatchingResult {
  transaction_a_id: string
  transaction_b_id: string
  is_match: boolean
  confidence_score: number
  reason: string
}

// Dashboard Data
export interface BancocheckDashboard {
  manual_accounts: BankAccountManual[]
  automated_accounts: BankAccountAutomated[]
  recent_transactions: BankTransaction[]
  reconciliation_status: ReconciliationStatus | null
  matching_summary: {
    total: number
    matched: number
    unmatched: number
    disputed: number
    percentage: number
  }
  unsupported_requests: UnsupportedBankRequest[]
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  timestamp?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}
