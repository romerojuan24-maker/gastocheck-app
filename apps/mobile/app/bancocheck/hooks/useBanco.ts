import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import type { BankAccount, BankTransaction } from '../types'

// ============================================================================
// 1. LOAD ACCOUNTS (con saldos totales)
// ============================================================================

export function useBancoAccounts(companyId: string) {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [totalBalance, setTotalBalance] = useState(0)

  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name')

      const accounts_list = (data ?? []) as BankAccount[]
      setAccounts(accounts_list)
      setTotalBalance(accounts_list.reduce((sum, a) => sum + (a.current_balance || 0), 0))
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { load() }, [load])

  return { accounts, totalBalance, loading, refetch: load }
}

// ============================================================================
// 2. LOAD TRANSACTIONS (filtrados por estado y cuenta)
// ============================================================================

export function useBancoTransactions(companyId: string, accountId?: string, filterStatus?: string) {
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      let query = supabase
        .from('bank_transactions')
        .select('*')
        .eq('company_id', companyId)
        .order('transaction_date', { ascending: false })
        .limit(500)

      if (accountId) query = query.eq('bank_account_id', accountId)
      if (filterStatus) query = query.eq('status', filterStatus)

      const { data } = await query
      setTransactions((data ?? []) as BankTransaction[])
    } finally {
      setLoading(false)
    }
  }, [companyId, accountId, filterStatus])

  useEffect(() => { load() }, [load])

  return { transactions, loading, refetch: load }
}

// ============================================================================
// 3. ACCIONES — cada una llama al RPC atómico (update + audit log en la
// misma transacción de Postgres; ver 20260712020000_bancocheck_rpc_acciones.sql)
// ============================================================================

export function useBancoActions() {
  const [saving, setSaving] = useState(false)

  async function run<T>(fn: () => Promise<T>) {
    setSaving(true)
    try {
      await fn()
      return { success: true, error: null }
    } catch (err: any) {
      return { success: false, error: err.message ?? 'Error desconocido' }
    } finally {
      setSaving(false)
    }
  }

  const classify = (transactionId: string, status: string, category?: string, notes?: string) =>
    run(async () => {
      const { error } = await supabase.rpc('bancocheck_classify', {
        p_transaction_id: transactionId, p_status: status, p_category: category ?? null, p_notes: notes ?? null,
      })
      if (error) throw error
    })

  const match = (transactionId: string, entityType: 'receipt' | 'invoice' | 'advance', entityId: string) =>
    run(async () => {
      const { error } = await supabase.rpc('bancocheck_match', {
        p_transaction_id: transactionId, p_entity_type: entityType, p_entity_id: entityId,
      })
      if (error) throw error
    })

  const markPersonal = (transactionId: string, isPersonal: boolean) =>
    run(async () => {
      const { error } = await supabase.rpc('bancocheck_mark_personal', {
        p_transaction_id: transactionId, p_is_personal: isPersonal,
      })
      if (error) throw error
    })

  const ignore = (transactionId: string) =>
    run(async () => {
      const { error } = await supabase.rpc('bancocheck_ignore', { p_transaction_id: transactionId })
      if (error) throw error
    })

  return { classify, match, markPersonal, ignore, saving }
}

// ============================================================================
// 4. COMPUTE KPIs
// ============================================================================

export function useBancoKPIs(transactions: BankTransaction[], accounts: BankAccount[]) {
  const UNEXPLAINED: string[] = ['new', 'unidentified', 'pending_document', 'pending_invoice', 'matched']

  const total = transactions.length
  const unexplained = transactions.filter(t => UNEXPLAINED.includes(t.status)).length
  const explained = transactions.filter(t => t.status === 'explained').length

  return {
    totalBalance: accounts.reduce((sum, a) => sum + (a.current_balance || 0), 0),
    totalTransactions: total,
    unexplainedCount: unexplained,
    explainedPercentage: total > 0 ? Math.round((explained / total) * 100) : 0,
    needsReceiptCount: transactions.filter(t => t.status === 'pending_document').length,
    needsInvoiceCount: transactions.filter(t => t.status === 'pending_invoice').length,
    personalCount: transactions.filter(t => t.is_personal).length,
  }
}
