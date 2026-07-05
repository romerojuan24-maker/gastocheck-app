/**
 * BancoCheck Hooks
 * Bank statement OCR, OAuth sync, transaction matching
 */

import { useState, useCallback, useEffect } from 'react'
import type {
  BankAccountAutomated,
  BankTransaction,
  OCRExtractionResult,
  MatchingResult,
} from '../types'

// ============================================================================
// useOCRExtraction
// ============================================================================

export function useOCRExtraction() {
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const extract = useCallback(async (fileBase64: string): Promise<OCRExtractionResult | null> => {
    setExtracting(true)
    setError(null)

    try {
      // TODO: Call backend API /api/banco/ocr-extract with fileBase64
      const result: OCRExtractionResult = {
        confidence: 0.92,
        transactions: [
          {
            transaction_date: '2026-07-01',
            description: 'COMPRA TIENDA EL SOL',
            amount: -250.5,
            transaction_type: 'debit',
          },
        ],
      }

      console.log('[STUB] OCR Extraction completed')
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OCR extraction failed'
      setError(msg)
      return null
    } finally {
      setExtracting(false)
    }
  }, [])

  return { extract, extracting, error }
}

// ============================================================================
// useBankAccountSync
// ============================================================================

export function useBankAccountSync() {
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const syncOAuth = useCallback(
    async (
      provider: 'bbva' | 'santander' | 'belvo',
      authCode: string
    ): Promise<BankAccountAutomated | null> => {
      setSyncing(true)
      setError(null)

      try {
        // TODO: Call backend API /api/banco/oauth-callback
        const account: BankAccountAutomated = {
          id: crypto.randomUUID(),
          company_id: '',
          bank_name: provider.toUpperCase(),
          account_name: `${provider.toUpperCase()} Checking`,
          oauth_provider: provider,
          oauth_token_encrypted: 'mock_token',
          oauth_refresh_token: 'mock_refresh',
          account_number: '****1234',
          currency: 'MXN',
          last_sync: new Date().toISOString(),
          sync_status: 'connected',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        console.log('[STUB] OAuth sync completed for:', provider)
        return account
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'OAuth sync failed'
        setError(msg)
        return null
      } finally {
        setSyncing(false)
      }
    },
    []
  )

  return { syncOAuth, syncing, error }
}

// ============================================================================
// useTransactionMatching
// ============================================================================

export function useTransactionMatching() {
  const [matching, setMatching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const matchTransactions = useCallback(
    async (bankTxn: BankTransaction, internalTxn: { id: string; amount: number; date: string; description: string }): Promise<MatchingResult> => {
      setMatching(true)
      setError(null)

      try {
        // Score similarity based on amount, date, description
        const amountDiff = Math.abs(bankTxn.amount - internalTxn.amount)
        const amountSimilarity = 1 - Math.min(amountDiff / Math.abs(bankTxn.amount || 1), 1)

        const dateDiff =
          Math.abs(
            new Date(bankTxn.transaction_date).getTime() -
              new Date(internalTxn.date).getTime()
          ) /
          (1000 * 60 * 60 * 24)

        const dateSimilarity = dateDiff <= 1 ? 1 : Math.max(0, 1 - dateDiff / 30)

        const bankWords = bankTxn.description.toLowerCase().split(/\s+/)
        const internalWords = internalTxn.description.toLowerCase().split(/\s+/)
        const commonWords = bankWords.filter((w) => internalWords.includes(w)).length
        const descriptionSimilarity =
          commonWords / Math.max(bankWords.length, internalWords.length)

        const confidence_score =
          amountSimilarity * 0.5 + dateSimilarity * 0.3 + descriptionSimilarity * 0.2

        const is_match = confidence_score > 0.75

        const result: MatchingResult = {
          transaction_a_id: bankTxn.id,
          transaction_b_id: internalTxn.id,
          is_match,
          confidence_score,
          reason: is_match
            ? 'Coincidencia por monto, fecha y descripción'
            : 'Similitud insuficiente para emparejar automáticamente',
        }

        console.log('[STUB] Matching score:', confidence_score)
        return result
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Matching failed'
        setError(msg)
        return {
          transaction_a_id: bankTxn.id,
          transaction_b_id: internalTxn.id,
          is_match: false,
          confidence_score: 0,
          reason: 'Error al calcular coincidencia',
        }
      } finally {
        setMatching(false)
      }
    },
    []
  )

  return { matchTransactions, matching, error }
}

// ============================================================================
// useReconciliationStatus
// ============================================================================

export function useReconciliationStatus(companyId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<{
    total_bank_transactions: number
    total_internal_transactions: number
    matched_count: number
    unmatched_bank: number
    unmatched_internal: number
    matching_percentage: number
    last_reconciliation: string
  } | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // TODO: Query /api/banco/reconciliation-status
      const mockStatus = {
        total_bank_transactions: 150,
        total_internal_transactions: 145,
        matched_count: 138,
        unmatched_bank: 12,
        unmatched_internal: 7,
        matching_percentage: (138 / 150) * 100,
        last_reconciliation: new Date(Date.now() - 86400000).toISOString(),
      }

      setStatus(mockStatus)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { status, loading, error, refetch }
}

// ============================================================================
// useBankTransactions
// ============================================================================

export function useBankTransactions(accountId: string | null) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<BankTransaction[]>([])

  const refetch = useCallback(async () => {
    if (!accountId) return

    setLoading(true)
    setError(null)

    try {
      // TODO: Query /api/banco/transactions
      const mockTransactions: BankTransaction[] = [
        {
          id: 'BT001',
          company_id: '',
          bank_account_id: accountId,
          description: 'TRANSFERENCIA ENVIADA EMPRESA ABC',
          amount: -5000.0,
          currency: 'MXN',
          transaction_date: new Date(Date.now() - 86400000).toISOString(),
          source_module: null,
          source_id: null,
          payment_method: null,
          bank_reference_number: null,
          commission: 0,
          tax_on_commission: 0,
          category: null,
          status: 'reconciled',
          ocr_data: null,
          receipt_image_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]

      setTransactions(mockTransactions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions')
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { transactions, loading, error, refetch }
}
