import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import type { BankAccount, BankTransaction } from '../types'

export function useBancoAccounts(companyId: string) {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
      setAccounts((data ?? []) as BankAccount[])
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    load()
  }, [load])

  return { accounts, loading, refetch: load }
}

export function useBancoTransactions(companyId: string, accountId?: string) {
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
        .limit(200)

      if (accountId) {
        query = query.eq('bank_account_id', accountId)
      }

      const { data } = await query
      setTransactions((data ?? []) as BankTransaction[])
    } finally {
      setLoading(false)
    }
  }, [companyId, accountId])

  useEffect(() => {
    load()
  }, [load])

  return { transactions, loading, refetch: load }
}

export function useBancoClassify(companyId: string) {
  const [saving, setSaving] = useState(false)

  const classify = async (transactionId: string, category: string, status: string) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('bank_transactions')
        .update({ category, status })
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
        .update({ category: null, status: 'new' })
        .eq('id', transactionId)

      if (error) throw error
      return { success: true, error: null }
    } catch (err: any) {
      return { success: false, error: err.message }
    } finally {
      setSaving(false)
    }
  }

  return { classify, reset, saving }
}
