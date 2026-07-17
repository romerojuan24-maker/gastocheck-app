/**
 * FacturaCheck — Lógica de Negocio COMPLETA
 * - Generación de CFDIs
 * - Distribución por email/WhatsApp
 * - Gestión de créditos
 * - Dashboard con análisis
 */

import type {
  CFDIDocument,
  CFDIDistribution,
  FacturaCheckDashboard,
  FacturaCheckAlert,
  CFDIType,
  DistributionChannel,
  CFDICredits,
} from '@gastocheck/shared'
import { supabase } from './supabase'

/**
 * ============================================================================
 * 1. GENERAR CFDI
 * ============================================================================
 */

export async function generateCFDI(data: {
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
  description?: string
  created_by: string
}): Promise<{ cfdi_id: string; folio: string }> {
  const cfdi_id = crypto.randomUUID()
  const folio = `${Date.now()}`

  // Calcular montos
  let subtotal = 0
  let iva = 0

  const line_items = data.line_items.map((item) => {
    const total = item.quantity * item.unit_price
    const item_iva = total * ((item.iva_rate || 16) / 100)
    subtotal += total
    iva += item_iva

    return {
      id: crypto.randomUUID(),
      product_code: '',
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total,
      iva_rate: item.iva_rate || 16,
    }
  })

  const total = subtotal + iva

  // Consumir créditos
  const { data: credits } = await supabase
    .from('cfdi_credits')
    .select('*')
    .eq('company_id', data.company_id)
    .single()

  if (!credits || credits.total_balance < total) {
    throw new Error('Créditos insuficientes para generar CFDI')
  }

  // Actualizar saldo
  const new_balance = credits.total_balance - total
  await supabase
    .from('cfdi_credits')
    .update({ total_balance: new_balance, consumed_this_month: (credits.consumed_this_month || 0) + total })
    .eq('id', credits.id)

  // Registrar transacción
  await supabase.from('cfdi_credit_transactions').insert({
    id: crypto.randomUUID(),
    credit_id: credits.id,
    transaction_type: 'consumption',
    amount: total,
    balance_before: credits.total_balance,
    balance_after: new_balance,
    reference: folio,
    description: `CFDI ${data.cfdi_type} - ${data.receptor_name}`,
  })

  // Crear CFDI
  const { error } = await supabase.from('cfdi_documents').insert({
    id: cfdi_id,
    company_id: data.company_id,
    cfdi_type: data.cfdi_type,
    receptor_rfc: data.receptor_rfc,
    receptor_name: data.receptor_name,
    receptor_email: data.receptor_email,
    subtotal,
    iva,
    ieps: null,
    retenciones: null,
    total,
    folio,
    serie: null,
    invoice_date: new Date().toISOString().split('T')[0],
    invoice_number: null,
    description: data.description || `${data.cfdi_type} - ${data.receptor_name}`,
    line_items,
    uso_cfdi: null,
    payment_method: data.payment_method || null,
    payment_terms: null,
    status: 'generated',
    created_by: data.created_by,
  })

  if (error) throw error

  return { cfdi_id, folio }
}

/**
 * ============================================================================
 * 2. DISTRIBUIR CFDI
 * ============================================================================
 */

export async function distributeCFDI(
  cfdi_id: string,
  channels: Array<{
    channel: DistributionChannel
    recipient_email?: string
    recipient_phone?: string
    recipient_name?: string
  }>,
): Promise<void> {
  for (const ch of channels) {
    const { error } = await supabase.from('cfdi_distributions').insert({
      id: crypto.randomUUID(),
      cfdi_id,
      distribution_channel: ch.channel,
      recipient_email: ch.recipient_email || null,
      recipient_phone: ch.recipient_phone || null,
      recipient_name: ch.recipient_name || null,
      status: 'pending',
    })

    if (error) throw error
  }
}

/**
 * ============================================================================
 * 3. MARCAR CFDI COMO ENVIADO
 * ============================================================================
 */

export async function markDistributionAsSent(distribution_id: string): Promise<void> {
  const { error } = await supabase
    .from('cfdi_distributions')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', distribution_id)

  if (error) throw error
}

/**
 * ============================================================================
 * 4. OBTENER SALDO DE CRÉDITOS
 * ============================================================================
 */

export async function getCreditsBalance(company_id: string): Promise<CFDICredits | null> {
  const { data: credits } = await supabase
    .from('cfdi_credits')
    .select('*')
    .eq('company_id', company_id)
    .single()

  return credits || null
}

/**
 * ============================================================================
 * 5. CARGAR DASHBOARD
 * ============================================================================
 */

export async function loadFacturaCheckDashboard(company_id: string): Promise<FacturaCheckDashboard> {
  const now = new Date()
  const period_month = now.getMonth() + 1
  const period_year = now.getFullYear()

  // A. CFDIs del mes
  const monthStart = new Date(period_year, period_month - 1, 1)
    .toISOString()
    .split('T')[0]
  const monthEnd = new Date(period_year, period_month, 0)
    .toISOString()
    .split('T')[0]

  const { data: cfdis } = await supabase
    .from('cfdi_documents')
    .select('*')
    .eq('company_id', company_id)
    .gte('invoice_date', monthStart)
    .lte('invoice_date', monthEnd)

  const total_cfdi_generated = cfdis?.length || 0
  const total_cfdi_amount = (cfdis || []).reduce((sum, c) => sum + c.total, 0)

  // B. Distribuciones
  const { data: distributions } = await supabase
    .from('cfdi_distributions')
    .select('*')
    .in(
      'cfdi_id',
      (cfdis || []).map((c) => c.id),
    )

  const pending_distributions = (distributions || []).filter((d) => d.status === 'pending').length
  const failed_distributions = (distributions || []).filter((d) => d.status === 'failed').length

  // C. Por tipo de CFDI
  const cfdi_by_type = (cfdis || [])
    .reduce(
      (acc: Array<{ type: CFDIType; count: number; total: number }>, c: any) => {
        const existing = acc.find((t: any) => t.type === c.cfdi_type)
        if (existing) {
          existing.count++
          existing.total += c.total
        } else {
          acc.push({ type: c.cfdi_type, count: 1, total: c.total })
        }
        return acc
      },
      [] as Array<{ type: CFDIType; count: number; total: number }>,
    )

  // D. Por canal de distribución
  const distribution_by_channel = (distributions || [])
    .reduce(
      (acc, d) => {
        const existing = acc.find((ch) => ch.channel === d.distribution_channel)
        const success = d.status === 'sent'
        if (existing) {
          existing.count++
          existing.successes += success ? 1 : 0
        } else {
          acc.push({
            channel: d.distribution_channel,
            count: 1,
            successes: success ? 1 : 0,
          })
        }
        return acc
      },
      [] as Array<{ channel: DistributionChannel; count: number; successes: number }>,
    )
    .map((c: any) => ({
      ...c,
      success_rate: c.count > 0 ? (c.successes / c.count) * 100 : 0,
    }))

  // E. Últimos CFDIs
  const recent_cfdis = (cfdis || [])
    .sort((a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime())
    .slice(0, 5)

  // F. Créditos
  const { data: credits } = await supabase
    .from('cfdi_credits')
    .select('*')
    .eq('company_id', company_id)
    .single()

  const credit_balance = credits?.total_balance || 0
  const credit_plan = credits?.credit_plan || 'fixed'
  const credit_usage_percentage = credits
    ? Math.round(((credits.total_balance - credits.consumed_this_month) / credits.total_balance) * 100)
    : 0
  const monthly_allowance = credits?.monthly_allowance || null

  // G. Alertas
  const alerts: FacturaCheckAlert[] = []

  if (pending_distributions > 5) {
    alerts.push({
      id: crypto.randomUUID(),
      severity: 'warning',
      title: `${pending_distributions} CFDIs pendientes de envío`,
      message: 'Hay CFDIs que aún no se han distribuido',
    })
  }

  if (failed_distributions > 0) {
    alerts.push({
      id: crypto.randomUUID(),
      severity: 'warning',
      title: `${failed_distributions} envíos fallidos`,
      message: 'Algunos CFDIs no se pudieron distribuir, verifica los datos',
    })
  }

  if (credit_balance < 500) {
    alerts.push({
      id: crypto.randomUUID(),
      severity: 'critical',
      title: 'Créditos bajos',
      message: `Saldo: $${credit_balance.toFixed(0)}. Recarga pronto.`,
    })
  }

  return {
    period_month,
    period_year,
    total_cfdi_generated,
    total_cfdi_amount,
    pending_distributions,
    failed_distributions,
    credit_balance,
    credit_plan,
    credit_usage_percentage,
    monthly_allowance,
    cfdi_by_type,
    distribution_by_channel,
    recent_cfdis,
    alerts,
    pac_configured: !!credits,
    pac_provider: null,
    pac_status: 'unknown',
  }
}
