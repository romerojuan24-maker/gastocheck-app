// pac-config-get — Devuelve la config del PAC SIN las credenciales reales.
// El formulario web nunca debe pre-llenar el password verdadero; solo
// indicamos si ya hay uno guardado (pac_user_set / pac_pass_set).
// Input:  { company_id }  (POST body)
// Output: { config: {...sin _enc...} | null }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? '';
const ANON_KEY         = (Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')) ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405, headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !caller) {
      return Response.json({ error: 'No autenticado' }, { status: 401, headers: CORS });
    }

    const { company_id } = await req.json() as { company_id?: string };
    if (!company_id) {
      return Response.json({ error: 'company_id es requerido' }, { status: 400, headers: CORS });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

    const { data: member } = await supabase
      .from('company_members')
      .select('role')
      .eq('company_id', company_id)
      .eq('user_id', caller.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return Response.json({ error: 'Sin permisos para ver la configuración del PAC' }, { status: 403, headers: CORS });
    }

    const { data: cfg } = await supabase
      .from('cfdi_provider_configs')
      .select('provider, rfc, razon_social, regimen_fiscal, codigo_postal_fiscal, mode, is_active, pac_user_enc, pac_pass_enc, last_validated, validation_error')
      .eq('company_id', company_id)
      .maybeSingle();

    if (!cfg) return Response.json({ config: null }, { headers: CORS });

    const { pac_user_enc, pac_pass_enc, ...rest } = cfg;
    return Response.json({
      config: {
        ...rest,
        pac_user_set: !!pac_user_enc,
        pac_pass_set: !!pac_pass_enc,
      },
    }, { headers: CORS });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500, headers: CORS });
  }
});
