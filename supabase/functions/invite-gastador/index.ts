// Edge Function: invite-gastador
// Crea un usuario Auth + perfil + membresía en company_members.
// Solo puede ser llamada por un owner o admin de la empresa.
// Deploy: npx supabase functions deploy invite-gastador

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')             ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface InviteBody {
  company_id: string;
  full_name:  string;
  email:      string;
  password?:  string;
  role?:      string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Genera contraseña temporal: 'Gasto' + 4 dígitos + '!' */
function generateTempPassword(): string {
  const digits = Math.floor(1000 + Math.random() * 9000).toString();
  return `Gasto${digits}!`;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request): Promise<Response> => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  // -------------------------------------------------------------------------
  // Autenticación del caller
  // -------------------------------------------------------------------------
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ ok: false, error: 'Missing Authorization header' }, 401);
  }
  const callerToken = authHeader.replace('Bearer ', '').trim();

  // Cliente con service role (para operaciones admin)
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verificar que el token es válido y obtener el caller
  const { data: callerData, error: callerErr } = await admin.auth.getUser(callerToken);
  if (callerErr || !callerData?.user) {
    return jsonResponse({ ok: false, error: 'Invalid or expired token' }, 401);
  }
  const callerId = callerData.user.id;

  // -------------------------------------------------------------------------
  // Parsear body
  // -------------------------------------------------------------------------
  let body: InviteBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const { company_id, full_name, email, password, role } = body;

  // -------------------------------------------------------------------------
  // Validación de campos obligatorios
  // -------------------------------------------------------------------------
  if (!company_id || typeof company_id !== 'string' || company_id.trim() === '') {
    return jsonResponse({ ok: false, error: 'company_id es requerido' }, 400);
  }
  if (!full_name || typeof full_name !== 'string' || full_name.trim() === '') {
    return jsonResponse({ ok: false, error: 'full_name es requerido' }, 400);
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return jsonResponse({ ok: false, error: 'email válido es requerido' }, 400);
  }
  if (password !== undefined && password !== null) {
    if (typeof password !== 'string' || password.length < 8) {
      return jsonResponse({ ok: false, error: 'La contraseña debe tener al menos 8 caracteres' }, 400);
    }
  }

  // -------------------------------------------------------------------------
  // Verificar que el caller es owner o admin de la empresa
  // -------------------------------------------------------------------------
  const { data: membership, error: memberErr } = await admin
    .from('company_members')
    .select('role, status')
    .eq('company_id', company_id)
    .eq('user_id', callerId)
    .eq('status', 'active')
    .in('role', ['owner', 'admin'])
    .maybeSingle();

  if (memberErr) {
    console.error('Error checking caller membership:', memberErr);
    return jsonResponse({ ok: false, error: 'Error verificando permisos' }, 500);
  }
  if (!membership) {
    return jsonResponse(
      { ok: false, error: 'No tienes permisos para invitar miembros a esta empresa' },
      403,
    );
  }

  // -------------------------------------------------------------------------
  // Determinar contraseña final
  // -------------------------------------------------------------------------
  const isPasswordGenerated = !password;
  const finalPassword = password ?? generateTempPassword();

  // -------------------------------------------------------------------------
  // Crear usuario en Auth
  // -------------------------------------------------------------------------
  const { data: createData, error: createErr } = await admin.auth.admin.createUser({
    email:          email.trim().toLowerCase(),
    password:       finalPassword,
    email_confirm:  true,
    user_metadata: {
      full_name: full_name.trim(),
    },
  });

  if (createErr) {
    const msg = createErr.message ?? '';
    // Supabase devuelve "already registered" cuando el email existe
    if (
      msg.toLowerCase().includes('already registered') ||
      msg.toLowerCase().includes('already been registered') ||
      msg.toLowerCase().includes('user already exists')
    ) {
      return jsonResponse(
        {
          ok:    false,
          error: `El correo ${email} ya está registrado en el sistema. Usa otro correo o comunícate con soporte.`,
          code:  'EMAIL_ALREADY_REGISTERED',
        },
        409,
      );
    }
    console.error('Error creating auth user:', createErr);
    return jsonResponse({ ok: false, error: `Error creando usuario: ${msg}` }, 500);
  }

  const newUser = createData.user;
  if (!newUser) {
    return jsonResponse({ ok: false, error: 'No se pudo crear el usuario' }, 500);
  }

  // -------------------------------------------------------------------------
  // Insertar perfil
  // -------------------------------------------------------------------------
  const { error: profileErr } = await admin
    .from('profiles')
    .insert({
      id:        newUser.id,
      full_name: full_name.trim(),
    });

  if (profileErr) {
    // El perfil puede ya existir si hay un trigger on-auth-create; tolerar el error
    // solo si es de conflicto (código 23505), pero logueamos cualquier otro.
    if (profileErr.code !== '23505') {
      console.error('Error inserting profile:', profileErr);
      // No revertimos el usuario — el perfil se puede crear manualmente; pero
      // intentamos continuar para al menos crear la membresía.
    }
  }

  // -------------------------------------------------------------------------
  // Insertar membresía
  // -------------------------------------------------------------------------
  const assignedRole = role?.trim() || 'spender';

  const { error: memberInsertErr } = await admin
    .from('company_members')
    .insert({
      company_id,
      user_id: newUser.id,
      role:    assignedRole,
      status:  'active',
    });

  if (memberInsertErr) {
    console.error('Error inserting company_member:', memberInsertErr);
    // En este punto el usuario Auth y el perfil ya existen; informamos del error
    // para que el caller pueda tomar acción (p.ej. re-intentar solo la membresía).
    return jsonResponse(
      {
        ok:      false,
        error:   `Usuario creado (${newUser.id}) pero no se pudo agregar a la empresa: ${memberInsertErr.message}`,
        user_id: newUser.id,
      },
      500,
    );
  }

  // -------------------------------------------------------------------------
  // Respuesta exitosa
  // -------------------------------------------------------------------------
  const responseBody: Record<string, unknown> = {
    ok:      true,
    user_id: newUser.id,
    message: `${full_name.trim()} ha sido agregado a la empresa con el rol "${assignedRole}".`,
  };

  if (isPasswordGenerated) {
    responseBody.temp_password = finalPassword;
  }

  return jsonResponse(responseBody, 201);
});
