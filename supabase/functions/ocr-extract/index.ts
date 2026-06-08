// Edge Function: Lee imagen de ticket con Gemini Vision
// Migrado de Anthropic → Google Gemini 1.5 Flash (más económico, mismo resultado)
// Deploy: supabase functions deploy ocr-extract

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

interface OcrResult {
  total: number | null;
  subtotal: number | null;
  iva: number | null;
  fecha: string | null;
  proveedor: string | null;
  conceptos: { descripcion: string; cantidad: number; precio: number; importe: number }[];
  confidence: 'high' | 'medium' | 'low';
  raw_text: string;
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

  try {
    const { image_base64, mime_type } = (await req.json()) as {
      image_base64: string;
      mime_type?: string;
    };

    if (!image_base64) {
      return Response.json({ error: 'image_base64 requerido' }, { status: 400 });
    }

    if (!GEMINI_API_KEY) {
      return Response.json({ error: 'GEMINI_API_KEY no configurada en Supabase Secrets' }, { status: 500 });
    }

    const prompt = `Lee este ticket/recibo y extrae datos en JSON. Devuelve exactamente esto (completa con null si falta):
{
  "total": número,
  "subtotal": número,
  "iva": número,
  "fecha": "YYYY-MM-DD" o null,
  "proveedor": "nombre del comercio",
  "conceptos": [{"descripcion": "...", "cantidad": N, "precio": P, "importe": M}, ...],
  "confidence": "high" | "medium" | "low",
  "raw_text": "transcripción del ticket"
}

Reglas:
- Si no ves IVA explícito, calcula: iva = total - subtotal (si subtotal existe)
- Sé flexible con formatos de fecha (02/06/2026, 2-6-26, etc) → normaliza a YYYY-MM-DD
- Los montos son en MXN — deja como número sin símbolo de moneda
- Si está borroso o ilegible, marca confidence: "low" y devuelve lo que puedas leer
- DEVUELVE SOLO JSON, SIN EXPLICACIONES NI MARKDOWN`;

    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mime_type ?? 'image/jpeg',
                  data: image_base64,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      console.error('Gemini error:', err);
      return Response.json({ error: 'Gemini API falló', detail: err }, { status: 502 });
    }

    const geminiData = await geminiRes.json();
    const text: string =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Extraer JSON de la respuesta (Gemini a veces agrega markdown)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json(
        { error: 'No se extrajo JSON del ticket', raw_response: text },
        { status: 400 },
      );
    }

    const result: OcrResult = JSON.parse(jsonMatch[0]);

    // Sanitizar tipos
    if (result.total !== null && typeof result.total !== 'number') result.total = null;
    if (result.subtotal !== null && typeof result.subtotal !== 'number') result.subtotal = null;
    if (result.iva !== null && typeof result.iva !== 'number') result.iva = null;
    if (!Array.isArray(result.conceptos)) result.conceptos = [];
    if (!['high', 'medium', 'low'].includes(result.confidence)) result.confidence = 'low';

    return Response.json(
      { ok: true, data: result },
      { headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});
