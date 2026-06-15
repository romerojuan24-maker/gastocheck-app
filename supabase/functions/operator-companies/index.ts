// operator-companies — Gestiona relaciones operador ↔ empresa
// GET   /list        → lista operadores de una empresa
// POST  /add         → agrega operador a una empresa
// POST  /remove      → quita operador de una empresa
// POST  /validate    → valida que un operador pueda trabajar en una factura

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON    = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON,
    { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
  if (authErr || !user) {
    return Response.json({ error: 'No autenticado' }, { status: 401, headers: CORS });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  const url = new URL(req.url);

  try {
    const path = url.pathname.split('/').pop() ?? '';

    // GET /operator-companies/list?company_id=xxx
    if (path === 'list' && req.method === 'GET') {
      const company_id = url.searchParams.get('company_id');
      if (!company_id) {
        return Response.json({ error: 'company_id requerido' }, { status: 400, headers: CORS });
      }

      // Verificar que el user tiene acceso a esta empresa
      const { data: member } = await supabase
        .from('company_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('company_id', company_id)
        .eq('status', 'active')
        .maybeSingle();

      if (!member) {
        return Response.json({ error: 'Sin acceso a esta empresa' }, { status: 403, headers: CORS });
      }

      // Listar operadores de esta empresa
      const { data: ops } = await supabase
        .from('operator_companies')
        .select(`
          operator:operators(id, name, phone, license_number, status, assigned_vehicle_id)
        `)
        .eq('company_id', company_id)
        .order('operator(name)');

      return Response.json({
        ok: true,
        company_id,
        operators: (ops ?? []).map((o: any) => o.operator).filter(Boolean),
      }, { headers: CORS });
    }

    // POST /operator-companies/add
    // { company_id, operator_id }
    if (path === 'add' && req.method === 'POST') {
      const { company_id, operator_id } = await req.json() as any;

      if (!company_id || !operator_id) {
        return Response.json({ error: 'company_id y operator_id requeridos' }, { status: 400, headers: CORS });
      }

      // Verificar rol (solo supervisores/admin/owner)
      const { data: member } = await supabase
        .from('company_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('company_id', company_id)
        .eq('status', 'active')
        .maybeSingle();

      if (!member || !['owner', 'admin', 'supervisor'].includes(member.role)) {
        return Response.json({ error: 'Permiso denegado' }, { status: 403, headers: CORS });
      }

      // Verificar que el operador existe
      const { data: operator } = await supabase
        .from('operators')
        .select('id')
        .eq('id', operator_id)
        .maybeSingle();

      if (!operator) {
        return Response.json({ error: 'Operador no encontrado' }, { status: 404, headers: CORS });
      }

      // Agregar relación (si no existe)
      const { data, error } = await supabase
        .from('operator_companies')
        .insert({ company_id, operator_id })
        .select();

      if (error && !error.message.includes('duplicate')) {
        throw error;
      }

      return Response.json({ ok: true, company_id, operator_id }, { headers: CORS });
    }

    // POST /operator-companies/remove
    // { company_id, operator_id }
    if (path === 'remove' && req.method === 'POST') {
      const { company_id, operator_id } = await req.json() as any;

      if (!company_id || !operator_id) {
        return Response.json({ error: 'company_id y operator_id requeridos' }, { status: 400, headers: CORS });
      }

      // Verificar rol
      const { data: member } = await supabase
        .from('company_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('company_id', company_id)
        .eq('status', 'active')
        .maybeSingle();

      if (!member || !['owner', 'admin', 'supervisor'].includes(member.role)) {
        return Response.json({ error: 'Permiso denegado' }, { status: 403, headers: CORS });
      }

      // Eliminar relación
      await supabase
        .from('operator_companies')
        .delete()
        .eq('company_id', company_id)
        .eq('operator_id', operator_id);

      return Response.json({ ok: true, company_id, operator_id }, { headers: CORS });
    }

    // POST /operator-companies/validate
    // { company_id, operator_id, receipt_id }
    // Valida que un operador pueda ser asignado a una factura de una empresa
    if (path === 'validate' && req.method === 'POST') {
      const { company_id, operator_id, receipt_id } = await req.json() as any;

      if (!company_id || !operator_id || !receipt_id) {
        return Response.json({ error: 'company_id, operator_id y receipt_id requeridos' }, { status: 400, headers: CORS });
      }

      // Verificar que el operador está registrado en esa empresa
      const { data: opCompany } = await supabase
        .from('operator_companies')
        .select('id')
        .eq('company_id', company_id)
        .eq('operator_id', operator_id)
        .maybeSingle();

      if (!opCompany) {
        return Response.json({
          ok: false,
          reason: 'operator_not_in_company',
          message: 'Este operador no está registrado para esta empresa',
        }, { headers: CORS });
      }

      // Verificar que la factura pertenece a esa empresa
      const { data: receipt } = await supabase
        .from('receipts')
        .select('company_id')
        .eq('id', receipt_id)
        .maybeSingle();

      if (!receipt) {
        return Response.json({
          ok: false,
          reason: 'receipt_not_found',
          message: 'Factura no encontrada',
        }, { headers: CORS });
      }

      if (receipt.company_id !== company_id) {
        return Response.json({
          ok: false,
          reason: 'receipt_wrong_company',
          message: 'La factura no pertenece a esta empresa',
        }, { headers: CORS });
      }

      return Response.json({ ok: true }, { headers: CORS });
    }

    return Response.json({ error: 'Ruta no encontrada' }, { status: 404, headers: CORS });

  } catch (err: any) {
    console.error('operator-companies error:', err);
    return Response.json({ error: err.message ?? 'Error interno' }, { status: 500, headers: CORS });
  }
});
