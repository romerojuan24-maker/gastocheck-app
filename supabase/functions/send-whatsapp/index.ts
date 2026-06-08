// Edge Function: Envía reporte por WhatsApp Cloud API (Meta)
// Soporta: link firmado (texto), PDF/Excel como documento adjunto
// Deploy: supabase functions deploy send-whatsapp
import { createClient } from 'jsr:@supabase/supabase-js@2';

const WA_TOKEN    = Deno.env.get('WHATSAPP_API_TOKEN') ?? '';
const WA_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '';
const WA_API_URL  = `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`;

interface SendPayload {
  to: string;           // número con código de país: "521XXXXXXXXXX"
  policy_id: string;
  kind: 'link' | 'excel' | 'zip';
  signed_url?: string;  // si ya tienes el URL del export
  export_id?: string;   // o usa el ID del registro en report_exports
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  if (!WA_TOKEN || !WA_PHONE_ID) {
    return Response.json({
      error: 'WHATSAPP_API_TOKEN o WHATSAPP_PHONE_NUMBER_ID no configurados en Supabase Secrets',
    }, { status: 500 });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  try {
    const { to, policy_id, kind, signed_url, export_id } = (await req.json()) as SendPayload;

    if (!to) return Response.json({ error: 'campo "to" requerido (número WhatsApp)' }, { status: 400 });
    if (!policy_id) return Response.json({ error: 'policy_id requerido' }, { status: 400 });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'no auth' }, { status: 401 });

    // Obtener datos de la póliza
    const { data: policy } = await supabase
      .from('policies')
      .select('name, company_id, closing_balance')
      .eq('id', policy_id)
      .single();

    if (!policy) return Response.json({ error: 'póliza no encontrada' }, { status: 404 });

    // Resolver signed_url si no viene directo
    let url = signed_url;
    if (!url && export_id) {
      const { data: exp } = await supabase
        .from('report_exports')
        .select('signed_url, kind')
        .eq('id', export_id)
        .single();
      url = exp?.signed_url ?? undefined;
    }

    const money = (n: number | null) =>
      new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n ?? 0);

    // ── Construir mensaje WhatsApp ────────────────────────────────
    let waBody: object;

    if (kind === 'link' && url) {
      // Mensaje de texto con link firmado
      waBody = {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: {
          preview_url: false,
          body: [
            `📊 *GastoCheck — Reporte listo*`,
            ``,
            `Póliza: *${policy.name}*`,
            `Saldo final: *${money(policy.closing_balance)}*`,
            ``,
            `📥 Descarga tu reporte aquí:`,
            url,
            ``,
            `⏳ El enlace expira en 7 días.`,
            `_Enviado desde GastoCheck_`,
          ].join('\n'),
        },
      };
    } else if ((kind === 'excel' || kind === 'zip') && url) {
      // Documento adjunto
      const caption = kind === 'excel'
        ? `📊 Reporte Excel — Póliza: ${policy.name} | Saldo: ${money(policy.closing_balance)}`
        : `📦 Póliza completa (Excel + comprobantes) — ${policy.name}`;

      waBody = {
        messaging_product: 'whatsapp',
        to,
        type: 'document',
        document: {
          link: url,
          caption,
          filename: kind === 'excel'
            ? `GastoCheck_${policy.name.replace(/\s+/g, '_')}.xlsx`
            : `GastoCheck_${policy.name.replace(/\s+/g, '_')}.zip`,
        },
      };
    } else {
      // Fallback: texto con resumen sin link
      waBody = {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: {
          body: [
            `📊 *GastoCheck — Póliza cerrada*`,
            ``,
            `Póliza: *${policy.name}*`,
            `Saldo final: *${money(policy.closing_balance)}*`,
            ``,
            `Accede a GastoCheck para descargar el reporte.`,
          ].join('\n'),
        },
      };
    }

    // ── Enviar por WhatsApp Cloud API ────────────────────────────
    const waRes = await fetch(WA_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(waBody),
    });

    const waData = await waRes.json();

    if (!waRes.ok) {
      console.error('WhatsApp API error:', JSON.stringify(waData));
      return Response.json({
        error: 'Error al enviar WhatsApp',
        detail: waData?.error?.message ?? JSON.stringify(waData),
      }, { status: 502 });
    }

    const messageId = waData?.messages?.[0]?.id;

    return Response.json(
      { ok: true, message_id: messageId, to },
      { headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});
