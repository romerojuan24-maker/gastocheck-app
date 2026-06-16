import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url     = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    // Admin client bypasa RLS para todas las queries internas
    const supabaseAdmin = createClient(
      url,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Verificar JWT del usuario con cliente anon
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    const supabaseAnon = createClient(url, anonKey)
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const { action, reembolso_id, company_id } = await req.json()

    if (action === 'create_draft') {
      const { data: reembolso, error: errCreate } = await supabaseAdmin
        .from('reembolsos')
        .insert([{
          company_id,
          employee_id: user.id,
          employee_email: user.email ?? '',
          status: 'draft',
          total: 0,
          notes: '',
        }])
        .select('id')
        .single()

      if (errCreate) throw errCreate
      return new Response(JSON.stringify({ success: true, reembolso_id: reembolso.id }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    if (action === 'submit') {
      const { data: reembolso } = await supabaseAdmin
        .from('reembolsos')
        .select('id, status, employee_id')
        .eq('id', reembolso_id)
        .single()

      if (!reembolso) throw new Error('Reembolso no encontrado')
      if (reembolso.employee_id !== user.id) throw new Error('No autorizado')
      if (reembolso.status !== 'draft') throw new Error('Solo se pueden enviar reembolsos en estado DRAFT')

      const { data: receipts } = await supabaseAdmin
        .from('receipt_reembolsos')
        .select('receipt_id')
        .eq('reembolso_id', reembolso_id)

      if (!receipts || receipts.length === 0) {
        throw new Error('El reembolso no tiene comprobantes asignados')
      }

      // Calcular total sumando los montos de los comprobantes
      const receiptIds = receipts.map((r: any) => r.receipt_id)
      const { data: receiptData } = await supabaseAdmin
        .from('receipts')
        .select('total_amount')
        .in('id', receiptIds)

      const total = (receiptData ?? []).reduce((s: number, r: any) => s + (r.total_amount ?? 0), 0)

      const { error: errUpdate } = await supabaseAdmin
        .from('reembolsos')
        .update({ status: 'pending_auth', total })
        .eq('id', reembolso_id)

      if (errUpdate) throw errUpdate

      return new Response(JSON.stringify({ success: true, message: 'Reembolso enviado a supervisor' }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
