// nomi-bank-account — Alta/actualización de datos bancarios de un empleado de
// nómina, cifrando cuenta y CLABE antes de escribir. El navegador NUNCA escribe
// ni lee estas columnas (bloqueado por grant de columna en Postgres). La llave
// de cifrado vive solo en env (CFDI_ENC_KEY), nunca en la base.
// Input:  { company_id, employee_id, bank_name?, account_number?, clabe? }
// Output: { ok: true, account_last4, clabe_last4 }
//
// Seguridad: exige payroll.manage_bank_data (via nomi_can con el JWT del
// llamante), valida que el empleado pertenezca a la empresa, valida formato de
// CLABE (18 dígitos), audita SIN guardar el número completo, es idempotente
// (upsert de la cuenta primaria activa del empleado).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? '';
const ANON_KEY         = (Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')) ?? '';
const ENC_KEY          = Deno.env.get('CFDI_ENC_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const last4 = (s: string) => s.slice(-4);

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

    // Límite de tamaño de body + parseo seguro (JSON inválido → 400 genérico,
    // sin filtrar el detalle del parser).
    const raw = await req.text();
    if (raw.length > 4000) {
      return Response.json({ error: 'Payload demasiado grande' }, { status: 413, headers: CORS });
    }
    let body: { company_id: string; employee_id: string; bank_name?: string; account_number?: string; clabe?: string };
    try { body = JSON.parse(raw || '{}'); }
    catch { return Response.json({ error: 'JSON inválido' }, { status: 400, headers: CORS }); }
    const { company_id, employee_id } = body;
    if (!company_id || !employee_id) {
      return Response.json({ error: 'company_id y employee_id son requeridos' }, { status: 400, headers: CORS });
    }

    // Capacidad: se evalúa con el JWT del llamante (auth.uid() real dentro de nomi_can)
    const { data: allowed, error: canErr } = await supabaseUser.rpc('nomi_can', {
      p_company: company_id, p_capability: 'payroll.manage_bank_data',
    });
    if (canErr) return Response.json({ error: canErr.message }, { status: 500, headers: CORS });
    if (allowed !== true) {
      return Response.json({ error: 'Sin permiso payroll.manage_bank_data' }, { status: 403, headers: CORS });
    }

    // Validaciones de formato
    const clabe = (body.clabe ?? '').replace(/\s/g, '');
    const account = (body.account_number ?? '').replace(/\s/g, '');
    if (clabe && !/^\d{18}$/.test(clabe)) {
      return Response.json({ error: 'CLABE inválida: deben ser 18 dígitos' }, { status: 400, headers: CORS });
    }
    if (account && !/^\d{4,20}$/.test(account)) {
      return Response.json({ error: 'Número de cuenta inválido' }, { status: 400, headers: CORS });
    }
    if (!clabe && !account) {
      return Response.json({ error: 'Proporcione CLABE o número de cuenta' }, { status: 400, headers: CORS });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

    // El empleado debe pertenecer a la empresa indicada (evita cruce de tenant)
    const { data: emp } = await supabase
      .from('nomi_employees')
      .select('id, company_id')
      .eq('id', employee_id)
      .maybeSingle();
    if (!emp || emp.company_id !== company_id) {
      return Response.json({ error: 'Empleado no pertenece a la empresa' }, { status: 400, headers: CORS });
    }

    // Cifrado (solo campos presentes)
    const row: Record<string, unknown> = {
      company_id, employee_id,
      bank_name: body.bank_name ?? null,
      is_primary: true, status: 'active',
      updated_by: caller.id,
    };
    if (clabe) {
      const { data: encClabe } = await supabase.rpc('pgp_encrypt_secret', { plain: clabe, enc_key: ENC_KEY });
      row.encrypted_clabe = encClabe;
      row.clabe_last4 = last4(clabe);
    }
    if (account) {
      const { data: encAcc } = await supabase.rpc('pgp_encrypt_secret', { plain: account, enc_key: ENC_KEY });
      row.encrypted_account_number = encAcc;
      row.account_last4 = last4(account);
    }

    // Idempotente: reemplaza la cuenta primaria activa del empleado si existe
    const { data: existing } = await supabase
      .from('nomi_employee_bank_accounts')
      .select('id')
      .eq('employee_id', employee_id)
      .eq('is_primary', true)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('nomi_employee_bank_accounts')
        .update(row)
        .eq('id', existing.id);
      if (error) return Response.json({ error: error.message }, { status: 500, headers: CORS });
    } else {
      row.created_by = caller.id;
      const { error } = await supabase
        .from('nomi_employee_bank_accounts')
        .insert(row);
      if (error) return Response.json({ error: error.message }, { status: 500, headers: CORS });
    }

    // Auditoría SIN datos sensibles completos (solo últimos 4)
    await supabase.from('audit_logs').insert({
      company_id, user_id: caller.id,
      entity_type: 'nomi_employee_bank_account', entity_id: employee_id,
      action: existing ? 'bank_account_updated' : 'bank_account_created',
      new_values: {
        bank_name: body.bank_name ?? null,
        clabe_last4: clabe ? last4(clabe) : null,
        account_last4: account ? last4(account) : null,
      },
    });

    return Response.json({
      ok: true,
      account_last4: account ? last4(account) : null,
      clabe_last4: clabe ? last4(clabe) : null,
    }, { headers: CORS });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500, headers: CORS });
  }
});
