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

        const { data, error: err } = await supabase
          .from('cobra_daily_reports')
          .select(
            `
            *,
            cobra_movements (
              id,
              status,
              amount,
              method,
              unpaid_reason,
              promise_date
            )
          `
          )
          .eq('actor_id', actorId)
          .eq('report_date', date)
          .single()

        if (err && err.code !== 'PGRST116') throw err

        if (!data) {
          const { data: newReport, error: createErr } = await supabase
            .from('cobra_daily_reports')
            .insert([
              {
                actor_id: actorId,
                report_date: date,
                clients_visited: 0,
                total_collected: 0,
                promises_made: 0,
              },
            ])
            .select()
            .single()

          if (createErr) throw createErr
          return newReport as DailyReport
        }

        return data as DailyReport
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
