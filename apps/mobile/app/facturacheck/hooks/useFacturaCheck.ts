/**
 * FacturaCheck Hooks
 * CFDI generation, distribution, credit management
 */

import { useState, useCallback, useEffect } from 'react'
import type {
  CfdiDocument,
  CfdiCredit,
  CfdiDistribution,
  CreditTransactionType,
} from '../types'

// ============================================================================
// useCFDIGeneration
// ============================================================================

export function useCFDIGeneration() {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateCFDI = useCallback(
    async (params: {
      receptor_rfc: string
      receptor_name: string
      subtotal: number
      tax_amount?: number
      items: Array<{ description: string; quantity: number; unit_price: number }>
    }): Promise<CfdiDocument | null> => {
      setGenerating(true)
      setError(null)

      try {
        // TODO: Call backend API /api/factura/generate-cfdi
        const total = params.subtotal + (params.tax_amount || 0)
        const cfdi: CfdiDocument = {
          id: crypto.randomUUID(),
          company_id: '',
          folio: `FAC-${Date.now()}`,
          uuid_cfdi: crypto.randomUUID(),
          rfc_emisor: 'ABC000000XYZ',
          rfc_receptor: params.receptor_rfc,
          receptor_name: params.receptor_name,
          direction: 'issued',
          total,
          subtotal: params.subtotal,
          tax_amount: params.tax_amount || 0,
          fecha_emision: new Date().toISOString(),
          status: 'pending',
          xml_content: null,
          created_at: new Date().toISOString(),
        }

        console.log('[STUB] Generated CFDI:', cfdi.folio)
        return cfdi
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
            folio: 'FAC-20260705001',
            uuid_cfdi: crypto.randomUUID(),
            rfc_emisor: 'ABC000000XYZ',
            rfc_receptor: 'XYZ123456ABC',
            receptor_name: 'Cliente Ejemplo',
            direction: 'issued',
            total: 1500.0,
            subtotal: 1290.32,
            tax_amount: 206.45,
            fecha_emision: new Date().toISOString(),
            status: 'timbrado',
            xml_content: null,
            created_at: new Date().toISOString(),
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
