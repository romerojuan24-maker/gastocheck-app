import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!
)

serve(async (req: Request) => {
  try {
    const { company_id } = await req.json()
    if (!company_id) throw new Error('company_id required')

    // Fetch all clients for company
    const { data: clients } = await supabase
      .from('cobra_clients')
      .select('id')
      .eq('company_id', company_id)

    if (!clients?.length) return new Response(JSON.stringify({ updated_count: 0 }), { status: 200 })

    // For each client, calculate risk score
    const scores = await Promise.all(clients.map(async (c) => {
      // Fetch invoices
      const { data: invoices } = await supabase
        .from('cobra_invoices')
        .select('days_overdue, status, amount')
        .eq('client_id', c.id)

      // Fetch client balance
      const { data: client } = await supabase
        .from('cobra_clients')
        .select('credit_limit, current_balance')
        .eq('id', c.id)
        .single()

      if (!invoices || !client) return null

      // Calculate factors
      const maxDaysOverdue = Math.max(...invoices.map(i => i.days_overdue || 0), 0)
      const utilization = client.credit_limit > 0 ? (client.current_balance / client.credit_limit) * 100 : 0
      const paidCount = invoices.filter(i => i.status === 'paid').length
      const paymentHistory = invoices.length > 0 ? (paidCount / invoices.length) * 100 : 100

      // Score formula: 40% days_overdue + 30% utilization + 30% payment_history
      const score = Math.min(100, Math.round(
        (Math.min(maxDaysOverdue, 180) / 180 * 0.4 * 100) +
        (Math.min(utilization, 100) / 100 * 0.3 * 100) +
        ((100 - paymentHistory) / 100 * 0.3 * 100)
      ))

      return { client_id: c.id, score }
    }))

    // Update scores in DB
    await Promise.all(scores.filter(Boolean).map(async (s) => {
      await supabase
        .from('cobra_clients')
        .update({ risk_score: s!.score })
        .eq('id', s!.client_id)
    }))

    return new Response(JSON.stringify({
      updated_count: scores.filter(Boolean).length,
      client_scores: scores.filter(Boolean),
    }), { status: 200 })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400 })
  }
})
