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
      const [manual, cobros, reembolsos] = await Promise.all([
        supabase
          .from('cash_flow_items')
          .select('*')
          .eq('company_id', companyId)
          .eq('is_scenario', false)
          .order('expected_date', { ascending: true })
          .limit(100),
        supabase
          .from('cobra_invoices')
          .select('id, folio, amount, due_date, status, days_overdue, created_at, updated_at')
          .eq('company_id', companyId)
          .in('status', ['pending', 'overdue'])
          .order('due_date', { ascending: true })
          .limit(100),
        supabase
          .from('reembolsos')
          .select('id, name, total, status, created_at, updated_at')
          .eq('company_id', companyId)
          .in('status', ['pending', 'pending_auth'])
          .order('created_at', { ascending: true })
          .limit(100),
      ])

      const manualItems = (manual.data ?? []) as CashFlowItem[]

      const cobroItems: CashFlowItem[] = (cobros.data ?? []).map((c: any) => {
        const daysOverdue = c.days_overdue ?? 0
        const confidence = daysOverdue === 0 ? 'Alta confianza de cobro'
          : daysOverdue <= 15 ? `Confianza media (${daysOverdue}d de atraso)`
          : `Confianza baja (${daysOverdue}d de atraso)`

        return {
          id: `cobra_${c.id}`,
          company_id: companyId,
          description: c.folio ? `Cobro ${c.folio}` : 'Cobro pendiente',
          amount: c.amount ?? 0,
          direction: 'in',
          item_type: 'income',
          expected_date: c.due_date,
          status: c.status === 'overdue' ? 'overdue' : 'pending',
          source: 'cobracheck',
          source_id: c.id,
          is_scenario: false,
          scenario_id: null,
          notes: confidence,
          created_at: c.created_at,
          updated_at: c.updated_at,
        }
      })

      const reembolsoItems: CashFlowItem[] = (reembolsos.data ?? []).map((r: any) => ({
        id: `reembolso_${r.id}`,
        company_id: companyId,
        description: r.name ? `Reembolso: ${r.name}` : 'Reembolso pendiente',
        amount: r.total ?? 0,
        direction: 'out',
        item_type: 'expense',
        expected_date: (r.created_at ?? '').split('T')[0],
        status: 'pending',
        source: 'gastocheck',
        source_id: r.id,
        is_scenario: false,
        scenario_id: null,
        notes: null,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }))

      const its = [...manualItems, ...cobroItems, ...reembolsoItems].sort(
        (a, b) => (a.expected_date || '').localeCompare(b.expected_date || '')
      )
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
