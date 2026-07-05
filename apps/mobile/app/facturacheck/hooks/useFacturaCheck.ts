/**
 * FacturaCheck Hooks
 * CFDI generation, distribution, credit management
 */

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import type {
  CfdiDocument,
  CfdiIssueRequest,
  CfdiCredit,
  CfdiDistribution,
  CreditTransactionType,
  AuditAction,
} from '../types'

// ============================================================================
// logCfdiAudit — escribe en audit_log_facturacheck (tabla real, compliance)
// ============================================================================

async function logCfdiAudit(params: {
  company_id: string
  cfdi_id: string
  action: AuditAction
  after_state?: Record<string, any>
  notes?: string
}) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('audit_log_facturacheck').insert({
    company_id: params.company_id,
    cfdi_id: params.cfdi_id,
    action: params.action,
    action_by_user_id: user?.id ?? null,
    after_state: params.after_state ?? null,
    notes: params.notes ?? null,
  })
}

// ============================================================================
// useCFDIGeneration
// ============================================================================

export function useCFDIGeneration() {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateCFDI = useCallback(
    async (params: {
      receptor_rfc: string
      receptor_razon_social: string
      receptor_uso_cfdi: string
      subtotal: number
      iva?: number
      items: Array<{ description: string; quantity: number; unit_price: number }>
    }): Promise<CfdiIssueRequest | null> => {
      setGenerating(true)
      setError(null)

      try {
        // TODO: Insert en cfdi_issue_requests + llamar backend API /api/factura/generate-cfdi
        const total = params.subtotal + (params.iva || 0)
        const request: CfdiIssueRequest = {
          id: crypto.randomUUID(),
          company_id: '',
          cfdi_type: 'ingreso',
          receptor_rfc: params.receptor_rfc,
          receptor_razon_social: params.receptor_razon_social,
          receptor_uso_cfdi: params.receptor_uso_cfdi,
          receptor_codigo_postal: null,
          receptor_regimen: null,
          items: params.items.map(i => ({
            description: i.description,
            quantity: i.quantity,
            unit: 'PZA',
            unit_price: i.unit_price,
            subtotal: i.quantity * i.unit_price,
            iva_rate: 0.16,
          })),
          subtotal: params.subtotal,
          iva: params.iva ?? null,
          total,
          status: 'draft',
          uuid_cfdi: null,
          provider: 'facturama',
          error_message: null,
          requested_by: null,
          timbrado_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        console.log('[STUB] Generated CFDI issue request:', request.id)
        return request
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'CFDI generation failed'
        setError(msg)
        return null
      } finally {
        setGenerating(false)
      }
    },
    []
  )

  return { generateCFDI, generating, error }
}

// ============================================================================
// useCFDIDistribution
// ============================================================================

export function useCFDIDistribution() {
  const [distributing, setDistributing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const distribute = useCallback(
    async (params: {
      cfdi_id: string
      channel: 'email' | 'whatsapp' | 'download_link'
      recipient_email?: string
      recipient_phone?: string
      template_id?: string
    }): Promise<CfdiDistribution | null> => {
      setDistributing(true)
      setError(null)

      try {
        // TODO: Call backend API /api/factura/distribute
        const distribution: CfdiDistribution = {
          id: crypto.randomUUID(),
          cfdi_id: params.cfdi_id,
          distribution_channel: params.channel,
          recipient_email: params.recipient_email,
          recipient_phone: params.recipient_phone,
          status: 'pending',
          retry_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        console.log('[STUB] Distribution queued via:', params.channel)
        return distribution
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Distribution failed'
        setError(msg)
        return null
      } finally {
        setDistributing(false)
      }
    },
    []
  )

  return { distribute, distributing, error }
}

// ============================================================================
// useCFDICredit
// ============================================================================

export function useCFDICredit(companyId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [credit, setCredit] = useState<CfdiCredit | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // TODO: Query /api/factura/credits
      const mockCredit: CfdiCredit = {
        id: crypto.randomUUID(),
        company_id: companyId,
        credit_plan: 'fixed',
        total_balance: 500.0,
        monthly_allowance: 500.0,
        consumed_this_month: 150.5,
        overage_allowed: true,
        overage_percentage: 20,
        last_reset_date: new Date(Date.now() - 86400000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      setCredit(mockCredit)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch credit')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { credit, loading, error, refetch }
}

// ============================================================================
// useCFDIList
// ============================================================================

export function useCFDIList(companyId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cfdis, setCfdis] = useState<CfdiDocument[]>([])
  const [summary, setSummary] = useState({
    total_cfdis: 0,
    pending_cfdis: 0,
    timbradas: 0,
    cancelled: 0,
    total_issued: 0,
  })

  const refetch = useCallback(
    async (filters?: { status?: string; date_from?: string; date_to?: string }) => {
      setLoading(true)
      setError(null)

      try {
        // TODO: Query /api/factura/cfdis
        const mockCfdis: CfdiDocument[] = [
          {
            id: 'CFDI001',
            company_id: companyId,
            direction: 'issued',
            uuid_cfdi: crypto.randomUUID(),
            rfc_emisor: 'ABC000000XYZ',
            razon_social_emisor: 'Mi Empresa SA de CV',
            rfc_receptor: 'XYZ123456ABC',
            razon_social_receptor: 'Cliente Ejemplo',
            fecha_emision: new Date().toISOString(),
            subtotal: 1290.32,
            iva: 206.45,
            ieps: null,
            retenciones: null,
            total: 1500.0,
            metodo_pago: 'PUE',
            forma_pago: '03',
            uso_cfdi: 'G03',
            tipo_comprobante: 'I',
            status: 'vigente',
            xml_storage_path: null,
            pdf_storage_path: null,
            related_receipt_id: null,
            related_cobra_invoice_id: null,
            related_bank_txn_id: null,
            sat_validated_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]

        setCfdis(mockCfdis)
        setSummary({
          total_cfdis: 1,
          pending_cfdis: 0,
          timbradas: 1,
          cancelled: 0,
          total_issued: 1500.0,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch CFDIs')
      } finally {
        setLoading(false)
      }
    },
    [companyId]
  )

  useEffect(() => {
    refetch()
  }, [refetch])

  return { cfdis, summary, loading, error, refetch }
}

// ============================================================================
// useCFDICancel
// ============================================================================

export function useCFDICancel() {
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cancel = useCallback(async (cfdi_id: string, reason: string): Promise<boolean> => {
    setCancelling(true)
    setError(null)

    try {
      // TODO: Call backend API /api/factura/cancel
      console.log('[STUB] CFDI cancelled:', cfdi_id)
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cancellation failed'
      setError(msg)
      return false
    } finally {
      setCancelling(false)
    }
  }, [])

  return { cancel, cancelling, error }
}

// ============================================================================
// usePacProviderConfig — estado real del PAC (tabla cfdi_provider_configs)
// ============================================================================

export interface PacProviderStatus {
  id: string
  provider: string
  rfc: string
  razon_social: string | null
  mode: 'sandbox' | 'production'
  is_active: boolean
}

export function usePacProviderConfig(companyId: string) {
  const [config, setConfig] = useState<PacProviderStatus | null>(null)
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('cfdi_provider_configs')
        .select('id, provider, rfc, razon_social, mode, is_active')
        .eq('company_id', companyId)
        .maybeSingle()

      setConfig((data as PacProviderStatus) ?? null)
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { config, loading, refetch }
}

// ============================================================================
// useGenerateAccountingVoucher — FacturaCheck ↔ GastoCheck
// Genera una póliza contable real (accounting_vouchers) cuando un CFDI
// emitido está vigente. Evita duplicados verificando source_ids antes de insertar.
// ============================================================================

export function useGenerateAccountingVoucher() {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasVoucher = useCallback(async (cfdiId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('accounting_vouchers')
      .select('id')
      .contains('source_ids', [cfdiId])
      .limit(1)
    return (data?.length ?? 0) > 0
  }, [])

  const generate = useCallback(async (cfdi: CfdiDocument): Promise<{ success: boolean; error?: string }> => {
    if (cfdi.direction !== 'issued' || cfdi.status !== 'vigente') {
      return { success: false, error: 'Solo se puede generar póliza de CFDIs emitidos y vigentes' }
    }
    if (!cfdi.total || !cfdi.subtotal) {
      return { success: false, error: 'El CFDI no tiene montos completos' }
    }

    setGenerating(true)
    setError(null)
    try {
      const already = await hasVoucher(cfdi.id)
      if (already) {
        return { success: false, error: 'Ya existe una póliza para este CFDI' }
      }

      const iva = cfdi.iva ?? 0
      const voucherNumber = `FACT-${cfdi.uuid_cfdi.slice(0, 8).toUpperCase()}`

      const entries = [
        {
          account_code: '4000',
          description: `Ingresos por servicios — ${cfdi.razon_social_receptor || cfdi.rfc_receptor}`,
          debit: 0,
          credit: cfdi.subtotal,
        },
        ...(iva > 0
          ? [{ account_code: '2108', description: 'IVA trasladado', debit: 0, credit: iva }]
          : []),
        {
          account_code: '1200',
          description: 'Cuentas por cobrar / Bancos',
          debit: cfdi.total,
          credit: 0,
        },
      ]

      const { error: insertError } = await supabase.from('accounting_vouchers').insert({
        company_id: cfdi.company_id,
        voucher_number: voucherNumber,
        voucher_type: 'INCOME',
        source_module: 'facturacheck',
        source_ids: [cfdi.id],
        total_debit: cfdi.total,
        total_credit: cfdi.total,
        currency: 'MXN',
        entries,
        status: 'draft',
      })

      if (insertError) throw insertError

      await logCfdiAudit({
        company_id: cfdi.company_id,
        cfdi_id: cfdi.id,
        action: 'validated',
        after_state: { voucher_number: voucherNumber, total: cfdi.total },
        notes: 'Póliza contable generada desde FacturaCheck',
      })

      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al generar póliza'
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setGenerating(false)
    }
  }, [hasVoucher])

  const generateBulk = useCallback(async (cfdis: CfdiDocument[]): Promise<{ created: number; skipped: number }> => {
    const candidates = cfdis.filter(d => d.direction === 'issued' && d.status === 'vigente')
    let created = 0
    let skipped = 0
    for (const cfdi of candidates) {
      const result = await generate(cfdi)
      if (result.success) created++
      else skipped++
    }
    return { created, skipped }
  }, [generate])

  return { generate, generateBulk, hasVoucher, generating, error }
}

// ============================================================================
// useMatchCfdiToBankTransaction — FacturaCheck ↔ BancoCheck
// Busca transacciones bancarias candidatas para un CFDI emitido vigente
// sin vincular (por monto + proximidad de fecha), y permite confirmar el
// vínculo. Actualiza cfdi_documents.related_bank_txn_id (columna real,
// ya existente) y clasifica la transacción como 'collection'/'explained'.
// ============================================================================

export interface BankTxnCandidate {
  id: string
  description: string
  amount: number
  transaction_date: string
  confidence: number
}

export function useMatchCfdiToBankTransaction(companyId: string) {
  const [searching, setSearching] = useState(false)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const findCandidates = useCallback(async (cfdi: CfdiDocument): Promise<BankTxnCandidate[]> => {
    if (!companyId || !cfdi.total) return []
    setSearching(true)
    setError(null)
    try {
      const { data } = await supabase
        .from('bank_transactions')
        .select('id, description, amount, transaction_date')
        .eq('company_id', companyId)
        .eq('status', 'new')
        .gt('amount', 0)
        .gte('amount', cfdi.total * 0.98)
        .lte('amount', cfdi.total * 1.02)
        .order('transaction_date', { ascending: false })
        .limit(10)

      const emisionDate = cfdi.fecha_emision ? new Date(cfdi.fecha_emision).getTime() : Date.now()

      const candidates: BankTxnCandidate[] = (data ?? []).map((t: any) => {
        const amountDiff = Math.abs(t.amount - (cfdi.total ?? 0))
        const amountScore = 1 - Math.min(amountDiff / (cfdi.total || 1), 1)

        const dayDiff = Math.abs(new Date(t.transaction_date).getTime() - emisionDate) / (1000 * 60 * 60 * 24)
        const dateScore = dayDiff <= 3 ? 1 : Math.max(0, 1 - dayDiff / 30)

        return {
          id: t.id,
          description: t.description,
          amount: t.amount,
          transaction_date: t.transaction_date,
          confidence: amountScore * 0.7 + dateScore * 0.3,
        }
      }).sort((a, b) => b.confidence - a.confidence)

      return candidates
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar transacciones')
      return []
    } finally {
      setSearching(false)
    }
  }, [companyId])

  const confirmMatch = useCallback(async (cfdiId: string, bankTxnId: string): Promise<{ success: boolean; error?: string }> => {
    setLinking(true)
    setError(null)
    try {
      const [cfdiUpdate, txnUpdate] = await Promise.all([
        supabase.from('cfdi_documents').update({ related_bank_txn_id: bankTxnId }).eq('id', cfdiId),
        supabase.from('bank_transactions').update({ status: 'explained', category: 'collection' }).eq('id', bankTxnId),
      ])

      if (cfdiUpdate.error) throw cfdiUpdate.error
      if (txnUpdate.error) throw txnUpdate.error

      await logCfdiAudit({
        company_id: companyId,
        cfdi_id: cfdiId,
        action: 'validated',
        after_state: { related_bank_txn_id: bankTxnId },
        notes: 'Pago bancario vinculado desde FacturaCheck',
      })

      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al vincular'
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setLinking(false)
    }
  }, [companyId])

  return { findCandidates, confirmMatch, searching, linking, error }
}
