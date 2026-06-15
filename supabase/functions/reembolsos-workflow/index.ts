import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const { action, reembolso_id, company_id } = await req.json()

    if (action === 'create_draft') {
      // Crear reembolso vacío en estado DRAFT
      const { data: reembolso, error: errCreate } = await supabaseClient
        .from('reembolsos')
        .insert([{
          company_id,
          employee_id: user.id,
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
      // Cambiar estado de DRAFT a PENDING_AUTH y validar SAT
      const { data: reembolso } = await supabaseClient
        .from('reembolsos')
        .select('id, status')
        .eq('id', reembolso_id)
        .single()

      if (!reembolso) throw new Error('Reembolso no encontrado')
      if (reembolso.status !== 'draft') throw new Error('Solo se pueden enviar reembolsos en estado DRAFT')

      // Obtener todos los recibos del reembolso
      const { data: receipts } = await supabaseClient
        .from('receipt_reembolsos')
        .select('receipt_id')
        .eq('reembolso_id', reembolso_id)

      if (!receipts || receipts.length === 0) {
        throw new Error('El reembolso no tiene comprobantes asignados')
      }

      // Cambiar estado a pending_auth
      const { error: errUpdate } = await supabaseClient
        .from('reembolsos')
        .update({ status: 'pending_auth' })
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
