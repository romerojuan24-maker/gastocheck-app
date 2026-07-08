/**
 * GastoCheck — Lógica SIMPLE
 * Contador: ve reembolsos + viáticos pendientes → aprueba
 */

import { supabase } from './supabase'
import type { GastoCheckDashboard, ReembolsoPendiente, ViaticoPendiente } from '@gastocheck/shared'

/**
 * ============================================================================
 * CONTADOR: CARGAR PENDIENTES (reembolsos + viáticos)
 * ============================================================================
 */

export async function loadGastoCheckDashboard(company_id: string): Promise<GastoCheckDashboard> {
  // REEMBOLSOS PENDIENTES
  const { data: reembolsos } = await supabase
    .from('reembolsos')
    .select('id, company_id, employee_id, employee_email, total, status, created_at')
    .eq('company_id', company_id)
    .in('status', ['pending_auth', 'closed'])
    .order('created_at', { ascending: false })

  const reembolsos_with_count: ReembolsoPendiente[] = await Promise.all(
    (reembolsos || []).map(async (r: any) => {
      const { count } = await supabase
        .from('receipt_reembolsos')
        .select('*', { count: 'exact', head: true })
        .eq('reembolso_id', r.id)

      return {
        id: r.id,
        employee_email: r.employee_email || 'unknown',
        total: r.total,
        receipts_count: count || 0,
        created_at: r.created_at,
        status: r.status,
      }
    }),
  )

  const reembolsos_pendientes_total = reembolsos_with_count.reduce((sum: number, r: any) => sum + r.total, 0)

  // VIÁTICOS PENDIENTES
  const { data: viaticos } = await supabase
    .from('viaticos')
    .select('id, person_id, amount, trip_date, city, category, created_at, status')
    .eq('company_id', company_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const viaticos_with_email: ViaticoPendiente[] = await Promise.all(
    (viaticos || []).map(async (v: any) => {
      const { data: user } = await supabase.auth.admin.getUserById(v.person_id)

      return {
        id: v.id,
        person_id: v.person_id,
        person_email: user?.user?.email || 'unknown',
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

  return {
    reembolsos_pendientes: reembolsos_with_count,
    reembolsos_pendientes_count: reembolsos_with_count.length,
    reembolsos_pendientes_total,
    viaticos_pendientes: viaticos_with_email,
    viaticos_pendientes_count: viaticos_with_email.length,
    viaticos_pendientes_total,
    total_pendiente,
  }
}

/**
 * ============================================================================
 * CONTADOR: APROBAR REEMBOLSO
 * ============================================================================
 */

export async function approveReembolso(reembolso_id: string, contador_id: string): Promise<void> {
  const { error } = await supabase
    .from('reembolsos')
    .update({
      status: 'closed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', reembolso_id)

  if (error) throw error
}

/**
 * ============================================================================
 * CONTADOR: APROBAR VIÁTICO
 * ============================================================================
 */

export async function approveViatico(viatico_id: string, contador_id: string): Promise<void> {
  const { error } = await supabase
    .from('viaticos')
    .update({
      status: 'approved',
      approved_by: contador_id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', viatico_id)

  if (error) throw error
}
