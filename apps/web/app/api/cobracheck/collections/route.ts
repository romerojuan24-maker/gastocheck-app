/**
 * CobraCheck API Routes — COMPLETO
 * POST /api/cobracheck/collections — registrar cobranza
 * GET /api/cobracheck/collections — listar cobranzas
 * PUT /api/cobracheck/collections/:id — aprobar/depositar
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCompanyMember } from '@/lib/api-auth'
import type { CobraCollection } from '@gastocheck/shared'

const COBRA_ROLES = ['owner', 'admin', 'accountant', 'supervisor', 'cobrador', 'collector']

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

// ============================================================================
// GET /api/cobracheck/collections
// Listar cobranzas con filtros
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const company_id = searchParams.get('company_id')
    const collector_id = searchParams.get('collector_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // service_role salta RLS → autorización explícita (JWT + membresía activa).
    const auth = await requireCompanyMember(req, company_id)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    let query = supabase
      .from('cobra_collections')
      .select('*', { count: 'exact' })
      .eq('company_id', company_id)
      .order('received_date', { ascending: false })

    if (collector_id) query = query.eq('collector_id', collector_id)
    if (status) query = query.eq('status', status)

    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({
      data,
      total: count,
      limit,
      offset,
    })
  } catch (error: any) {
    console.error('[cobracheck/collections GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ============================================================================
// POST /api/cobracheck/collections
// Registrar nueva cobranza
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      company_id,
      client_name,
      client_id,
      amount_received,
      payment_method,
      received_date,
      received_time,
      collector_id,
      collector_name,
      payment_reference,
    } = body

    if (!company_id || !client_name || !amount_received || !collector_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      )
    }

    // Autorización explícita (service_role salta RLS). Escritura = rol de cobranza.
    const auth = await requireCompanyMember(req, company_id, COBRA_ROLES)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    // 1. Detectar cliente si no se especificó
    let resolved_client_id = client_id
    if (!resolved_client_id) {
      const { data: clients } = await supabase
        .from('clients')
        .select('id')
        .eq('company_id', company_id)
        .ilike('name', `%${client_name}%`)
        .limit(1)
        .single()

      if (clients) {
        resolved_client_id = clients.id
      }
    }

    // 2. Buscar factura pendiente del cliente
    let linked_invoice_id: string | null = null
    if (resolved_client_id) {
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, amount_due')
        .eq('company_id', company_id)
        .eq('client_id', resolved_client_id)
        .eq('status', 'unpaid')
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (invoices && Math.abs(invoices.amount_due - amount_received) < 10) {
        linked_invoice_id = invoices.id
      }
    }

    // 3. Calcular comisión
    const commission_percentage = 3.0
    const commission_amount = (amount_received * commission_percentage) / 100

    // 4. Insertar cobranza
    const collection_id = crypto.randomUUID()
    const { error: insertError } = await supabase.from('cobra_collections').insert({
      id: collection_id,
      company_id,
      client_id: resolved_client_id || null,
      client_name,
      amount_received,
      payment_method,
      payment_reference: payment_reference || null,
      received_date,
      received_time: received_time || null,
      collector_id,
      collector_name: collector_name || null,
      linked_invoice_id: linked_invoice_id || null,
      commission_percentage,
      commission_amount,
      commission_status: 'pending',
      status: 'registered',
    })

    if (insertError) throw insertError

    return NextResponse.json({
      success: true,
      collection_id,
      status: 'registered',
      commission_amount,
      linked_invoice_id,
    })
  } catch (error: any) {
    console.error('[cobracheck/collections POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ============================================================================
// PUT /api/cobracheck/collections/:id
// Actualizar estado de cobranza (depositar, reconciliar, etc.)
// ============================================================================

export async function PUT(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const collection_id = url.pathname.split('/').pop()
    const body = await req.json()

    if (!collection_id) {
      return NextResponse.json({ error: 'Missing collection_id' }, { status: 400 })
    }

    const { action, status, notes } = body

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 })
    }

    // Autorización: NO se confía en user_id del body. Se obtiene la empresa DE
    // la cobranza y se verifica que el token pertenezca a esa empresa.
    const { data: col } = await supabase
      .from('cobra_collections').select('company_id').eq('id', collection_id).maybeSingle()
    if (!col) return NextResponse.json({ error: 'Cobranza no encontrada' }, { status: 404 })
    const auth = await requireCompanyMember(req, col.company_id, COBRA_ROLES)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    // Mapear acciones a estados
    const statusMap: Record<string, string> = {
      deposit: 'deposited',
      reconcile: 'reconciled',
      dispute: 'disputed',
    }

    const new_status = statusMap[action] || status

    const { error } = await supabase
      .from('cobra_collections')
      .update({
        status: new_status,
      })
      .eq('id', collection_id)

    if (error) throw error

    return NextResponse.json({ success: true, action, new_status })
  } catch (error: any) {
    console.error('[cobracheck/collections PUT]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
