// nomi-employee-pii — Escribe la identidad fiscal CIFRADA de un empleado
// (RFC / NSS / CURP). El cliente NUNCA escribe estas columnas (revocadas en
// Postgres); solo esta función con service_role. Guarda: valor cifrado (pgp) +
// hash ciego HMAC (para dedup/búsqueda sin descifrar) + últimos 4 (para mostrar).
// Llaves solo en env: CFDI_ENC_KEY (cifrado), NOMI_HMAC_KEY (hash ciego).
// Input:  { company_id, employee_id, rfc?, nss?, curp? }
// Output: { ok:true, rfc_last4?, nss_last4?, curp_last4? }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? '';
const ANON_KEY         = (Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')) ?? '';
const ENC_KEY          = Deno.env.get('CFDI_ENC_KEY') ?? '';
const HMAC_KEY         = Deno.env.get('NOMI_HMAC_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};
const last4 = (s: string) => s.slice(-4);
const norm  = (s: string) => s.replace(/\s/g, '').toUpperCase();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405, headers: CORS });

  try {
    if (!ENC_KEY || !HMAC_KEY) {
      return Response.json({ error: 'Servidor sin CFDI_ENC_KEY / NOMI_HMAC_KEY' }, { status: 500, headers: CORS });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !caller) return Response.json({ error: 'No autenticado' }, { status: 401, headers: CORS });

    const raw = await req.text();
    if (raw.length > 4000) return Response.json({ error: 'Payload demasiado grande' }, { status: 413, headers: CORS });
    let body: { company_id: string; employee_id: string; rfc?: string; nss?: string; curp?: string };
    try { body = JSON.parse(raw || '{}'); }
    catch { return Response.json({ error: 'JSON inválido' }, { status: 400, headers: CORS }); }
    const { company_id, employee_id } = body;
    if (!company_id || !employee_id) {
      return Response.json({ error: 'company_id y employee_id son requeridos' }, { status: 400, headers: CORS });
    }

    // Escribir identidad = gestionar empleado
    const { data: allowed, error: canErr } = await supabaseUser.rpc('nomi_can', {
      p_company: company_id, p_capability: 'payroll.manage_employees',
    });
    if (canErr) return Response.json({ error: canErr.message }, { status: 500, headers: CORS });
    if (allowed !== true) return Response.json({ error: 'Sin permiso payroll.manage_employees' }, { status: 403, headers: CORS });

    // Validaciones de formato
    const rfc  = body.rfc  ? norm(body.rfc)  : '';
    const nss  = body.nss  ? norm(body.nss)  : '';
    const curp = body.curp ? norm(body.curp) : '';
    if (rfc  && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc))  return Response.json({ error: 'RFC inválido' },  { status: 400, headers: CORS });
    if (nss  && !/^\d{11}$/.test(nss))                        return Response.json({ error: 'NSS inválido (11 dígitos)' }, { status: 400, headers: CORS });
    if (curp && !/^[A-Z0-9]{18}$/.test(curp))                return Response.json({ error: 'CURP inválida (18)' }, { status: 400, headers: CORS });
    if (!rfc && !nss && !curp) return Response.json({ error: 'Proporcione RFC, NSS o CURP' }, { status: 400, headers: CORS });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

    // El empleado debe pertenecer a la empresa
    const { data: emp } = await supabase.from('nomi_employees').select('id, company_id').eq('id', employee_id).maybeSingle();
    if (!emp || emp.company_id !== company_id) {
      return Response.json({ error: 'Empleado no pertenece a la empresa' }, { status: 400, headers: CORS });
    }

    const enc  = async (v: string) => (await supabase.rpc('pgp_encrypt_secret', { plain: v, enc_key: ENC_KEY })).data;
    const hash = async (v: string) => (await supabase.rpc('nomi_blind_hash', { plain: v, hmac_key: HMAC_KEY })).data;

    const upd: Record<string, unknown> = { updated_by: caller.id };
    if (rfc)  { upd.encrypted_rfc  = await enc(rfc);  upd.rfc_hash  = await hash(rfc);  upd.rfc_last4  = last4(rfc); }
    if (nss)  { upd.encrypted_nss  = await enc(nss);  upd.nss_hash  = await hash(nss);  upd.nss_last4  = last4(nss); }
    if (curp) { upd.encrypted_curp = await enc(curp); upd.curp_hash = await hash(curp); upd.curp_last4 = last4(curp); }

    const { error } = await supabase.from('nomi_employees').update(upd).eq('id', employee_id);
    if (error) {
      // El índice único por rfc_hash rechaza RFC duplicado en la empresa
      if (/uq_nomi_employees_company_rfc_hash|duplicate key/i.test(error.message)) {
        return Response.json({ error: 'Ese RFC ya está registrado en esta empresa' }, { status: 409, headers: CORS });
      }
      return Response.json({ error: error.message }, { status: 500, headers: CORS });
    }

    await supabase.from('audit_logs').insert({
      company_id, user_id: caller.id,
      entity_type: 'nomi_employee', entity_id: employee_id, action: 'employee_identity_updated',
      new_values: {
        rfc_last4:  rfc  ? last4(rfc)  : null,
        nss_last4:  nss  ? last4(nss)  : null,
        curp_last4: curp ? last4(curp) : null,
      },
    });

    return Response.json({
      ok: true,
      rfc_last4:  rfc  ? last4(rfc)  : null,
      nss_last4:  nss  ? last4(nss)  : null,
      curp_last4: curp ? last4(curp) : null,
    }, { headers: CORS });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500, headers: CORS });
  }
});
