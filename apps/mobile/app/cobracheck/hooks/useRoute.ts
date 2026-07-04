import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import type { RouteClient } from '../types'

export function useRoute(actorId: string, date: string) {
  const [route, setRoute] = useState<RouteClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRoute = useCallback(async () => {
    if (!actorId || !date) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)

      // Get today's assigned route
      const { data: routeData, error: routeErr } = await supabase
        .from('cobra_routes')
        .select('id, clients_assigned, status')
        .eq('actor_id', actorId)
        .eq('assigned_date', date)
        .maybeSingle()

      if (routeErr) throw routeErr
      if (!routeData || !routeData.clients_assigned?.length) {
        setRoute([])
        return
      }

      // Fetch clients assigned to this route
      const { data: clientsData, error: clientsErr } = await supabase
        .from('cobra_clients')
        .select('id, name, phone, current_balance, risk_score, status')
        .in('id', routeData.clients_assigned)
        .eq('status', 'active')

      if (clientsErr) throw clientsErr

      // Fetch pending invoices for these clients
      const { data: invoicesData, error: invErr } = await supabase
        .from('cobra_invoices')
        .select('id, client_id, total_amount, status')
        .in('client_id', routeData.clients_assigned)
        .in('status', ['pending', 'overdue'])

      if (invErr) throw invErr

      const clients: RouteClient[] = (clientsData || []).map((c: any) => {
        const clientInvoices = (invoicesData || []).filter((inv: any) => inv.client_id === c.id)
        return {
          id: c.id,
          name: c.name,
          phone: c.phone ?? undefined,
          status: 'pending' as const,
          invoices_count: clientInvoices.length,
          total_amount: clientInvoices.reduce((sum: number, inv: any) => sum + (inv.total_amount || 0), 0),
        }
      })

      setRoute(clients)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [actorId, date])

  useEffect(() => {
    fetchRoute()
  }, [fetchRoute])

  return { route, loading, error, refetch: fetchRoute }
}
