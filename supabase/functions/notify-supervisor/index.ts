// notify-supervisor — Envía notificación a supervisores cuando receipt es submitted
// Llamada por submit-receipt, authorize-expense, otros flujos
// Input: { company_id, type, title, message, data?, recipient_id? }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

interface NotifyInput {
  company_id: string;
  type: string;
  title: string;
  message?: string;
  data?: Record<string, unknown>;
  recipient_id?: string; // Si no se especifica, envía a todos los supervisores
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUser = createClient(
      SUPABASE_URL,
      (Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')) ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401, headers: CORS });
    }

    // 🟠 FIX BUG #10: Validar que usuario es miembro de la empresa
    const supabase = createClient(SUPABASE_URL, (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? '');
    const input: NotifyInput = await req.json();
    const { company_id, type, title, message, data, recipient_id } = input;

    if (!company_id || !type || !title) {
      return Response.json(
        { error: 'company_id, type, title are required' },
        { status: 400, headers: CORS },
      );
    }

    // Validar acceso a empresa
    const { data: member } = await supabase
      .from('company_members')
      .select('role')
      .eq('company_id', company_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return Response.json({ error: 'No member of company' }, { status: 403, headers: CORS });
    }

    let recipients: string[] = [];

    if (recipient_id) {
      recipients = [recipient_id];
    } else {
      // Obtener todos los supervisores/admins de la empresa
      const { data: members } = await supabase
        .from('company_members')
        .select('user_id')
        .eq('company_id', company_id)
        .in('role', ['admin', 'supervisor']);

      recipients = (members ?? []).map((m: any) => m.user_id);
    }

    if (recipients.length === 0) {
      return Response.json({ ok: true, count: 0 }, { headers: CORS });
    }

    // Crear notificaciones para cada receptor
    const notifications = recipients.map((uid) => ({
      company_id,
      recipient_id: uid,
      type,
      title,
      message: message ?? null,
      data: data ?? null,
    }));

    const { error } = await supabase
      .from('notifications')
      .insert(notifications);

    if (error) {
      console.error('Notification insert error:', error);
      return Response.json(
        { ok: false, error: error.message },
        { status: 500, headers: CORS },
      );
    }

    return Response.json(
      { ok: true, count: recipients.length },
      { headers: CORS },
    );
  } catch (err: any) {
    console.error('notify-supervisor error:', err);
    return Response.json({ error: err.message }, { status: 500, headers: CORS });
  }
});
