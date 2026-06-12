// create-company — Crea empresa para usuario ya autenticado sin empresa asignada
// Requiere Authorization: Bearer <access_token>
// Deploy: supabase functions deploy create-company

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const TRIAL_DAYS = 30;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405 });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return Response.json({ error: 'Se requiere autenticación' }, { status: 401, headers: CORS });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) {
      return Response.json({ error: 'Sesión inválida' }, { status: 401, headers: CORS });
    }

    const { company_name } = await req.json() as { company_name: string };
    if (!company_name?.trim()) {
      return Response.json({ error: 'company_name es requerido' }, { status: 400, headers: CORS });
    }

    // Verificar que el usuario no tenga ya una empresa
    const { data: existing } = await admin
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      return Response.json(
        { error: 'Este usuario ya pertenece a una empresa.' },
        { status: 409, headers: CORS },
      );
    }

    // Crear empresa con trial
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: company, error: compErr } = await admin
      .from('companies')
      .insert({
        name:          company_name.trim(),
        created_by:    user.id,
        plan:          'basico',
        plan_seats:    2,
        trial_ends_at: trialEndsAt,
      })
      .select('id')
      .single();

    if (compErr || !company) {
      return Response.json(
        { error: compErr?.message ?? 'Error creando empresa' },
        { status: 500, headers: CORS },
      );
    }

    // Agregar usuario como admin
    const { error: memberErr } = await admin
      .from('company_members')
      .insert({
        company_id: company.id,
        user_id:    user.id,
        role:       'admin',
        status:     'active',
      });

    if (memberErr) {
      return Response.json({ error: memberErr.message }, { status: 500, headers: CORS });
    }

    return Response.json({
      ok:            true,
      company_id:    company.id,
      trial_ends_at: trialEndsAt,
      trial_days:    TRIAL_DAYS,
    }, { headers: CORS });

  } catch (err: any) {
    console.error('create-company error:', err);
    return Response.json({ error: err.message }, { status: 500, headers: CORS });
  }
});
