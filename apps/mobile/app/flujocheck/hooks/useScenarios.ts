/**
 * FlujoCheck — Escenarios ("Qué pasaría si")
 * Usa cash_flow_scenarios (tabla real, ya existente desde OTA 137,
 * diseñada pero nunca conectada a ninguna pantalla) + cash_flow_items
 * con is_scenario=true/scenario_id para las hipótesis de cada escenario.
 * Inspirado en el modo de planeación de escenarios de Float/Pulse.
 */

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { projectCashFlow } from '@gastocheck/shared'
import type { CashFlowItem, RiskStatus } from '../types'

export interface CashFlowScenario {
  id: string
  company_id: string
  name: string
  description: string | null
  projected_balance: number | null
  risk_level: 'green' | 'yellow' | 'red'
  created_at: string
  updated_at: string
}

export function useScenarios(companyId: string) {
  const [scenarios, setScenarios] = useState<CashFlowScenario[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('cash_flow_scenarios')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('useScenarios.load failed:', error.message)
        setScenarios([])
      } else {
        setScenarios((data ?? []) as CashFlowScenario[])
      }
    } catch (err) {
      console.error('useScenarios.load threw:', err instanceof Error ? err.message : err)
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    load()
  }, [load])

  const createScenario = useCallback(
    async (name: string, description: string | null): Promise<CashFlowScenario | null> => {
      try {
        const { data: userData } = await supabase.auth.getUser()
        const { data, error } = await supabase
          .from('cash_flow_scenarios')
          .insert({
            company_id: companyId,
            name,
            description,
            risk_level: 'green',
            created_by: userData?.user?.id ?? null,
          })
          .select()
          .single()

        if (error) throw error
        await load()
        return data as CashFlowScenario
      } catch (err) {
        console.error('useScenarios.createScenario failed:', err instanceof Error ? err.message : err)
        return null
      }
    },
    [companyId, load]
  )

  const deleteScenario = useCallback(async (scenarioId: string): Promise<boolean> => {
    try {
      // Los ítems hipotéticos del escenario se borran junto con el escenario.
      await supabase.from('cash_flow_items').delete().eq('scenario_id', scenarioId)
      const { error } = await supabase.from('cash_flow_scenarios').delete().eq('id', scenarioId)
      if (error) throw error
      await load()
      return true
    } catch (err) {
      console.error('useScenarios.deleteScenario failed:', err instanceof Error ? err.message : err)
      return false
    }
  }, [load])

  return { scenarios, loading, createScenario, deleteScenario, refetch: load }
}

export function useScenarioItems(scenarioId: string | null) {
  const [items, setItems] = useState<CashFlowItem[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!scenarioId) { setItems([]); return }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('cash_flow_items')
        .select('*')
        .eq('scenario_id', scenarioId)
        .eq('is_scenario', true)
        .order('expected_date', { ascending: true })

      if (error) {
        console.error('useScenarioItems.load failed:', error.message)
        setItems([])
      } else {
        setItems((data ?? []) as CashFlowItem[])
      }
    } finally {
      setLoading(false)
    }
  }, [scenarioId])

  useEffect(() => {
    load()
  }, [load])

  const addAdjustment = useCallback(
    async (companyId: string, item: Partial<CashFlowItem>): Promise<boolean> => {
      if (!scenarioId) return false
      try {
        const { error } = await supabase.from('cash_flow_items').insert({
          company_id: companyId,
          description: item.description?.trim() || 'Ajuste hipotético',
          amount: Math.abs(Number(item.amount) || 0),
          direction: item.direction || 'in',
          item_type: (item.direction || 'in') === 'in' ? 'income' : 'expense',
          expected_date: item.expected_date || new Date().toISOString().split('T')[0],
          status: 'pending',
          source: 'manual',
          is_scenario: true,
          scenario_id: scenarioId,
          notes: item.notes?.trim() || null,
        })
        if (error) throw error
        await load()
        return true
      } catch (err) {
        console.error('useScenarioItems.addAdjustment failed:', err instanceof Error ? err.message : err)
        return false
      }
    },
    [scenarioId, load]
  )

  const removeAdjustment = useCallback(async (itemId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('cash_flow_items').delete().eq('id', itemId)
      if (error) throw error
      await load()
      return true
    } catch (err) {
      console.error('useScenarioItems.removeAdjustment failed:', err instanceof Error ? err.message : err)
      return false
    }
  }, [load])

  return { items, loading, addAdjustment, removeAdjustment, refetch: load }
}

/**
 * Calcula y persiste el saldo proyectado + nivel de riesgo del escenario
 * (baseline real + ajustes hipotéticos) sobre cash_flow_scenarios.
 */
export async function computeAndSaveScenarioProjection(
  scenarioId: string,
  currentBalance: number,
  baselineItems: CashFlowItem[],
  scenarioItems: CashFlowItem[],
  horizonDays: number = 30
): Promise<{ balance: number; risk: RiskStatus }> {
  const combined = [...baselineItems, ...scenarioItems]
  const { balance, risk } = projectCashFlow(currentBalance, combined as any, horizonDays)

  await supabase
    .from('cash_flow_scenarios')
    .update({ projected_balance: balance, risk_level: risk, updated_at: new Date().toISOString() })
    .eq('id', scenarioId)

  return { balance, risk }
}
