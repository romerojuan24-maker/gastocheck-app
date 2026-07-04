import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { CASH_FLOW_RISK_META, projectCashFlow } from '@gastocheck/shared'
import type { CashFlowItem, RiskStatus } from '../types'

export function useFlujoBalance(companyId: string) {
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('bank_accounts')
        .select('current_balance')
        .eq('company_id', companyId)
        .eq('is_active', true)
      const total = (data ?? []).reduce((s, a) => s + (a.current_balance ?? 0), 0)
      setBalance(total)
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    load()
  }, [load])

  return { balance, loading, refetch: load }
}

export function useFlujoItems(companyId: string) {
  const [items, setItems] = useState<CashFlowItem[]>([])
  const [risk, setRisk] = useState<'green' | 'yellow' | 'red'>('green')
  const [projected, setProjected] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (currentBalance: number) => {
    if (!companyId) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('cash_flow_items')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_scenario', false)
        .order('expected_date', { ascending: true })
        .limit(100)

      const its = (data ?? []) as CashFlowItem[]
      setItems(its)

      const { balance, risk: r } = projectCashFlow(currentBalance, its, 7)
      setProjected(balance)
      setRisk(r)
    } finally {
      setLoading(false)
    }
  }, [companyId])

  return { items, risk, projected, loading, refetch: load }
}

export function useFlujoMutations(companyId: string) {
  const [saving, setSaving] = useState(false)

  const save = async (item: Partial<CashFlowItem>) => {
    if (!companyId) return { success: false, error: 'No company' }
    setSaving(true)
    try {
      const payload = {
        company_id: companyId,
        description: item.description?.trim() || '',
        amount: Math.abs(Number(item.amount) || 0),
        direction: item.direction || 'in',
        item_type: (item.direction || 'in') === 'in' ? 'income' : 'expense',
        expected_date: item.expected_date || new Date().toISOString().split('T')[0],
        status: item.status || 'pending',
        source: 'manual',
        notes: item.notes?.trim() || null,
      }

      let res
      if (item.id) {
        res = await supabase.from('cash_flow_items').update(payload).eq('id', item.id)
      } else {
        res = await supabase.from('cash_flow_items').insert(payload)
      }

      if (res.error) throw res.error
      return { success: true, error: null }
    } catch (err: any) {
      return { success: false, error: err.message }
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    setSaving(true)
    try {
      const { error } = await supabase.from('cash_flow_items').delete().eq('id', id)
      if (error) throw error
      return { success: true, error: null }
    } catch (err: any) {
      return { success: false, error: err.message }
    } finally {
      setSaving(false)
    }
  }

  return { save, remove, saving }
}
