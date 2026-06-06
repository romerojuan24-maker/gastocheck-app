// Edge Function: Lee imagen de ticket con Claude Vision
// Devuelve: {total, iva, subtotal, fecha, proveedor, conceptos}
// Deploy: supabase functions deploy ocr-extract
import Anthropic from 'npm:@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
});

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
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { image_base64, mime_type } = (await req.json()) as {
      image_base64: string;
      mime_type?: string;
    };

    if (!image_base64) {
      return Response.json({ error: 'image_base64 requerido' }, { status: 400 });
    }

    const msg = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: (mime_type ?? 'image/jpeg') as
                  | 'image/jpeg'
                  | 'image/png'
                  | 'image/gif'
                  | 'image/webp',
                data: image_base64,
              },
            },
            {
              type: 'text',
              text: `Lee este ticket/recibo y extrae datos en JSON. Devuelve exactamente esto (completa con null si falta):
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
- Los montos pueden estar en MXN, USD, etc — deja como número
- Si está borroso o ilegible, marca confidence: "low" y devuelve lo que puedas leer
- DEVUELVE SOLO JSON, SIN EXPLICACIONES`,
            },
          ],
        },
      ],
    });

    const text = msg.content
      .filter((c) => c.type === 'text')
      .map((c) => (c.type === 'text' ? c.text : ''))
      .join('');

    // Intenta parsear JSON de la respuesta
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json(
        { error: 'No se extrajo JSON del ticket', raw_response: text },
        { status: 400 },
      );
    }

    const result: OcrResult = JSON.parse(jsonMatch[0]);

    // Validación de tipos
    if (result.total !== null && typeof result.total !== 'number') result.total = null;
    if (result.subtotal !== null && typeof result.subtotal !== 'number') result.subtotal = null;
    if (result.iva !== null && typeof result.iva !== 'number') result.iva = null;
    if (!Array.isArray(result.conceptos)) result.conceptos = [];

    return Response.json({ ok: true, data: result });
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});
