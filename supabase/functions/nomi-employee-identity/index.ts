// nomi-employee-identity — Lectura AUTORIZADA de la identidad fiscal descifrada
// (RFC / NSS / CURP) de un empleado. Contraparte de nomi-employee-pii (escritura).
// El cliente jamás lee las columnas cifradas por SQL; esta es la única ruta de
// descifrado, y exige la capacidad payroll.view_identity_sensitive.
// Input:  { company_id, employee_id }
// Output: { rfc, nss, curp }   (valores en claro, solo para quien está autorizado)
//
// Seguridad: JWT obligatorio; capacidad verificada con el JWT del llamante;
// empleado debe pertenecer a la empresa; auditoría del ACCESO (sin guardar los
// valores); descifrado con CFDI_ENC_KEY vía RPC service_role; respuesta genérica
// ante errores; límite de tamaño de body.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? '';
const ANON_KEY         = (Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')) ?? '';
const ENC_KEY          = Deno.env.get('CFDI_ENC_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405, headers: CORS });

  try {
    if (!ENC_KEY) return Response.json({ error: 'Servidor sin CFDI_ENC_KEY' }, { status: 500, headers: CORS });

    // Límite de tamaño de body (defensa)
    const raw = await req.text();
    if (raw.length > 2000) return Response.json({ error: 'Payload demasiado grande' }, { status: 413, headers: CORS });

    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !caller) return Response.json({ error: 'No autenticado' }, { status: 401, headers: CORS });

    let body: { company_id?: string; employee_id?: string };
    try { body = JSON.parse(raw || '{}'); }
    catch { return Response.json({ error: 'JSON inválido' }, { status: 400, headers: CORS }); }
    const { company_id, employee_id } = body;
    if (!company_id || !employee_id || !UUID_RE.test(company_id) || !UUID_RE.test(employee_id)) {
      return Response.json({ error: 'company_id y employee_id (UUID) requeridos' }, { status: 400, headers: CORS });
    }

    // Capacidad evaluada con el JWT del llamante (auth.uid() real)
    const { data: allowed, error: canErr } = await supabaseUser.rpc('nomi_can', {
      p_company: company_id, p_capability: 'payroll.view_identity_sensitive',
    });
    if (canErr) return Response.json({ error: 'Error de autorización' }, { status: 500, headers: CORS });
    if (allowed !== true) return Response.json({ error: 'Sin permiso payroll.view_identity_sensitive' }, { status: 403, headers: CORS });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
    const { data: emp } = await supabase
      .from('nomi_employees')
      .select('company_id, encrypted_rfc, encrypted_nss, encrypted_curp')
      .eq('id', employee_id).maybeSingle();
    if (!emp || emp.company_id !== company_id) {
      return Response.json({ error: 'Empleado no pertenece a la empresa' }, { status: 400, headers: CORS });
    }

    const dec = async (v: string | null) =>
      v ? (await supabase.rpc('pgp_decrypt_secret', { enc: v, enc_key: ENC_KEY })).data : null;

    const rfc  = await dec(emp.encrypted_rfc);
    const nss  = await dec(emp.encrypted_nss);
    const curp = await dec(emp.encrypted_curp);

    // Auditar el ACCESO sensible (sin guardar los valores)
    await supabase.from('audit_logs').insert({
      company_id, user_id: caller.id,
      entity_type: 'nomi_employee', entity_id: employee_id,
      action: 'employee_identity_viewed',
      new_values: { fields: [rfc && 'rfc', nss && 'nss', curp && 'curp'].filter(Boolean) },
    });

    return Response.json({ rfc, nss, curp }, { headers: CORS });
  } catch (_e) {
    // Respuesta genérica ante errores sensibles
    return Response.json({ error: 'Error procesando la solicitud' }, { status: 500, headers: CORS });
  }
});
