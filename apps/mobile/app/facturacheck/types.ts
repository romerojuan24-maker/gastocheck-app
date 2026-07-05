// ── CFDI Documents (Expanded) ────────────────────────────────────────────

export interface CfdiDocument {
  id: string
  company_id: string
  folio?: string
  serie?: string
  uuid_cfdi: string
  rfc_emisor: string
  rfc_receptor: string
  receptor_name?: string
  direction: 'received' | 'issued'
  total: number
  subtotal?: number
  tax_amount?: number
  fecha_emision: string
  due_date?: string
  timbro_date?: string
  status: 'draft' | 'pending' | 'timbrado' | 'cancelled' | 'error' | 'valid' | 'cancelado' | 'not_found' | 'duplicate'
  xml_url?: string
  pdf_url?: string
  pac_folio?: string
  cobracheck_link_id?: string
  gastocheck_link_id?: string
  xml_content: string | null
  notes?: string
  created_at: string
  updated_at?: string
}

// ── CFDI Credits (Prepayment system) ──────────────────────────────────────

export type CreditPlan = 'fixed' | 'payperuse' | 'hybrid'

export interface CfdiCredit {
  id: string
  company_id: string
  credit_plan: CreditPlan
  total_balance: number
  monthly_allowance?: number
  price_per_cfdi?: number
  consumed_this_month: number
  overage_allowed: boolean
  overage_percentage: number
  last_reset_date?: string
  created_at: string
  updated_at: string
}

export type CreditTransactionType = 'recharge' | 'consumption' | 'overage' | 'adjustment'

export interface CfdiCreditTransaction {
  id: string
  credit_id: string
  transaction_type: CreditTransactionType
  amount: number
  balance_before?: number
  balance_after?: number
  reference?: string
  description?: string
  created_at: string
}

// ── PAC Configuration ────────────────────────────────────────────────────

export type PACProvider = 'facturama' | 'solucion_facil' | 'sw' | 'finkok'

export interface PacConfiguration {
  id: string
  company_id: string
  pac_provider: PACProvider
  api_key_encrypted: string
  api_user?: string
  api_password_encrypted?: string
  webhook_secret_encrypted?: string
  is_active: boolean
  test_mode: boolean
  last_validated?: string
  validation_error?: string
  created_at: string
  updated_at: string
}

// ── CFDI Distributions ───────────────────────────────────────────────────

export type DistributionChannel = 'email' | 'whatsapp' | 'download_link'
export type DistributionStatus = 'pending' | 'sent' | 'failed' | 'bounced' | 'undelivered'

export interface CfdiDistribution {
  id: string
  cfdi_id: string
  distribution_channel: DistributionChannel
  recipient_email?: string
  recipient_phone?: string
  recipient_name?: string
  status: DistributionStatus
  error_message?: string
  sent_at?: string
  retry_count: number
  last_retry_at?: string
  created_at: string
  updated_at: string
}

// ── Email Templates ──────────────────────────────────────────────────────

export interface EmailTemplate {
  id: string
  company_id: string
  template_name: string
  subject: string
  body: string
  variables?: Record<string, string>
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

// ── WhatsApp Templates ───────────────────────────────────────────────────

export interface WhatsappTemplate {
  id: string
  company_id: string
  template_name: string
  message_text: string
  variables?: Record<string, string>
  include_pdf: boolean
  include_xml: boolean
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

// ── Audit Log ────────────────────────────────────────────────────────────

export type AuditAction = 'created' | 'stamped' | 'cancelled' | 'distributed' | 'validated' | 'error'

export interface AuditLogFacturacheck {
  id: string
  company_id: string
  cfdi_id?: string
  action: AuditAction
  action_by_user_id?: string
  action_timestamp: string
  ip_address?: string
  user_agent?: string
  device_info?: Record<string, any>
  before_state?: Record<string, any>
  after_state?: Record<string, any>
  notes?: string
  created_at: string
}

// ── Dashboard Data ───────────────────────────────────────────────────────

export interface FacturacheckDashboard {
  cfdis: CfdiDocument[]
  credits: CfdiCredit | null
  recent_distributions: CfdiDistribution[]
  pac_status: {
    is_connected: boolean
    last_error?: string
    last_validation?: string
  }
  summary: {
    total_cfdis: number
    pending_cfdis: number
    timbradas: number
    cancelled: number
    total_issued: number
  }
}

// ── API Response Types ───────────────────────────────────────────────────

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
