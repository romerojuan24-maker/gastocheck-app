import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!
)

serve(async (req: Request) => {
  try {
    const { invoice_id, uuid_cfdi } = await req.json()
    if (!invoice_id || !uuid_cfdi) throw new Error('invoice_id and uuid_cfdi required')

    // TODO: Call real SAT API (https://consulta.sat.gob.mx)
    // For now, mock validation
    const isValid = uuid_cfdi.length === 36 && uuid_cfdi.includes('-')

    // Update invoice
    const status = isValid ? 'pending' : 'cancelled'
    const { error } = await supabase
      .from('cobra_invoices')
      .update({
        uuid_sat: uuid_cfdi,
        status,
      })
      .eq('id', invoice_id)

    if (error) throw error

    return new Response(JSON.stringify({
      valid: isValid,
      sat_status: status,
      invoice_id,
      uuid_cfdi,
    }), { status: 200 })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400 })
  }
})
