import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import type { RouteClient } from '../types'

export function useRoute(actorId: string, date: string) {
  const [route, setRoute] = useState<RouteClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRoute = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: err } = await supabase
        .from('daily_routes')
        .select(
          `
          id,
          client_id,
          sequence,
          distance_km,
          eta_minutes,
          status,
          cobra_clients (
            id,
            name,
            lat,
            lng,
            address,
            phone,
            office_hours
          ),
          cobra_invoices (
            id,
            amount,
            status
          )
        `
        )
        .eq('actor_id', actorId)
        .eq('route_date', date)
        .order('sequence', { ascending: true })

      if (err) throw err

      const clients: RouteClient[] = (data || []).map((route: any) => ({
        id: route.cobra_clients.id,
        name: route.cobra_clients.name,
        lat: route.cobra_clients.lat,
        lng: route.cobra_clients.lng,
        address: route.cobra_clients.address,
        phone: route.cobra_clients.phone,
        office_hours: route.cobra_clients.office_hours,
        distance: route.distance_km,
        eta: route.eta_minutes,
        status: route.status,
        invoices_count: route.cobra_invoices.length,
        total_amount: route.cobra_invoices.reduce(
          (sum: number, inv: any) => sum + inv.amount,
          0
        ),
      }))

      setRoute(clients)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [actorId, date])

  useEffect(() => {
    if (actorId && date) fetchRoute()
  }, [actorId, date, fetchRoute])

  return { route, loading, error, refetch: fetchRoute }
}
