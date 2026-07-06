import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !caller) return Response.json({ error: 'No autenticado' }, { status: 401, headers: CORS });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { company_id, question } = await req.json();

    if (!question || !company_id) return Response.json({ error: 'Missing question or company_id' }, { status: 400, headers: CORS });

    const { data: member } = await supabase
      .from('company_members')
      .select('role')
      .eq('company_id', company_id)
      .eq('user_id', caller.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!member) return Response.json({ error: 'No perteneces a esta empresa' }, { status: 403, headers: CORS });

    // Contexto SOLO agregado (conteos/totales) — nunca nombres de cliente,
    // RFC ni montos individuales. Si algún día se integra un LLM externo
    // (Anthropic/OpenAI), el prompt debe construirse ÚNICAMENTE a partir de
    // estos agregados anonimizados ("Cliente A", no el nombre real) — nunca
    // pasar filas crudas de cobra_clients/cobra_invoices al modelo.
    const [companies, clientCount, invoiceAgg] = await Promise.all([
      supabase.from('companies').select('legal_name').eq('id', company_id).limit(1),
      supabase.from('cobra_clients').select('id', { count: 'exact', head: true }).eq('company_id', company_id),
      supabase.from('cobra_invoices').select('amount, status').eq('company_id', company_id).limit(200),
    ]);

    const totalCartera = (invoiceAgg.data ?? []).reduce((s, i: any) => s + (Number(i.amount) || 0), 0);

    // TODO: Integrar Anthropic/OpenAI aquí usando solo agregados anonimizados
    // (ver nota arriba) cuando se defina el API key server-side (Deno.env.get,
    // NUNCA NEXT_PUBLIC_* — eso lo expondría en el bundle del navegador).
    const answer = `Análisis de ${companies.data?.[0]?.legal_name ?? 'tu empresa'}: ${clientCount.count ?? 0} clientes, cartera total $${totalCartera.toFixed(2)}.`;

    await supabase.from('advisor_questions').insert({ company_id, question, answer, status: 'answered', answered_at: new Date().toISOString() });
    return Response.json({ answer }, { headers: CORS });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500, headers: CORS });
  }
});
