/**
 * FlujoCheck API Routes
 * Base: /api/flujo/*
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
)

// ============================================================================
// POST /api/flujo/periods
// Create or update cash flow period
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { method } = body

    // Route to specific endpoint handler
    if (req.nextUrl.pathname.endsWith('/periods')) {
      return await handleCreatePeriod(req, body)
    }
    if (req.nextUrl.pathname.endsWith('/credit-scan')) {
      return await handleCreditScan(req, body)
    }
    if (req.nextUrl.pathname.endsWith('/simulate-payment')) {
      return await handleSimulatePayment(req, body)
    }

    return NextResponse.json({ error: 'Unknown endpoint' }, { status: 404 })
  } catch (error) {
    console.error('FlujoCheck API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================================
// GET /api/flujo/dashboard
// Get full dashboard data for period
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    if (req.nextUrl.pathname.includes('/dashboard')) {
      return await handleDashboard(req)
    }
    if (req.nextUrl.pathname.includes('/projection/annual')) {
      return await handleAnnualProjection(req)
    }
    if (req.nextUrl.pathname.includes('/receivables')) {
      return await handleReceivableConfidence(req)
    }

    return NextResponse.json({ error: 'Unknown endpoint' }, { status: 404 })
  } catch (error) {
    console.error('FlujoCheck API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================================
// Handler: Create Period
// ============================================================================

async function handleCreatePeriod(req: NextRequest, body: any) {
  try {
    const {
      company_id,
      period_start,
      period_end,
      balance_start,
    } = body

    if (!company_id || !period_start || !period_end) {
      return NextResponse.json(
        { error: 'Missing required fields: company_id, period_start, period_end' },
        { status: 400 }
      )
    }

    // STUB: Insert into cash_flow_periods table
    // TODO: Implement actual DB insert with migrations
    const period = {
      id: crypto.randomUUID(),
      company_id,
      period_start,
      period_end,
      balance_start: balance_start || 0,
      balance_projected: balance_start || 0,
      balance_actual: null,
      risk_level: 'green',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    console.log('[STUB] Created period:', period)

    return NextResponse.json({
      success: true,
      data: period,
    })
  } catch (error) {
    console.error('handleCreatePeriod error:', error)
    return NextResponse.json({ error: 'Failed to create period' }, { status: 500 })
  }
}

// ============================================================================
// Handler: Get Dashboard
// ============================================================================

async function handleDashboard(req: NextRequest) {
  try {
    const company_id = req.nextUrl.searchParams.get('company_id')
    const period_id = req.nextUrl.searchParams.get('period_id')

    if (!company_id) {
      return NextResponse.json(
        { error: 'Missing query param: company_id' },
        { status: 400 }
      )
    }

    // STUB: Fetch all dashboard data
    // TODO: Implement actual DB queries after migrations
    const dashboard = {
      period: {
        id: period_id || 'default',
        company_id,
        period_start: new Date().toISOString().split('T')[0],
        period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        balance_start: 50000,
        balance_projected: 55000,
        balance_actual: null,
        risk_level: 'green',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      balance: {
        current_balance: 50000,
        period_start_balance: 50000,
        difference: 0,
        buffer_required: 10000,
        buffer_available: 40000,
      },
      payables: [],
      receivables: [],
      credits: [],
      recommendations: [],
      health_status: 'green',
      upcoming_payments: [],
    }

    console.log('[STUB] Returning dashboard for company:', company_id)

    return NextResponse.json({
      success: true,
      data: dashboard,
    })
  } catch (error) {
    console.error('handleDashboard error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 })
  }
}

// ============================================================================
// Handler: Credit Scan (OCR document)
// ============================================================================

async function handleCreditScan(req: NextRequest, body: any) {
  try {
    const { company_id, document_url, document_type } = body

    if (!company_id || !document_url) {
      return NextResponse.json(
        { error: 'Missing required fields: company_id, document_url' },
        { status: 400 }
      )
    }

    // STUB: OCR parsing
    // TODO: Implement actual OCR (Tesseract, AWS Textract, etc.)
    const extracted = {
      credit_name: 'Crédito Extraído',
      principal: 100000,
      interest_rate: 0.1200,
      term_months: 36,
      monthly_payment: 3200,
      amortization_type: 'fixed_payment',
      confidence: 0.95,
      extracted_fields: {
        // Raw OCR output
      },
    }

    console.log('[STUB] Scanned credit document:', document_url)

    return NextResponse.json({
      success: true,
      data: extracted,
    })
  } catch (error) {
    console.error('handleCreditScan error:', error)
    return NextResponse.json({ error: 'Failed to scan credit document' }, { status: 500 })
  }
}

// ============================================================================
// Handler: Simulate Payment
// ============================================================================

async function handleSimulatePayment(req: NextRequest, body: any) {
  try {
    const { credit_id, payment_amount, payment_date } = body

    if (!credit_id || !payment_amount) {
      return NextResponse.json(
        { error: 'Missing required fields: credit_id, payment_amount' },
        { status: 400 }
      )
    }

    // STUB: Simulate payment impact
    // TODO: Implement actual amortization algorithms
    const simulation = {
      original_balance: 100000,
      payment_amount,
      new_balance: 100000 - payment_amount,
      interest_saved: payment_amount * 0.01,
      months_reduced: 1,
      new_payment_schedule: [],
    }

    console.log('[STUB] Simulated payment:', payment_amount)

    return NextResponse.json({
      success: true,
      data: simulation,
    })
  } catch (error) {
    console.error('handleSimulatePayment error:', error)
    return NextResponse.json({ error: 'Failed to simulate payment' }, { status: 500 })
  }
}

// ============================================================================
// Handler: Annual Projection
// ============================================================================

async function handleAnnualProjection(req: NextRequest) {
  try {
    const company_id = req.nextUrl.searchParams.get('company_id')

    if (!company_id) {
      return NextResponse.json(
        { error: 'Missing query param: company_id' },
        { status: 400 }
      )
    }

    // STUB: Generate 12-month projection
    // TODO: Implement actual projection algorithm
    const projections = Array.from({ length: 12 }, (_, i) => ({
      id: crypto.randomUUID(),
      company_id,
      projection_month: i + 1,
      projection_year: new Date().getFullYear(),
      projected_income: 150000 + i * 5000,
      projected_expenses: 120000 + i * 3000,
      projected_net_cash: 30000 + i * 2000,
      health_status: i < 6 ? 'green' : i < 9 ? 'yellow' : 'red',
      health_score: 85 - i * 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    console.log('[STUB] Generated annual projection for company:', company_id)

    return NextResponse.json({
      success: true,
      data: {
        projections,
        trend: 'declining',
        recommendations: ['Aumentar ingresos', 'Reducir gastos operativos'],
      },
    })
  } catch (error) {
    console.error('handleAnnualProjection error:', error)
    return NextResponse.json({ error: 'Failed to generate projection' }, { status: 500 })
  }
}

// ============================================================================
// Handler: Receivable Confidence (Payment collection scoring)
// ============================================================================

async function handleReceivableConfidence(req: NextRequest) {
  try {
    const receivable_id = req.nextUrl.pathname.split('/').pop()

    if (!receivable_id) {
      return NextResponse.json(
        { error: 'Missing receivable_id in path' },
        { status: 400 }
      )
    }

    // STUB: Calculate confidence score
    // TODO: Implement actual ML scoring based on customer history
    const confidence = {
      id: crypto.randomUUID(),
      receivable_id,
      confidence_score: Math.floor(Math.random() * 100),
      confidence_level: Math.random() > 0.5 ? 'green' : Math.random() > 0.5 ? 'yellow' : 'red',
      reasoning: 'Basado en historial de pagos',
      created_at: new Date().toISOString(),
    }

    console.log('[STUB] Calculated confidence for receivable:', receivable_id)

    return NextResponse.json({
      success: true,
      data: confidence,
    })
  } catch (error) {
    console.error('handleReceivableConfidence error:', error)
    return NextResponse.json({ error: 'Failed to calculate confidence' }, { status: 500 })
  }
}
