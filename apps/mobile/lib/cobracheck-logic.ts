/**
 * CobraCheck — Lógica de Negocio COMPLETA
 * - Registro de cobranzas
 * - Cálculo automático de comisiones
 * - Detección de vinculaciones (cobranza ↔ factura)
 * - Autorización y pago de comisiones
 */

import type { CobraCollection, CobraCommission } from '@gastocheck/shared'
import { supabase } from './supabase'

/**
 * ============================================================================
 * 1. REGISTRO DE COBRANZA (Cobrador captura dinero recibido)
 * ============================================================================
 */

export interface RegisterCollectionResult {
  collection_id: string
  status: string
  commission_calculated: boolean
  commission_amount: number | null
  linked_invoice_id: string | null
}

/**
 * Registrar una cobranza:
 * - Detectar cliente automáticamente
 * - Vincular a factura pendiente (si aplica)
 * - Calcular comisión automáticamente
 */
export async function registerCollection(
  data: {
    company_id: string
    client_name: string
    client_id?: string
    amount_received: number
    payment_method: string
    received_date: string
    received_time?: string
    collector_id: string
    collector_name: string
    payment_reference?: string
  },
): Promise<RegisterCollectionResult> {
  // 1. Detectar cliente por nombre
  let client_id = data.client_id
  if (!client_id && data.client_name) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id')
      .eq('company_id', data.company_id)
      .ilike('name', `%${data.client_name}%`)
      .limit(1)
      .single()

    if (clients) {
      client_id = clients.id
    }
  }

  // 2. Buscar factura pendiente del cliente (si se detectó)
  let linked_invoice_id: string | null = null
  if (client_id) {
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, amount_due')
      .eq('company_id', data.company_id)
      .eq('client_id', client_id)
      .eq('status', 'unpaid')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (invoices && Math.abs(invoices.amount_due - data.amount_received) < 10) {
      // Coincidencia exacta (o casi)
      linked_invoice_id = invoices.id
    }
  }

  // 3. Calcular comisión
  let commission_amount: number | null = null
  const commission_percentage = 3.0 // 3% por defecto
  commission_amount = (data.amount_received * commission_percentage) / 100

  // 4. Insertar cobranza
  const collection_id = crypto.randomUUID()
  const { error } = await supabase.from('cobra_collections').insert({
    id: collection_id,
    company_id: data.company_id,
    client_id: client_id || null,
    client_name: data.client_name,
    amount_received: data.amount_received,
    payment_method: data.payment_method,
    payment_reference: data.payment_reference || null,
    received_date: data.received_date,
    received_time: data.received_time || null,
    collector_id: data.collector_id,
    collector_name: data.collector_name,
    linked_invoice_id: linked_invoice_id || null,
    commission_percentage: commission_percentage,
    commission_amount: commission_amount,
    commission_status: 'pending',
    status: 'registered',
  })

  if (error) throw error

  return {
    collection_id,
    status: 'registered',
    commission_calculated: true,
    commission_amount,
    linked_invoice_id,
  }
}

/**
 * ============================================================================
 * 2. CÁLCULO DE COMISIONES (Por período)
 * ============================================================================
 */

export async function calculateCommissions(
  company_id: string,
  collector_id: string,
  period_month: number,
  period_year: number,
): Promise<CobraCommission> {
  // 1. Sumar todas las cobranzas del período
  const { data: collections } = await supabase
    .from('cobra_collections')
    .select('commission_amount')
    .eq('company_id', company_id)
    .eq('collector_id', collector_id)
    .gte(
      'received_date',
      `${period_year}-${String(period_month).padStart(2, '0')}-01`,
    )
    .lt(
      'received_date',
      period_month === 12
        ? `${period_year + 1}-01-01`
        : `${period_year}-${String(period_month + 1).padStart(2, '0')}-01`,
    )

  const total_commission = (collections || []).reduce(
    (sum, c) => sum + (c.commission_amount || 0),
    0,
  )

  const total_collections = (collections || []).length

  // 2. Buscar o crear registro de comisión
  const { data: existing } = await supabase
    .from('cobra_commissions')
    .select('id')
    .eq('company_id', company_id)
    .eq('collector_id', collector_id)
    .eq('period_month', period_month)
    .eq('period_year', period_year)
    .single()

  if (existing) {
    // Actualizar
    const { data: updated, error } = await supabase
      .from('cobra_commissions')
      .update({
        total_collections: total_collections,
        commission_amount: total_commission,
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) throw error
    return updated as CobraCommission
  } else {
    // Crear
    const commission_id = crypto.randomUUID()
    const { data: created, error } = await supabase
      .from('cobra_commissions')
      .insert({
        id: commission_id,
        company_id,
        collector_id,
        period_month,
        period_year,
        total_collections,
        commission_rate: 3.0,
        commission_amount: total_commission,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw error
    return created as CobraCommission
  }
}

/**
 * ============================================================================
 * 3. APROBACIÓN DE COMISIÓN (Por contador)
 * ============================================================================
 */

export async function approveCommission(
  commission_id: string,
  user_id: string,
): Promise<void> {
  const { error } = await supabase
    .from('cobra_commissions')
    .update({
      status: 'approved',
      approved_by: user_id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', commission_id)

  if (error) throw error
}

/**
 * ============================================================================
 * 4. PAGO DE COMISIÓN (Transferencia a cobrador)
 * ============================================================================
 */

export async function payCommission(
  commission_id: string,
  bank_transaction_id: string,
  user_id: string,
): Promise<void> {
  const { error } = await supabase
    .from('cobra_commissions')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_via_bank_transaction_id: bank_transaction_id,
    })
    .eq('id', commission_id)

  if (error) throw error
}

/**
 * ============================================================================
 * 5. PERFORMANCE DE COBRADOR
 * ============================================================================
 */

export interface CollectorStats {
  total_collected: number
  collections_count: number
  average_per_collection: number
  pending_commission: number
  commission_percentage: number
}

export async function getCollectorStats(
  company_id: string,
  collector_id: string,
  period_month: number,
  period_year: number,
): Promise<CollectorStats> {
  const { data: collections } = await supabase
    .from('cobra_collections')
    .select('amount_received, commission_amount')
    .eq('company_id', company_id)
    .eq('collector_id', collector_id)
    .gte(
      'received_date',
      `${period_year}-${String(period_month).padStart(2, '0')}-01`,
    )
    .lt(
      'received_date',
      period_month === 12
        ? `${period_year + 1}-01-01`
        : `${period_year}-${String(period_month + 1).padStart(2, '0')}-01`,
    )

  const total_collected = (collections || []).reduce(
    (sum, c) => sum + c.amount_received,
    0,
  )
  const pending_commission = (collections || []).reduce(
    (sum, c) => sum + (c.commission_amount || 0),
    0,
  )
  const collections_count = collections?.length || 0

  return {
    total_collected,
    collections_count,
    average_per_collection: collections_count > 0 ? total_collected / collections_count : 0,
    pending_commission,
    commission_percentage: 3.0,
  }
}
