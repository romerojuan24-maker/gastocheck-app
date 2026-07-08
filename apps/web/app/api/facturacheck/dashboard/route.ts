/**
 * FacturaCheck API Routes — COMPLETO
 * GET /api/facturacheck/dashboard — obtener dashboard de facturas
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const company_id = searchParams.get('company_id')

    if (!company_id) {
      return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })
    }

    const now = new Date()
    const period_month = now.getMonth() + 1
    const period_year = now.getFullYear()

    const monthStart = new Date(period_year, period_month - 1, 1).toISOString().split('T')[0]
    const monthEnd = new Date(period_year, period_month, 0).toISOString().split('T')[0]

    // CFDIs del mes
    const { data: cfdis } = await supabase
      .from('cfdi_documents')
      .select('*')
      .eq('company_id', company_id)
      .gte('invoice_date', monthStart)
      .lte('invoice_date', monthEnd)

    const total_cfdi_generated = cfdis?.length || 0
    const total_cfdi_amount = (cfdis || []).reduce((sum: number, c: any) => sum + c.total, 0)

    // Distribuciones
    const { data: distributions } = await supabase
      .from('cfdi_distributions')
      .select('*')
      .in(
        'cfdi_id',
        (cfdis || []).map((c: any) => c.id),
      )

    const pending_distributions = (distributions || []).filter((d: any) => d.status === 'pending').length
    const failed_distributions = (distributions || []).filter((d: any) => d.status === 'failed').length

    // Por tipo de CFDI
    const cfdi_by_type = (cfdis || [])
      .reduce(
        (acc: any, c: any) => {
          const existing = acc.find((t: any) => t.type === c.cfdi_type)
          if (existing) {
            existing.count++
            existing.total += c.total
          } else {
            acc.push({ type: c.cfdi_type, count: 1, total: c.total })
          }
          return acc
        },
        [],
      )

    // Por canal de distribución
    const distribution_by_channel = (distributions || [])
      .reduce(
        (acc: any, d: any) => {
          const existing = acc.find((ch: any) => ch.channel === d.distribution_channel)
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
        [],
      )
      .map((c: any) => ({
        ...c,
        success_rate: c.count > 0 ? (c.successes / c.count) * 100 : 0,
      }))

    // Últimos CFDIs
    const recent_cfdis = (cfdis || [])
      .sort((a: any, b: any) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime())
      .slice(0, 5)

    // Créditos
    const { data: credits } = await supabase
      .from('cfdi_credits')
      .select('*')
      .eq('company_id', company_id)
      .single()

    const credit_balance = credits?.total_balance || 0
    const credit_plan = credits?.credit_plan || 'fixed'
    const credit_usage_percentage = credits
      ? Math.round(((credits.consumed_this_month || 0) / (credits.total_balance || 1)) * 100)
      : 0
    const monthly_allowance = credits?.monthly_allowance || null

    // Alertas
    const alerts: any[] = []

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

    return NextResponse.json({
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
    })
  } catch (error: any) {
    console.error('[facturacheck/dashboard GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
