// register-company — Crea usuario + empresa + miembro en una operación atómica
// Usa Admin API para bypassear RLS (el cliente no tiene sesión durante signUp)
// Deploy: supabase functions deploy register-company

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
    const { email, password, company_name, device_id } = await req.json() as {
      email:        string;
      password:     string;
      company_name: string;
      device_id?:   string;
    };

    if (!email?.trim() || !password || !company_name?.trim()) {
      return Response.json(
        { error: 'email, password y company_name son requeridos' },
        { status: 400, headers: CORS },
      );
    }
    if (password.length < 8) {
      return Response.json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400, headers: CORS },
      );
    }

    // Admin client — bypasses RLS
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 1. Verificar que el dispositivo no tenga ya un trial activo ──────────
    if (device_id) {
      const { data: existingDevice } = await admin
        .from('trial_devices')
        .select('company_id')
        .eq('device_id', device_id)
        .maybeSingle();

      if (existingDevice) {
        return Response.json({
          error: 'Este dispositivo ya tiene una cuenta de prueba registrada.\n\nInicia sesión con tu cuenta original o escríbenos a soporte@gastocheck.app.',
          code: 'TRIAL_DEVICE_EXISTS',
        }, { status: 409, headers: CORS });
      }
    }

    // ── 2. Crear usuario Auth (confirmado de inmediato — no requiere email) ──
    const { data: { user }, error: userErr } = await admin.auth.admin.createUser({
      email:         email.trim().toLowerCase(),
      password,
      email_confirm: true,   // confirmar sin clic — evita el loop de rate limit
    });

    if (userErr || !user) {
      const msg = userErr?.message ?? '';
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        return Response.json(
          { error: 'Este correo ya tiene una cuenta. Inicia sesión en lugar de registrarte.' },
          { status: 409, headers: CORS },
        );
      }
      return Response.json(
        { error: msg || 'Error creando usuario' },
        { status: 400, headers: CORS },
      );
    }

    // ── 3. Crear/upsert perfil de usuario ────────────────────────────────────
    // Precondición para company_members: debe existir fila en profiles
    const { error: profileErr } = await admin
      .from('profiles')
      .upsert({ id: user.id }, { onConflict: 'id' });

    if (profileErr) {
      await admin.auth.admin.deleteUser(user.id);
      return Response.json(
        { error: `Error creando perfil: ${profileErr.message}` },
        { status: 500, headers: CORS },
      );
    }

    // ── 4. Crear empresa con trial de 30 días ────────────────────────────────
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: company, error: compErr } = await admin
      .from('companies')
      .insert({
        name:            company_name.trim(),
        created_by:      user.id,
        plan:            'basico',
        plan_seats:      2,          // trial: 1 dueño + 1 gastador
        trial_ends_at:   trialEndsAt,
        trial_device_id: device_id ?? null,
      })
      .select('id')
      .single();

    if (compErr || !company) {
      await admin.auth.admin.deleteUser(user.id);
      return Response.json(
        { error: compErr?.message ?? 'Error creando empresa' },
        { status: 500, headers: CORS },
      );
    }

    // ── 5. Crear miembro dueño (rol 'admin' = acceso total) ──────────────────
    const { error: memberErr } = await admin
      .from('company_members')
      .insert({
        company_id: company.id,
        user_id:    user.id,
        role:       'admin',
        status:     'active',
      });

    if (memberErr) {
      // Compensación: eliminar empresa si la membresía falla
      await admin.from('companies').delete().eq('id', company.id);
      await admin.auth.admin.deleteUser(user.id);
      return Response.json(
        { error: `Error creando membresía: ${memberErr.message}` },
        { status: 500, headers: CORS },
      );
    }

    // ── 6. Registrar dispositivo para prevención de abuso de trial ───────────
    if (device_id) {
      const { error: deviceErr } = await admin.from('trial_devices').insert({
        device_id,
        company_id: company.id,
      });

      if (deviceErr) {
        // Compensación: eliminar empresa y membresía si trial_devices falla
        await admin.from('company_members').delete().eq('company_id', company.id);
        await admin.from('companies').delete().eq('id', company.id);
        await admin.auth.admin.deleteUser(user.id);
        return Response.json(
          { error: `Error registrando dispositivo: ${deviceErr.message}` },
          { status: 500, headers: CORS },
        );
      }
    }

    return Response.json({
      ok:            true,
      user_id:       user.id,
      company_id:    company.id,
      trial_ends_at: trialEndsAt,
      trial_days:    TRIAL_DAYS,
    }, { headers: CORS });

  } catch (err: any) {
    console.error('register-company error:', err);
    return Response.json({ error: err.message }, { status: 500, headers: CORS });
  }
});
