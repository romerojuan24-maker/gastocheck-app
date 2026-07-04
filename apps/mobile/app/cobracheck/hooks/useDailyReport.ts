import { useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import type { DailyReport } from '../types'

export function useDailyReport() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(
    async (actorId: string, date: string): Promise<DailyReport | null> => {
      try {
        setLoading(true)
        setError(null)

        // Compute report from cobra_movements (no separate daily_reports table)
        const { data: movements, error: err } = await supabase
          .from('cobra_movements')
          .select('id, movement_type, collected_amount, promise_date, client_id, user_id')
          .eq('user_id', actorId)
          .gte('route_point_ts', `${date}T00:00:00`)
          .lte('route_point_ts', `${date}T23:59:59`)

        if (err) throw err

        const movs = movements || []
        const collected = movs.filter((m: any) => m.movement_type === 'collected')
        const promises = movs.filter((m: any) => m.movement_type === 'promise')
        const uniqueClients = new Set(movs.map((m: any) => m.client_id)).size

        const report: DailyReport = {
          actor_id: actorId,
          report_date: date,
          clients_visited: uniqueClients,
          total_collected: collected.reduce((sum: number, m: any) => sum + (m.collected_amount || 0), 0),
          cash_deposits: [],
          promises_made: promises.length,
          movements: [],
          created_at: new Date().toISOString(),
        }

        return report
      } catch (err: any) {
        setError(err.message)
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { generate, loading, error }
}
