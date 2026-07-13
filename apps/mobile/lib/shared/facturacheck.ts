/**
 * FacturaCheck — Tipos COMPLETOS
 * Generación, validación y distribución de CFDIs (facturas electrónicas México)
 */

// ============================================================================
// ENUMS
// ============================================================================

export type CFDIType = 'ingreso' | 'egreso' | 'traslado' | 'nomina'
export type CFDIStatus = 'draft' | 'generated' | 'validated' | 'sent' | 'cancelled'
export type DistributionChannel = 'email' | 'whatsapp' | 'download_link' | 'portal'
export type DistributionStatus = 'pending' | 'sent' | 'failed' | 'bounced' | 'read'
export type PACProvider = 'facturama' | 'solucion_facil' | 'sw' | 'finkok'
export type CreditPlan = 'fixed' | 'payperuse' | 'hybrid'

// ============================================================================
// CFDI DOCUMENT (Factura electrónica)
// ============================================================================

export interface CFDIDocument {
  id: string
  company_id: string
  cfdi_type: CFDIType
  receptor_rfc: string
  receptor_name: string
  receptor_email: string | null
  subtotal: number
  iva: number
  ieps: number | null
  retenciones: number | null
  total: number
  folio: string | null
  serie: string | null
  invoice_date: string
  invoice_number: string | null
  description: string
  line_items: Array<{
    id: string
    product_code: string
    description: string
    quantity: number
    unit_price: number
    total: number
    iva_rate: number
  }>
  uso_cfdi: string | null
  payment_method: string | null
  payment_terms: string | null
  status: CFDIStatus
  xml_path: string | null
  pac_folio: string | null
  pac_status: string | null
  sat_validated_at: string | null
  linked_invoice_id: string | null
  linked_bank_transaction_id: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// CFDI DISTRIBUTION (Envío de CFDI)
// ============================================================================

export interface CFDIDistribution {
  id: string
  cfdi_id: string
  channel: DistributionChannel
  recipient_email: string | null
  recipient_phone: string | null
  recipient_name: string | null
  template_id: string | null
  custom_message: string | null
  status: DistributionStatus
  error_message: string | null
  retry_count: number
  last_retry_at: string | null
  sent_at: string | null
  read_at: string | null
  download_count: number
  created_at: string
  updated_at: string
}

// ============================================================================
// CFDI CREDITS (Saldo de créditos)
// ============================================================================

export interface CFDICredits {
  id: string
  company_id: string
  credit_plan: CreditPlan
  total_balance: number
  monthly_allowance: number | null
  price_per_cfdi: number | null
  consumed_this_month: number
  overage_allowed: boolean
  overage_percentage: number
  last_reset_date: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// CFDI CREDIT TRANSACTION
// ============================================================================

export interface CFDICreditTransaction {
  id: string
  credit_id: string
  transaction_type: 'recharge' | 'consumption' | 'overage' | 'adjustment'
  amount: number
  balance_before: number
  balance_after: number
  reference: string | null
  description: string | null
  created_at: string
}

// ============================================================================
// PAC CONFIGURATION
// ============================================================================

export interface PACConfiguration {
  id: string
  company_id: string
  pac_provider: PACProvider
  api_key_encrypted: string
  api_user: string | null
  api_password_encrypted: string | null
  webhook_secret_encrypted: string | null
  is_active: boolean
  test_mode: boolean
  last_validated: string | null
  validation_error: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// EMAIL TEMPLATE
// ============================================================================

export interface EmailTemplate {
  id: string
  company_id: string
  template_name: string
  subject: string
  body: string
  variables: Record<string, string> | null
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

// ============================================================================
// WHATSAPP TEMPLATE
// ============================================================================

export interface WhatsAppTemplate {
  id: string
  company_id: string
  template_name: string
  message: string
  variables: Record<string, string> | null
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

// ============================================================================
// DASHBOARD
// ============================================================================

export interface FacturaCheckDashboard {
  period_month: number
  period_year: number
  total_cfdi_generated: number
  total_cfdi_amount: number
  pending_distributions: number
  failed_distributions: number
  credit_balance: number
  credit_plan: CreditPlan
  credit_usage_percentage: number
  monthly_allowance: number | null
  cfdi_by_type: Array<{
    type: CFDIType
    count: number
    total: number
  }>
  distribution_by_channel: Array<{
    channel: DistributionChannel
    count: number
    success_rate: number
  }>
  recent_cfdis: CFDIDocument[]
  alerts: FacturaCheckAlert[]
  pac_configured: boolean
  pac_provider: PACProvider | null
  pac_status: 'connected' | 'error' | 'unknown'
}

export interface FacturaCheckAlert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  message: string
  action_label?: string
  action_url?: string
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface GenerateCFDIRequest {
  company_id: string
  cfdi_type: CFDIType
  receptor_rfc: string
  receptor_name: string
  receptor_email: string
  line_items: Array<{
    description: string
    quantity: number
    unit_price: number
    iva_rate?: number
  }>
  payment_method?: string
  uso_cfdi?: string
  notes?: string
}

export interface DistributeCFDIRequest {
  cfdi_id: string
  channels: DistributionChannel[]
  recipients: Array<{
    channel: DistributionChannel
    email?: string
    phone?: string
    name?: string
  }>
  custom_message?: string
  template_id?: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const CFDI_TYPE_LABEL: Record<CFDIType, string> = {
  ingreso: 'Factura (Ingreso)',
  egreso: 'Gasto (Egreso)',
  traslado: 'Traslado',
  nomina: 'Nómina',
}

export const DISTRIBUTION_STATUS_COLOR: Record<DistributionStatus, string> = {
  pending: '#FFA726',
  sent: '#66BB6A',
  failed: '#EF5350',
  bounced: '#AB47BC',
  read: '#29B6F6',
}
