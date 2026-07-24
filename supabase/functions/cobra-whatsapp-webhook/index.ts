import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!
)

serve(async (req: Request) => {
  try {
    const { client_phone, text_message } = await req.json()

    // Find client by phone
    const { data: client } = await supabase
      .from('cobra_clients')
      .select('id, company_id')
      .eq('phone', client_phone)
      .single()

    if (!client) throw new Error('Client not found')

    // Parse message (simple regex: "pagué $5000 ref 12345")
    const amountMatch = text_message.match(/\$?([\d,]+)/)
    const refMatch = text_message.match(/ref\s+(\S+)/)

    if (!amountMatch) throw new Error('No amount found in message')

    const amount = parseFloat(amountMatch[1].replace(/,/g, ''))
    const reference = refMatch ? refMatch[1] : undefined

    // Find pending invoice for client
    const { data: invoices } = await supabase
      .from('cobra_invoices')
      .select('id')
      .eq('client_id', client.id)
      .in('status', ['pending', 'partial', 'overdue'])
      .order('due_date', { ascending: false })
      .limit(1)

    if (!invoices?.length) throw new Error('No pending invoices')

    // Create payment record
    await supabase
      .from('cobra_payments')
      .insert({
        invoice_id: invoices[0].id,
        client_id: client.id,
        company_id: client.company_id,
        amount,
        payment_date: new Date().toISOString().split('T')[0],
        method: 'transfer',
        reference,
      })

    return new Response(JSON.stringify({
      success: true,
      message: '✓ Pago registrado',
      amount,
      invoice_id: invoices[0].id,
    }), { status: 200 })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400 })
  }
})
