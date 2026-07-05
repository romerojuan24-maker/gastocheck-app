import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import type { BankAccount, BankTransaction, BankReconciliation } from '../types'

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

      // Sumar todos los saldos (convertir a MXN si aplica)
      const total = accounts_list.reduce((sum, a) => sum + (a.current_balance || 0), 0)
      setTotalBalance(total)
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    load()
  }, [load])

  return { accounts, totalBalance, loading, refetch: load }
}

// ============================================================================
// 2. LOAD TRANSACTIONS (filtrados por estado y fuente)
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

      if (accountId) {
        query = query.eq('bank_account_id', accountId)
      }

      if (filterStatus) {
        query = query.eq('status', filterStatus)
      }

      const { data } = await query
      setTransactions((data ?? []) as BankTransaction[])
    } finally {
      setLoading(false)
    }
  }, [companyId, accountId, filterStatus])

  useEffect(() => {
    load()
  }, [load])

  return { transactions, loading, refetch: load }
}

// ============================================================================
// 3. CLASSIFY & UPDATE TRANSACTION
// ============================================================================

export function useBancoClassify(companyId: string) {
  const [saving, setSaving] = useState(false)

  const classify = async (transactionId: string, category: string, status: string) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('bank_transactions')
        .update({ category, status, updated_at: new Date().toISOString() })
        .eq('id', transactionId)

      if (error) throw error
      return { success: true, error: null }
    } catch (err: any) {
      return { success: false, error: err.message }
    } finally {
      setSaving(false)
    }
  }

  const updateTransaction = async (transactionId: string, updates: Partial<BankTransaction>) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('bank_transactions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', transactionId)

      if (error) throw error
      return { success: true, error: null }
    } catch (err: any) {
      return { success: false, error: err.message }
    } finally {
      setSaving(false)
    }
  }

  const reset = async (transactionId: string) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('bank_transactions')
        .update({ category: null, status: 'new', updated_at: new Date().toISOString() })
        .eq('id', transactionId)

      if (error) throw error
      return { success: true, error: null }
    } catch (err: any) {
      return { success: false, error: err.message }
    } finally {
      setSaving(false)
    }
  }

  return { classify, updateTransaction, reset, saving }
}

// ============================================================================
// 4. RECONCILIATION
// ============================================================================

export function useBancoReconciliation(companyId: string) {
  const [reconciliations, setReconciliations] = useState<BankReconciliation[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('bank_reconciliations')
        .select('*')
        .eq('company_id', companyId)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false })

      setReconciliations((data ?? []) as BankReconciliation[])
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    load()
  }, [load])

  const reconcile = async (reconciliationId: string, notes?: string) => {
    try {
      const { error } = await supabase
        .from('bank_reconciliations')
        .update({
          status: 'reconciled',
          reconciled_at: new Date().toISOString(),
          notes
        })
        .eq('id', reconciliationId)

      if (error) throw error
      return { success: true, error: null }
    } catch (err: any) {
      console.error('useBancoReconciliation.reconcile failed:', err.message);
      return { success: false, error: err.message }
    }
  }

  return { reconciliations, loading, refetch: load, reconcile }
}

// ============================================================================
// 5. COMPUTE KPIs
// ============================================================================

export function useBancoKPIs(transactions: BankTransaction[], accounts: BankAccount[]) {
  const today = new Date().toISOString().split('T')[0]

  const stats = {
    totalBalance: accounts.reduce((sum, a) => sum + (a.current_balance || 0), 0),
    todayIncome: transactions
      .filter(t => t.transaction_date === today && t.amount > 0 && t.status === 'explained')
      .reduce((sum, t) => sum + t.amount, 0),
    todayExpense: transactions
      .filter(t => t.transaction_date === today && t.amount < 0 && t.status === 'explained')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0),
    pendingReconcile: transactions.filter(t => t.status === 'new' || t.status === 'pending_document').length,
    fromGastoCheck: transactions.filter(t => t.imported_from === 'gastocheck').length,
    fromCobraCheck: transactions.filter(t => t.imported_from === 'cobracheck').length,
  }

  return stats
}
