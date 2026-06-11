// whatsapp-webhook — Recibe fotos de WhatsApp Business, las procesa y responde
// Integración con Meta WhatsApp Cloud API
// Webhook endpoint para POST /whatsapp-webhook

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const WHATSAPP_TOKEN   = Deno.env.get('WHATSAPP_BUSINESS_TOKEN') ?? '';
const WHATSAPP_PHONE   = Deno.env.get('WHATSAPP_BUSINESS_PHONE_ID') ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

interface WhatsAppMessage {
  from: string;
  type: string;
  image?: { id: string };
  text?: { body: string };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // Webhook verification (Meta)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode && token && token === 'GASTOCHECK_WHATSAPP_TOKEN' && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body: any = await req.json();
    const changes = body.entry?.[0]?.changes?.[0];

    if (!changes?.value?.messages?.length) {
      return Response.json({ ok: true }, { headers: CORS });
    }

    const message: WhatsAppMessage = changes.value.messages[0];
    const from = message.from;

    // Si es imagen
    if (message.type === 'image' && message.image?.id) {
      // TODO:
      // 1. Descargar imagen desde Meta
      // 2. Llamar a ocr-extract
      // 3. Detectar proveedor
      // 4. Sugerir categoría
      // 5. Responder con preview y pedir confirmación
      // Por ahora: log

      console.log(`Imagen recibida de ${from}: ${message.image.id}`);

      // Responder
      await sendWhatsAppMessage(from, '📸 Foto recibida. Analizando...');
    }

    // Si es texto
    if (message.type === 'text' && message.text?.body) {
      const text = message.text.body;

      // Comando: /help, /status, etc.
      if (text.startsWith('/')) {
        if (text === '/help') {
          await sendWhatsAppMessage(
            from,
            '🤖 *GastoCheck WhatsApp Bot*\n\n' +
            '📸 Envía una foto del ticket\n' +
            '✨ El bot extrae los datos automáticamente\n' +
            '💬 Confirma y se envía a tu app\n\n' +
            'Soportamos: fotos, PDFs, XMLs'
          );
        } else if (text === '/status') {
          await sendWhatsAppMessage(from, '✅ Bot activo y listo');
        }
      } else {
        await sendWhatsAppMessage(from, '👋 Hola! Envía una foto del comprobante');
      }
    }

    return Response.json({ ok: true }, { headers: CORS });
  } catch (err: any) {
    console.error('whatsapp-webhook error:', err);
    return Response.json({ error: err.message }, { status: 500, headers: CORS });
  }
});

async function sendWhatsAppMessage(to: string, text: string) {
  try {
    const res = await fetch(`https://graph.instagram.com/v18.0/${WHATSAPP_PHONE}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    });

    if (!res.ok) {
      console.error('WhatsApp send failed:', await res.text());
    }
  } catch (err: any) {
    console.error('sendWhatsAppMessage error:', err);
  }
}
