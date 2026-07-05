/**
 * BancoCheck Hooks
 * Bank statement OCR, OAuth sync, transaction matching
 */

import { useState, useCallback, useEffect } from 'react'
import type {
  BankAccountManual,
  BankAccountAutomated,
  BankTransaction,
  OCRExtractionResult,
  MatchingResult,
} from './types'

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
      // TODO: Call actual OCR service (Tesseract/AWS Textract)
      // For now, return mock extraction
      const result: OCRExtractionResult = {
        success: true,
        confidence: 0.92,
        transactions: [
          {
            date: '2026-07-01',
            description: 'COMPRA TIENDA EL SOL',
            amount: -250.5,
            type: 'debit',
            reference: 'REF001',
          },
          {
            date: '2026-07-02',
            description: 'DEPOSITO CLIENTE ABC',
            amount: 1500.0,
            type: 'credit',
            reference: 'DEP001',
          },
          {
            date: '2026-07-02',
            description: 'COMISION BANCARIA',
            amount: -15.0,
            type: 'debit',
            reference: 'FEE001',
          },
        ],
        extracted_at: new Date().toISOString(),
      }

      console.log('[STUB] OCR Extraction completed, confidence:', result.confidence)
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
        // TODO: Exchange auth code for tokens via actual OAuth provider
        // Store encrypted tokens in pac_configuration-like table
        const account: BankAccountAutomated = {
          id: crypto.randomUUID(),
          company_id: '',
          oauth_provider: provider,
          account_number: '****1234',
          account_name: `${provider.toUpperCase()} Checking`,
          account_holder: 'Mock User',
          balance: 50000.0,
          currency: 'MXN',
          sync_status: 'connected',
          last_sync: new Date().toISOString(),
          access_token_encrypted: 'mock_token',
          refresh_token_encrypted: 'mock_refresh',
          token_expires_at: new Date(Date.now() + 86400000).toISOString(),
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
    async (bankTxn: BankTransaction, internalTxn: any): Promise<MatchingResult> => {
      setMatching(true)
      setError(null)

      try {
        // Score similarity based on amount, date, description
        const amountDiff = Math.abs(bankTxn.amount - internalTxn.amount)
        const amountSimilarity = 1 - Math.min(amountDiff / Math.abs(bankTxn.amount), 1)

        const dateDiff = Math.abs(
          new Date(bankTxn.transaction_date).getTime() -
            new Date(internalTxn.date).getTime()
        ) / (1000 * 60 * 60 * 24) // days

        const dateSimilarity = dateDiff <= 1 ? 1 : Math.max(0, 1 - dateDiff / 30)

        // Simple description similarity (word overlap)
        const bankWords = bankTxn.description.toLowerCase().split(/\s+/)
        const internalWords = internalTxn.description.toLowerCase().split(/\s+/)
        const commonWords = bankWords.filter((w) => internalWords.includes(w)).length
        const descriptionSimilarity = commonWords / Math.max(bankWords.length, internalWords.length)

        // Weighted confidence score
        const confidence_score =
          amountSimilarity * 0.5 + dateSimilarity * 0.3 + descriptionSimilarity * 0.2

        const is_match = confidence_score > 0.75

        const result: MatchingResult = {
          bank_transaction_id: bankTxn.id,
          internal_transaction_id: internalTxn.id,
          is_match,
          confidence_score,
          matched_at: is_match ? new Date().toISOString() : null,
        }

        console.log('[STUB] Matching score:', confidence_score, 'Match:', is_match)
        return result
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Matching failed'
        setError(msg)
        return {
          bank_transaction_id: bankTxn.id,
          internal_transaction_id: internalTxn.id,
          is_match: false,
          confidence_score: 0,
          matched_at: null,
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
  const [status, setStatus] = useState<any>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // TODO: Query reconciliation_status table
      const mockStatus = {
        total_bank_transactions: 150,
        total_internal_transactions: 145,
        matched_count: 138,
        unmatched_bank: 12,
        unmatched_internal: 7,
        matching_percentage: (138 / 150) * 100,
        last_reconciliation: new Date(Date.now() - 86400000).toISOString(),
        discrepancies: [
          {
            type: 'amount_mismatch',
            count: 3,
            examples: ['TXN001', 'TXN002'],
          },
          {
            type: 'date_mismatch',
            count: 5,
            examples: ['TXN003', 'TXN004', 'TXN005'],
          },
        ],
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
      // TODO: Query bank_transactions table
      const mockTransactions: BankTransaction[] = [
        {
          id: 'BT001',
          account_id: accountId,
          transaction_date: new Date(Date.now() - 86400000).toISOString(),
          description: 'TRANSFERENCIA ENVIADA EMPRESA ABC',
          amount: -5000.0,
          transaction_type: 'transfer',
          source: 'bank_statement',
          matching_status: 'matched',
          matched_internal_id: 'INT001',
          created_at: new Date().toISOString(),
        },
        {
          id: 'BT002',
          account_id: accountId,
          transaction_date: new Date(Date.now() - 172800000).toISOString(),
          description: 'DEPOSITO CLIENTE XYZ',
          amount: 8500.0,
          transaction_type: 'credit',
          source: 'oauth_sync',
          matching_status: 'unmatched',
          matched_internal_id: null,
          created_at: new Date().toISOString(),
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

// ============================================================================
// useAutoMatchingEngine
// ============================================================================

export function useAutoMatchingEngine(companyId: string) {
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<MatchingResult[]>([])

  const runAutoMatching = useCallback(async () => {
    setProcessing(true)
    setError(null)

    try {
      // TODO: Run full auto-matching algorithm across all transactions
      // Use confidence thresholds to determine if match is confident enough
      // Return unconfident matches for manual review
      const mockResults: MatchingResult[] = [
        {
          bank_transaction_id: 'BT001',
          internal_transaction_id: 'INT001',
          is_match: true,
          confidence_score: 0.98,
          matched_at: new Date().toISOString(),
        },
        {
          bank_transaction_id: 'BT002',
          internal_transaction_id: 'INT003',
          is_match: false,
          confidence_score: 0.62,
          matched_at: null,
        },
      ]

      setResults(mockResults)
      console.log('[STUB] Auto-matching completed:', mockResults.length, 'results')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto-matching failed')
    } finally {
      setProcessing(false)
    }
  }, [companyId])

  return { results, processing, error, runAutoMatching }
}
