import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

interface SendRequest {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const auth = req.headers.get('authorization');
    const token = auth?.replace('Bearer ', '');
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? '',
    );

    // Verificar token
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return Response.json({ error: 'Invalid token' }, { status: 401, headers: CORS });
    }

    const body: SendRequest = await req.json();
    const { user_id, title, body: msgBody, data } = body;

    if (!user_id || !title || !msgBody) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400, headers: CORS },
      );
    }

    // Obtener push tokens del usuario
    const { data: pushTokens, error: tokenErr } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', user_id);

    if (tokenErr || !pushTokens || pushTokens.length === 0) {
      return Response.json(
        { ok: true, sent: 0, msg: 'No push tokens found' },
        { status: 200, headers: CORS },
      );
    }

    // Enviar notificación a cada token
    const messages = pushTokens.map((pt) => ({
      to: pt.token,
      sound: 'default',
      title,
      body: msgBody,
      data: data ?? {},
      badge: 1,
      channelId: 'default',
    }));

    const res = await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });

    const result = await res.json();

    // Log de resultado
    console.log(`[send-notification] Sent ${messages.length} to ${user_id}:`, result);

    return Response.json(
      { ok: true, sent: messages.length, result },
      { status: 200, headers: CORS },
    );
  } catch (err) {
    console.error('[send-notification] Error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Send failed' },
      { status: 500, headers: CORS },
    );
  }
});
