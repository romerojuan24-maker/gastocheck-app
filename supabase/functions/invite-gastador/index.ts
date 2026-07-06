// invite-gastador — Crea un nuevo comprador (spender) en la empresa
// Input:  { company_id, full_name, email, role?, password? }
// Output: { ok, user_id, temp_password? }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY         = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

function randomPassword(len = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405 });

  try {
    // Verificar que el llamador es admin/owner
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !caller) {
      return Response.json({ error: 'No autenticado' }, { status: 401, headers: CORS });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

    const { company_id, full_name, email, role = 'spender', password } = await req.json() as {
      company_id: string;
      full_name:  string;
      email:      string;
      role?:      string;
      password?:  string;
    };

    if (!company_id || !full_name || !email) {
      return Response.json(
        { error: 'company_id, full_name y email son requeridos' },
        { status: 400, headers: CORS },
      );
    }

    // Verificar que el llamador tiene permisos en la empresa
    const { data: callerMember } = await supabase
      .from('company_members')
      .select('role')
      .eq('company_id', company_id)
      .eq('user_id', caller.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!callerMember || !['owner', 'admin', 'supervisor', 'accountant', 'contador_general'].includes(callerMember.role)) {
      return Response.json({ error: 'Sin permisos para invitar al equipo' }, { status: 403, headers: CORS });
    }

    // Contraseña: usar la proporcionada o generar una temporal
    const tempPassword   = password?.trim() || randomPassword();
    const isAutoPassword = !password?.trim();

    // Crear usuario en Auth
    let userId: string;
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email:          email.trim().toLowerCase(),
      password:       tempPassword,
      email_confirm:  true,
      user_metadata:  { full_name: full_name.trim() },
    });

    if (createErr) {
      // Si ya existe, recuperar el user_id
      if (createErr.message?.includes('already') || createErr.message?.includes('exists')) {
        const { data: listRes } = await supabase.auth.admin.listUsers();
        const existing = listRes?.users?.find((u: any) => u.email === email.trim().toLowerCase());
        if (!existing) {
          return Response.json({ error: createErr.message }, { status: 400, headers: CORS });
        }
        userId = existing.id;
      } else {
        return Response.json({ error: createErr.message }, { status: 400, headers: CORS });
      }
    } else {
      userId = newUser.user.id;
    }

    // Asegurar perfil con nombre
    await supabase.from('profiles').upsert(
      { id: userId, full_name: full_name.trim() },
      { onConflict: 'id' },
    );

    // Agregar como miembro de la empresa (o re-activar si ya existía)
    const { data: existingMember } = await supabase
      .from('company_members')
      .select('id')
      .eq('company_id', company_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingMember) {
      await supabase.from('company_members')
        .update({ status: 'active', role })
        .eq('id', existingMember.id);
    } else {
      await supabase.from('company_members').insert({
        company_id,
        user_id: userId,
        role,
        status: 'active',
      });
    }

    return Response.json(
      {
        ok:      true,
        user_id: userId,
        ...(isAutoPassword ? { temp_password: tempPassword } : {}),
      },
      { headers: CORS },
    );
  } catch (err: any) {
    console.error('invite-gastador error:', err);
    return Response.json({ error: err.message ?? 'Error interno' }, { status: 500, headers: CORS });
  }
});
