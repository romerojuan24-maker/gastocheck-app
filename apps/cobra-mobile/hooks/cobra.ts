import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import {
  CobraClient,
  CobraInvoice,
  CobraPayment,
  COBRA_CLIENT_STATUS_META,
} from "@gastocheck/shared"

interface UseCobraClientsResult {
  clients: CobraClient[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useCobraClients(companyId: string): UseCobraClientsResult {
  const [clients, setClients] = useState<CobraClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchClients = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error: err } = await supabase
        .from("cobra_clients")
        .select("*")
        .eq("company_id", companyId)
        .order("risk_score", { ascending: false })

      if (err) throw err
      setClients(data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (companyId) fetchClients()
  }, [companyId])

  return { clients, loading, error, refetch: fetchClients }
}

interface UseCobraInvoicesResult {
  invoices: CobraInvoice[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useCobraInvoices(
  clientId?: string,
  companyId?: string
): UseCobraInvoicesResult {
  const [invoices, setInvoices] = useState<CobraInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      setError(null)
      let query = supabase.from("cobra_invoices").select("*")

      if (companyId) query = query.eq("company_id", companyId)
      if (clientId) query = query.eq("client_id", clientId)

      const { data, error: err } = await query

      if (err) throw err
      setInvoices(data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (companyId || clientId) fetchInvoices()
  }, [companyId, clientId])

  return { invoices, loading, error, refetch: fetchInvoices }
}

interface CobradorInfo {
  id: string
  name: string
  email: string
  company_id: string
  role: "cobrador"
  current_location?: { lat: number; lng: number }
  daily_target: number // MXN
}

interface UseCobrador {
  user: CobradorInfo | null
  loading: boolean
  error: string | null
}

export function useCobrador(): UseCobrador {
  const [user, setUser] = useState<CobradorInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCobrador = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data: session } = await supabase.auth.getSession()
        if (!session?.user) throw new Error("No session")

        const { data: member, error: err } = await supabase
          .from("company_members")
          .select("id, member_name, email, company_id, role")
          .eq("auth_id", session.user.id)
          .single()

        if (err) throw err

        setUser({
          id: member.id,
          name: member.member_name,
          email: member.email,
          company_id: member.company_id,
          role: "cobrador",
          daily_target: 5000, // TODO: llevar de config
        })
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchCobrador()
  }, [])

  return { user, loading, error }
}
