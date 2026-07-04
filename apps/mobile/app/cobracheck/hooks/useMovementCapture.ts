import { useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Movement } from '../types'

export function useMovementCapture() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const capture = useCallback(
    async (data: Omit<Movement, 'id'>) => {
      try {
        setLoading(true)
        setError(null)

        const { data: movement, error: err } = await supabase
          .from('cobra_movements')
          .insert([
            {
              ...data,
              route_point_ts: data.route_point_ts ?? new Date().toISOString(),
            },
          ])
          .select()
          .single()

        if (err) throw err
        return movement
      } catch (err: any) {
        setError(err.message)
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { capture, loading, error }
}
