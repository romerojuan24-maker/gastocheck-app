import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getActiveMembership } from '../lib/membership'
import type { CobraClient } from '@gastocheck/shared'

export function useCobrador() {
  const [user, setUser] = useState<{ id: string; company_id: string; role: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) return

      const member = await getActiveMembership(data.user.id)
      if (!member) {
        setError('No se pudo cargar el usuario')
        return
      }

      // Cobradores, supervisores, contadores y admins pueden acceder a CobraCheck
      if (!['collector', 'supervisor', 'admin', 'owner', 'superadmin', 'accountant'].includes(member.role)) {
        setError(`Acceso denegado: Tu rol no tiene acceso a CobraCheck (tienes rol: ${member.role})`)
        return
      }

      setUser({ id: data.user.id, company_id: member.company_id, role: member.role })
    })()
  }, [])

  return { user, error }
}

export function useCobraClients(companyId: string) {
  const [clients, setClients] = useState<CobraClient[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!companyId) return
    setLoading(true)
    supabase
      .from('cobra_clients')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('risk_score', { ascending: false })
      .then(({ data }) => {
        setClients((data as CobraClient[]) ?? [])
        setLoading(false)
      })
  }, [companyId])

  return { clients, loading }
}
