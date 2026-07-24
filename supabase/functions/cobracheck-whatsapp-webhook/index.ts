import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (token === Deno.env.get('WHATSAPP_VERIFY_TOKEN')) return new Response(challenge, { headers: CORS });
    return new Response('Unauthorized', { status: 401, headers: CORS });
  }

  if (req.method === 'POST') {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!);
    const body = await req.json();
    const messages = body.entry?.[0]?.changes?.[0]?.value?.messages || [];

    for (const msg of messages) {
      const phone = msg.from;
      const text = msg.text?.body || '';
      const amount = parseFloat(text.match(/\d+(?:\.\d{1,2})?/)?.[0] || '0');
      
      const { data: client } = await supabase.from('cobra_clients').select('id, company_id').eq('phone', phone).limit(1).single();
      if (client) {
        if (amount > 0) await supabase.from('cobra_payments').insert({ client_id: client.id, company_id: client.company_id, amount, payment_method: 'whatsapp', reference: text, status: 'pending' });
        await supabase.from('cobra_calls').insert({ client_id: client.id, company_id: client.company_id, call_type: 'whatsapp_incoming', message: text, call_status: 'completed' });
      }
    }
    return Response.json({ ok: true }, { headers: CORS });
  }
  return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
});
