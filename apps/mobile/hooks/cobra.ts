import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CobraClient } from '@gastocheck/shared'

export function useCobrador() {
  const [user, setUser] = useState<{ id: string; company_id: string } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', data.user.id)
        .single()
        .then(({ data: member }) => {
          if (member) setUser({ id: data.user!.id, company_id: member.company_id })
        })
    })
  }, [])

  return { user }
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
