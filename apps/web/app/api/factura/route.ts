/**
 * FacturaCheck API Routes
 * Base: /api/factura/*
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyMember } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { pathname } = req.nextUrl

    if (pathname.includes('/generate-cfdi')) {
      return await handleGenerateCfdi(req, body)
    }
    if (pathname.includes('/distribute')) {
      return await handleDistribute(req, body)
    }
    if (pathname.includes('/cancel')) {
      return await handleCancel(req, body)
    }

    return NextResponse.json({ error: 'Unknown endpoint' }, { status: 404 })
  } catch (error) {
    console.error('FacturaCheck API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    if (req.nextUrl.pathname.includes('/cfdis')) {
      return await handleGetCfdis(req)
    }
    if (req.nextUrl.pathname.includes('/credits')) {
      return await handleGetCredits(req)
    }
    if (req.nextUrl.pathname.includes('/reports')) {
      return await handleGetReports(req)
    }

    return NextResponse.json({ error: 'Unknown endpoint' }, { status: 404 })
  } catch (error) {
    console.error('FacturaCheck API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================================
// POST /api/factura/generate-cfdi
// ============================================================================

async function handleGenerateCfdi(req: NextRequest, body: any) {
  try {
    const { company_id, receptor_rfc, receptor_name, subtotal, tax_amount, items } = body

    if (!company_id || !receptor_rfc || !subtotal) {
      return NextResponse.json(
        { error: 'Missing: company_id, receptor_rfc, subtotal' },
        { status: 400 }
      )
    }

    const auth = await requireCompanyMember(req, company_id, ['owner', 'admin', 'accountant'])
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    // STUB: Generate CFDI XML
    // TODO: Implement real XML generation after migrations
    const total = (subtotal || 0) + (tax_amount || 0)
    const cfdi = {
      id: crypto.randomUUID(),
      company_id,
      folio: `FAC-${Date.now()}`,
      status: 'pending',
      receptor_rfc,
      receptor_name,
      subtotal,
      tax_amount: tax_amount || 0,
      total,
      issue_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }

    console.log('[STUB] Generated CFDI:', cfdi.folio)

    return NextResponse.json({
      success: true,
      data: cfdi,
    })
  } catch (error) {
    console.error('handleGenerateCfdi error:', error)
    return NextResponse.json({ error: 'Failed to generate CFDI' }, { status: 500 })
  }
}

// ============================================================================
// GET /api/factura/cfdis
// ============================================================================

async function handleGetCfdis(req: NextRequest) {
  try {
    const company_id = req.nextUrl.searchParams.get('company_id')
    const status = req.nextUrl.searchParams.get('status')
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50')

    if (!company_id) {
      return NextResponse.json(
        { error: 'Missing: company_id' },
        { status: 400 }
      )
    }

    const auth = await requireCompanyMember(req, company_id)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    // STUB: Query CFDIs
    // TODO: Query cfdi_documents table after migrations
    const cfdis = []

    console.log('[STUB] Fetched CFDIs for company:', company_id)

    return NextResponse.json({
      success: true,
      data: {
        cfdis,
        total: 0,
        pending: 0,
        timbradas: 0,
      },
    })
  } catch (error) {
    console.error('handleGetCfdis error:', error)
    return NextResponse.json({ error: 'Failed to fetch CFDIs' }, { status: 500 })
  }
}

// ============================================================================
// GET /api/factura/cfdis/{id}
// ============================================================================

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const cfdi_id = req.nextUrl.pathname.split('/').pop()

    if (!cfdi_id) {
      return NextResponse.json({ error: 'Missing: cfdi_id' }, { status: 400 })
    }
    if (!body.company_id) {
      return NextResponse.json({ error: 'Missing: company_id' }, { status: 400 })
    }

    const auth = await requireCompanyMember(req, body.company_id, ['owner', 'admin', 'accountant'])
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    // NOTA: cuando se implemente de verdad, además verificar que el CFDI
    // con este cfdi_id pertenezca realmente a body.company_id antes de tocarlo.

    // STUB: Update CFDI
    const updated_cfdi = { id: cfdi_id, ...body, updated_at: new Date().toISOString() }

    console.log('[STUB] Updated CFDI:', cfdi_id)

    return NextResponse.json({
      success: true,
      data: updated_cfdi,
    })
  } catch (error) {
    console.error('FacturaCheck API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================================
// POST /api/factura/distribute
// ============================================================================

async function handleDistribute(req: NextRequest, body: any) {
  try {
    const { company_id, cfdi_id, channel, recipient_email, recipient_phone } = body

    if (!company_id || !cfdi_id || !channel) {
      return NextResponse.json(
        { error: 'Missing: company_id, cfdi_id, channel' },
        { status: 400 }
      )
    }

    const auth = await requireCompanyMember(req, company_id, ['owner', 'admin', 'accountant'])
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    // STUB: Queue distribution
    // TODO: Queue job to send via email/WhatsApp after migrations
    const distribution = {
      id: crypto.randomUUID(),
      cfdi_id,
      channel,
      recipient_email,
      recipient_phone,
      status: 'pending',
      created_at: new Date().toISOString(),
    }

    console.log('[STUB] Queued distribution via', channel)

    return NextResponse.json({
      success: true,
      data: distribution,
    })
  } catch (error) {
    console.error('handleDistribute error:', error)
    return NextResponse.json({ error: 'Failed to distribute' }, { status: 500 })
  }
}

// ============================================================================
// POST /api/factura/cancel
// ============================================================================

async function handleCancel(req: NextRequest, body: any) {
  try {
    const { company_id, cfdi_id, reason } = body

    if (!company_id || !cfdi_id) {
      return NextResponse.json(
        { error: 'Missing: company_id, cfdi_id' },
        { status: 400 }
      )
    }

    const auth = await requireCompanyMember(req, company_id, ['owner', 'admin', 'accountant'])
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    // STUB: Cancel CFDI
    // TODO: Call PAC to cancel + update status after migrations
    const cancelled_cfdi = {
      id: cfdi_id,
      status: 'cancelled',
      cancelled_date: new Date().toISOString(),
      cancellation_reason: reason,
    }

    console.log('[STUB] Cancelled CFDI:', cfdi_id)

    return NextResponse.json({
      success: true,
      data: cancelled_cfdi,
    })
  } catch (error) {
    console.error('handleCancel error:', error)
    return NextResponse.json({ error: 'Failed to cancel CFDI' }, { status: 500 })
  }
}

// ============================================================================
// GET /api/factura/credits
// ============================================================================

async function handleGetCredits(req: NextRequest) {
  try {
    const company_id = req.nextUrl.searchParams.get('company_id')

    if (!company_id) {
      return NextResponse.json(
        { error: 'Missing: company_id' },
        { status: 400 }
      )
    }

    const auth = await requireCompanyMember(req, company_id)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    // STUB: Query credit balance
    // TODO: Query cfdi_credits + cfdi_credit_transactions after migrations
    const credits = {
      total_balance: 0,
      consumed_this_month: 0,
      remaining: 0,
      plan: 'fixed',
      monthly_allowance: 0,
    }

    console.log('[STUB] Fetched credits for company:', company_id)

    return NextResponse.json({
      success: true,
      data: credits,
    })
  } catch (error) {
    console.error('handleGetCredits error:', error)
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 })
  }
}

// ============================================================================
// GET /api/factura/reports
// ============================================================================

async function handleGetReports(req: NextRequest) {
  try {
    const company_id = req.nextUrl.searchParams.get('company_id')
    const period = req.nextUrl.searchParams.get('period') || 'month'

    if (!company_id) {
      return NextResponse.json(
        { error: 'Missing: company_id' },
        { status: 400 }
      )
    }

    const auth = await requireCompanyMember(req, company_id)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    // STUB: Generate reports
    // TODO: Aggregate cfdi_documents + distributions for reporting after migrations
    const reports = {
      period,
      total_issued: 0,
      total_amount: 0,
      distributed: 0,
      cancelled: 0,
      pending: 0,
      by_status: {},
    }

    console.log('[STUB] Generated reports for period:', period)

    return NextResponse.json({
      success: true,
      data: reports,
    })
  } catch (error) {
    console.error('handleGetReports error:', error)
    return NextResponse.json({ error: 'Failed to generate reports' }, { status: 500 })
  }
}
