/**
 * GastoCheck API — CONTADOR VE PENDIENTES
 * GET /api/gastocheck/pendientes — reembolsos + viáticos listos para aprobar
 * PUT /api/gastocheck/reembolsos/:id/aprobar — contador aprueba reembolso
 * PUT /api/gastocheck/viaticos/:id/aprobar — contador aprueba viático
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCompanyMember } from '@/lib/api-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

// GET /api/gastocheck/pendientes?company_id=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const company_id = searchParams.get('company_id')

    // service_role salta RLS → autorización explícita. Pendientes de contador:
    // roles financieros/administrativos.
    const auth = await requireCompanyMember(req, company_id, ['owner', 'admin', 'accountant', 'contador_general'])
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    // REEMBOLSOS PENDIENTES (status = 'closed' = listos para contador)
    const { data: reembolsos } = await supabase
      .from('reembolsos')
      .select('id, company_id, employee_id, employee_email, total, status, created_at')
      .eq('company_id', company_id)
      .in('status', ['pending_auth', 'closed'])
      .order('created_at', { ascending: false })

    // Contar comprobantes por reembolso
    const reembolsos_with_count = await Promise.all(
      (reembolsos || []).map(async (r: any) => {
        const { count } = await supabase
          .from('receipt_reembolsos')
          .select('*', { count: 'exact', head: true })
          .eq('reembolso_id', r.id)

        return {
          id: r.id,
          employee_email: r.employee_email,
          total: r.total,
          receipts_count: count || 0,
          created_at: r.created_at,
          status: r.status,
        }
      }),
    )

    const reembolsos_pendientes_total = reembolsos_with_count.reduce((sum: number, r: any) => sum + r.total, 0)

    // VIÁTICOS PENDIENTES (status = 'closed' = empleado rinde, listo para contador)
    const { data: viaticos } = await supabase
      .from('viaticos')
      .select('id, person_id, amount, trip_date, city, category, created_at, status')
      .eq('company_id', company_id)
      .in('status', ['pending', 'closed'])  // pending_auth similar a reembolsos
      .order('created_at', { ascending: false })

    // Obtener emails de personas
    const viaticos_with_email = await Promise.all(
      (viaticos || []).map(async (v: any) => {
        const { data: user } = await supabase
          .from('auth.users')
          .select('email')
          .eq('id', v.person_id)
          .single()

        return {
          id: v.id,
          person_id: v.person_id,
          person_email: user?.email || 'unknown',
          amount: v.amount,
          trip_date: v.trip_date,
          city: v.city,
          category: v.category,
          created_at: v.created_at,
          status: v.status,
        }
      }),
    )

    const viaticos_pendientes_total = viaticos_with_email.reduce((sum: number, v: any) => sum + v.amount, 0)

    const total_pendiente = reembolsos_pendientes_total + viaticos_pendientes_total

    return NextResponse.json({
      reembolsos_pendientes: reembolsos_with_count,
      reembolsos_pendientes_count: reembolsos_with_count.length,
      reembolsos_pendientes_total,
      viaticos_pendientes: viaticos_with_email,
      viaticos_pendientes_count: viaticos_with_email.length,
      viaticos_pendientes_total,
      total_pendiente,
    })
  } catch (error: any) {
    console.error('[gastocheck/pendientes GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/gastocheck/reembolsos/:id/aprobar
export async function PUT(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const reembolsoId = pathParts[4] // /api/gastocheck/reembolsos/:id/aprobar
    const action = pathParts[6] // 'aprobar'

    if (!reembolsoId) {
      return NextResponse.json({ error: 'Missing reembolso_id' }, { status: 400 })
    }

    if (action === 'aprobar') {
      const body = await req.json()
      const { user_id } = body

      if (!user_id) {
        return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
      }

      // 1. Actualizar reembolso: status = 'closed'
      const { error: updateError } = await supabase
        .from('reembolsos')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', reembolsoId)

      if (updateError) throw updateError

      // 2. AQUÍ: Generar journal_entries automáticamente
      // Por ahora solo completamos el update, los asientos se generan desde contabilidad
      // (Esta es responsabilidad del módulo de contabilidad, no de GastoCheck)

      return NextResponse.json({
        success: true,
        reembolso_id: reembolsoId,
        status: 'closed',
        message: 'Reembolso aprobado. Asientos contables listos para generar.',
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('[gastocheck/reembolsos PUT]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
