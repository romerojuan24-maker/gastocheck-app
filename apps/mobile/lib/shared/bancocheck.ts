/**
 * BancoCheck — Tipos COMPLETOS (OTA 170+)
 * Incluye: transacciones, sugerencias, aprobaciones, clasificaciones
 * SIN HUECOS — todo lo necesario para operación real
 */

// ============================================================================
// ENUMS Y TIPOS PRIMITIVOS
// ============================================================================

export type BankTransactionType = 'debit' | 'credit' | 'transfer'

export type BankTransactionStatus =
  | 'new'               // Acaba de importarse
  | 'auto_approved'     // Sistema autoaprobó (confianza alta)
  | 'pending_approval'  // Esperando aprobación manual
  | 'approved'          // Aprobado por contador
  | 'rejected'          // Rechazado por contador
  | 'duplicate'         // Es duplicado de otro
  | 'personal'          // Personal (no contabilizar)
  | 'reconciled'        // Reconciliado con extracto

export type BankTransactionCategory =
  | 'collection'        // Cobranza (cliente pagó)
  | 'expense'           // Gasto operativo
  | 'supplier_payment'  // Pago a proveedor
  | 'transfer'          // Traspaso entre cuentas
  | 'tax'               // Impuestos
  | 'commission'        // Comisión bancaria
  | 'payroll'           // Nómina
  | 'investment'        // Inversión
  | 'loan'              // Préstamo
  | 'unknown'           // No clasificado

export type SuggestionStatus =
  | 'pending'           // Esperando aprobación
  | 'auto_approved'     // Aprobado automáticamente
  | 'approved'          // Aprobado por contador
  | 'approved_modified' // Aprobado pero editado
  | 'rejected'          // Rechazado
  | 'executed'          // Ya se convirtió en póliza

export type LinkageMethod = 'automatic' | 'ai_suggested' | 'manual' | 'auto_reconciled'

// ============================================================================
// BANK ACCOUNT (Cuentas bancarias)
// ============================================================================

export interface BankAccount {
  id: string
  company_id: string
  name: string
  bank_name: string | null
  account_number: string | null
  last4: string | null
  currency: string // 'MXN', 'USD'
  current_balance: number
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// BANK TRANSACTION (Movimiento bancario - EL PRINCIPAL)
// ============================================================================

export interface BankTransaction {
  id: string
  company_id: string
  bank_account_id: string

  // Datos del movimiento
  transaction_date: string // YYYY-MM-DD
  transaction_time: string | null // HH:MM:SS
  reference: string | null
  description: string
  amount: number
  balance_after: number | null

  // Clasificación AUTOMÁTICA (sistema, no usuario)
  transaction_type: BankTransactionType
  detected_category: BankTransactionCategory | null
  detected_confidence: number // 0.0 - 1.0

  // Vinculación automática (se propone, puede override)
  linked_receipt_id: string | null // A GastoCheck
  linked_invoice_id: string | null // A factura de cliente
  linked_supplier_id: string | null
  linked_client_id: string | null
  linked_ot_id: string | null

  // Estado y aprobación
  status: BankTransactionStatus
  approved_by: string | null
  approved_at: string | null
  approval_notes: string | null

  // Importación
  import_batch_id: string | null
  import_source: 'csv' | 'ofx' | 'belvo_api' | 'manual'

  created_at: string
  updated_at: string
}

// ============================================================================
// ACCOUNTING ENTRY (Línea de asiento contable)
// ============================================================================

export interface AccountingEntry {
  account_code: string
  description: string
  debit: number
  credit: number
  tax_code?: string | null
  is_tax?: boolean
}

// ============================================================================
// TRANSACTION SUGGESTION (Asiento sugerido - CRÍTICO)
// ============================================================================

export interface TransactionSuggestion {
  id: string
  company_id: string

  // Origen
  source_type: 'bank_transaction' | 'receipt' | 'invoice' | 'payroll' | 'inventory'
  source_id: string

  // El asiento
  suggested_entries: AccountingEntry[]
  total_debit: number
  total_credit: number

  // IA
  confidence: number // 0.0 - 1.0
  confidence_reason: string

  // Estado
  status: SuggestionStatus
  suggested_by_module: string
  suggested_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null

  created_at: string
  updated_at: string
}

// ============================================================================
// CLASSIFICATION RULE (Regla de clasificación automática)
// ============================================================================

export interface TransactionClassificationRule {
  id: string
  company_id: string

  // Cuándo aplica
  keyword: string // "OXXO", "PAYPAL", "ISR"
  bank_name: string | null
  amount_min: number | null
  amount_max: number | null

  // Qué categoría
  detected_category: BankTransactionCategory
  confidence_score: number

  // Qué cuenta contable
  suggested_account_code: string | null
  suggested_account_name: string | null

  // Auditoría
  created_by: string
  is_system_rule: boolean
  is_active: boolean
  created_at: string
}

// ============================================================================
// TRANSACTION LINKAGE (Vínculo movimiento ↔ documento)
// ============================================================================

export interface TransactionLinkage {
  id: string
  company_id: string

  bank_transaction_id: string

  // Lo que vincula
  linked_type: 'invoice' | 'receipt' | 'supplier' | 'client' | 'ot' | 'other'
  linked_id: string

  // Cómo se detectó
  linkage_method: LinkageMethod
  confidence_score: number | null

  // Parcial (1 pago paga 3 facturas)
  is_partial: boolean
  partial_amount: number | null

  created_by: string
  created_at: string
}

// ============================================================================
// APPROVAL RULE (Regla de autorización por monto/categoría)
// ============================================================================

export interface ApprovalRule {
  id: string
  company_id: string

  // Cuándo aplica
  min_amount: number | null
  max_amount: number | null
  applies_to_category: BankTransactionCategory | 'all'
  applies_to_role: string // 'buyer', 'supervisor'

  // Quién aprueba
  required_approval_role: string // 'accountant', 'admin', 'owner'
  auto_approve_above_confidence: number // 0.95

  // Auditoría
  created_by: string
  is_active: boolean
  created_at: string
}

// ============================================================================
// DASHBOARD (Para UI — data agregada)
// ============================================================================

export interface BancocheckDashboard {
  // Cuentas
  total_accounts: number
  accounts: BankAccount[]
  total_balance: number

  // Hoy
  today_in: number
  today_out: number
  today_net: number

  // Mes
  month_in: number
  month_out: number
  month_net: number

  // Transacciones pendientes (lo urgente)
  new_transactions_count: number
  pending_approvals: TransactionSuggestion[]
  pending_approvals_count: number

  // Problemas
  duplicates_count: number
  unclassified_count: number
  unreconciled_count: number

  // Últimas 10 transacciones
  recent_transactions: BankTransaction[]
}

export interface TransactionDetailFull extends BankTransaction {
  account: BankAccount
  suggestion: TransactionSuggestion | null
  linkages: TransactionLinkage[]
  approver?: { id: string; email: string; name: string } | null
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface ImportBankStatementRequest {
  account_id: string
  file_format: 'csv' | 'ofx' | 'mt940' | 'pdf'
  file_data: string // Base64 o CSV raw
}

export interface ImportBankStatementResponse {
  success: boolean
  imported_count: number
  error_count: number
  errors?: string[]
  import_batch_id: string
}

export interface ApproveSuggestionRequest {
  suggestion_id: string
  action: 'approve' | 'reject' | 'approve_modified'
  modified_entries?: AccountingEntry[]
  notes?: string
}

export interface ClassifyTransactionRequest {
  transaction_id: string
  category: BankTransactionCategory
  manual_override: boolean
}

export interface CreateLinkageRequest {
  transaction_id: string
  linked_type: TransactionLinkage['linked_type']
  linked_id: string
  is_partial?: boolean
  partial_amount?: number
}

// ============================================================================
// FILTERS (Para queries)
// ============================================================================

export interface BankTransactionFilter {
  company_id: string
  account_id?: string
  status?: BankTransactionStatus
  category?: BankTransactionCategory
  date_from?: string
  date_to?: string
  amount_min?: number
  amount_max?: number
  search?: string
  limit?: number
  offset?: number
}

export interface SuggestionFilter {
  company_id: string
  status?: SuggestionStatus
  confidence_min?: number
  source_type?: string
  limit?: number
  offset?: number
}

// ============================================================================
// HELPERS (Para UI)
// ============================================================================

export const BANK_TRANSACTION_STATUS_META: Record<
  BankTransactionStatus,
  { label: string; color: string; icon: string }
> = {
  new: { label: 'Nuevo', color: '#90A4AE', icon: 'clock' },
  auto_approved: { label: 'Auto aprobado', color: '#4CAF50', icon: 'check-circle' },
  pending_approval: { label: 'Pendiente aprobación', color: '#FF9800', icon: 'alert-circle' },
  approved: { label: 'Aprobado', color: '#4CAF50', icon: 'check' },
  rejected: { label: 'Rechazado', color: '#F44336', icon: 'x-circle' },
  duplicate: { label: 'Duplicado', color: '#9C27B0', icon: 'copy' },
  personal: { label: 'Personal', color: '#607D8B', icon: 'user' },
  reconciled: { label: 'Reconciliado', color: '#00BCD4', icon: 'check-double' },
}

export const BANK_CATEGORY_LABELS: Record<BankTransactionCategory, string> = {
  collection: 'Cobranza',
  expense: 'Gasto operativo',
  supplier_payment: 'Pago a proveedor',
  transfer: 'Traspaso',
  tax: 'Impuestos',
  commission: 'Comisión bancaria',
  payroll: 'Nómina',
  investment: 'Inversión',
  loan: 'Préstamo',
  unknown: 'Sin clasificar',
}

// Parsear CSV (BBVA, Santander, etc.)
export function parseBankCSVRow(row: Record<string, string>): Partial<BankTransaction> {
  const clean = (v: string | undefined) => (v ?? '').trim()
  const num = (v: string | undefined) => {
    const n = parseFloat(clean(v).replace(/,/g, '').replace(/\$/g, ''))
    return isNaN(n) ? 0 : n
  }

  const amount = num(row['Cargo'] ?? row['cargo']) ? -num(row['Cargo'] ?? row['cargo']) : num(row['Abono'] ?? row['abono'] ?? row['Monto'] ?? '')

  return {
    transaction_date: clean(row['Fecha'] ?? row['fecha'] ?? row['Date'] ?? ''),
    description: clean(row['Descripción'] ?? row['descripcion'] ?? row['Concepto'] ?? ''),
    reference: clean(row['Referencia'] ?? row['referencia'] ?? '') || null,
    amount: amount,
    balance_after: num(row['Saldo'] ?? row['saldo'] ?? '') || null,
    status: 'new',
    transaction_type: amount < 0 ? 'debit' : 'credit',
    import_source: 'csv',
  }
}
