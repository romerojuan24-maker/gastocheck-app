// ── CFDI Documents — esquema REAL de producción ──────────────────────────
// (ver packages/shared/src/facturacheck.ts, ya vive en @gastocheck/shared)

export type CfdiStatus =
  | 'vigente'
  | 'cancelado'
  | 'not_found'
  | 'duplicate'
  | 'unmatched'
  | 'matched'
  | 'pending_complement'

export type CfdiDirection = 'received' | 'issued'
export type CfdiType = 'I' | 'E' | 'P' | 'T'  // Ingreso | Egreso | Pago | Traslado

export interface CfdiDocument {
  id: string
  company_id: string
  direction: CfdiDirection
  uuid_cfdi: string
  rfc_emisor: string
  razon_social_emisor: string | null
  rfc_receptor: string
  razon_social_receptor: string | null
  fecha_emision: string | null
  subtotal: number | null
  iva: number | null
  ieps: number | null
  retenciones: number | null
  total: number | null
  metodo_pago: string | null
  forma_pago: string | null
  uso_cfdi: string | null
  tipo_comprobante: CfdiType | null
  status: CfdiStatus
  xml_storage_path: string | null
  pdf_storage_path: string | null
  related_receipt_id: string | null
  related_cobra_invoice_id: string | null
  related_bank_txn_id: string | null
  sat_validated_at: string | null
  created_at: string
  updated_at: string
}

// ── CFDI Issue Requests — generación de nuevas facturas (draft→timbrado) ──

export interface CfdiIssueLineItem {
  description: string
  quantity: number
  unit: string
  unit_price: number
  subtotal: number
  iva_rate: number
  clave_prod_serv?: string
  clave_unidad?: string
}

export interface CfdiIssueRequest {
  id: string
  company_id: string
  cfdi_type: 'ingreso' | 'egreso' | 'pago' | 'traslado'
  receptor_rfc: string
  receptor_razon_social: string | null
  receptor_uso_cfdi: string
  receptor_codigo_postal: string | null
  receptor_regimen: string | null
  items: CfdiIssueLineItem[]
  subtotal: number | null
  iva: number | null
  total: number | null
  status: 'draft' | 'pending' | 'timbrado' | 'cancelled' | 'error'
  uuid_cfdi: string | null
  provider: string
  error_message: string | null
  requested_by: string | null
  timbrado_at: string | null
  created_at: string
  updated_at: string
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
