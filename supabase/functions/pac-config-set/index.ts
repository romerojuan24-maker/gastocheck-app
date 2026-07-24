// pac-config-set — Guarda config del proveedor PAC (Facturama/FacturaPía)
// cifrando pac_user/pac_pass antes de escribir. El navegador NUNCA escribe
// estas columnas directamente (bloqueado a nivel de columna en Postgres).
// Input:  { company_id, provider, rfc, razon_social?, regimen_fiscal?,
//           codigo_postal_fiscal?, pac_user?, pac_pass?, mode?, is_active? }
// Output: { ok: true }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? '';
const ANON_KEY         = (Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')) ?? '';
const ENC_KEY          = Deno.env.get('CFDI_ENC_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405, headers: CORS });

  try {
    if (!ENC_KEY) {
      return Response.json({ error: 'Servidor sin CFDI_ENC_KEY configurada' }, { status: 500, headers: CORS });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !caller) {
      return Response.json({ error: 'No autenticado' }, { status: 401, headers: CORS });
    }

    const body = await req.json() as {
      company_id: string; provider: string; rfc: string;
      razon_social?: string; regimen_fiscal?: string; codigo_postal_fiscal?: string;
      pac_user?: string; pac_pass?: string; mode?: string; is_active?: boolean;
    };
    const { company_id, provider, rfc } = body;
    if (!company_id || !provider || !rfc) {
      return Response.json({ error: 'company_id, provider y rfc son requeridos' }, { status: 400, headers: CORS });
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
      return Response.json({ error: 'Sin permisos para configurar el PAC' }, { status: 403, headers: CORS });
    }

    // Solo re-cifrar los campos que realmente vienen en el body — así el
    // formulario puede actualizar RFC/modo sin tener que reenviar la
    // contraseña cada vez (el usuario ve un campo vacío, no el valor real).
    const update: Record<string, unknown> = {
      company_id, provider, rfc,
      razon_social: body.razon_social ?? null,
      regimen_fiscal: body.regimen_fiscal ?? null,
      codigo_postal_fiscal: body.codigo_postal_fiscal ?? null,
      mode: body.mode ?? 'sandbox',
      is_active: body.is_active ?? false,
    };

    if (body.pac_user) {
      const { data: encUser } = await supabase.rpc('pgp_encrypt_secret', { plain: body.pac_user, enc_key: ENC_KEY });
      update.pac_user_enc = encUser;
    }
    if (body.pac_pass) {
      const { data: encPass } = await supabase.rpc('pgp_encrypt_secret', { plain: body.pac_pass, enc_key: ENC_KEY });
      update.pac_pass_enc = encPass;
    }

    const { error } = await supabase
      .from('cfdi_provider_configs')
      .upsert(update, { onConflict: 'company_id,provider' });

    if (error) return Response.json({ error: error.message }, { status: 500, headers: CORS });

    await supabase.from('audit_logs').insert({
      company_id, user_id: caller.id,
      entity_type: 'cfdi_provider_config', entity_id: company_id,
      action: 'pac_config_updated',
      new_values: { provider, rfc, mode: update.mode, is_active: update.is_active, credentials_changed: !!(body.pac_user || body.pac_pass) },
    });

    return Response.json({ ok: true }, { headers: CORS });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500, headers: CORS });
  }
});
