import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { company_id, question } = await req.json();
    
    if (!question || !company_id) return Response.json({ error: 'Missing question or company_id' }, { status: 400, headers: CORS });

    // Fetch context
    const [companies, clients, invoices] = await Promise.all([
      supabase.from('companies').select('*').eq('id', company_id).limit(1),
      supabase.from('cobra_clients').select('name, balance_due').eq('company_id', company_id).limit(5),
      supabase.from('cobra_invoices').select('amount, status').eq('company_id', company_id).limit(10),
    ]);

    // TODO: Integrate Anthropic API here when ANTHROPIC_API_KEY available
    const answer = `Análisis de ${companies.data?.[0]?.legal_name}: ${clients.data?.length || 0} clientes, ${invoices.data?.length || 0} facturas.`;

    await supabase.from('advisor_questions').insert({ company_id, question, answer, status: 'answered', answered_at: new Date().toISOString() });
    return Response.json({ answer }, { headers: CORS });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500, headers: CORS });
  }
});
