// Edge Function: Escaneo de documentos con Gemini Vision
// Lee tickets/facturas y extrae: monto, fecha, proveedor, concepto, RFC
// Deploy: npx supabase functions deploy scan-document

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

interface ScannedDocument {
  amount: number | null;           // Monto total en MXN
  date: string | null;             // YYYY-MM-DD
  vendor: string | null;           // Nombre del proveedor
  concept: string | null;          // Concepto/descripción del gasto
  rfc: string | null;              // RFC del emisor
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

/**
 * Función exportada para uso directo (sin HTTP)
 * @param imageBase64 - Imagen en base64 (sin data URI prefix)
 * @returns Datos extraídos del documento
 */
export async function scanDocument(imageBase64: string): Promise<ScannedDocument> {
  if (!imageBase64) {
    throw new Error('imageBase64 requerido');
  }
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY no configurada en Supabase Secrets');
  }

  return extractDocumentData(imageBase64, 'image/jpeg');
}

/**
 * Extrae datos del documento usando Gemini 2.5 Flash
 */
async function extractDocumentData(
  imageBase64: string,
  mimeType: string,
): Promise<ScannedDocument> {
  const prompt = `INSTRUCCIÓN: Responde ÚNICAMENTE con un objeto JSON válido. Sin texto antes, sin markdown, sin bloques de código. Solo JSON puro.

Analiza esta imagen de ticket/factura y extrae exactamente estos 5 campos:

{"amount":null,"date":null,"vendor":null,"concept":null,"rfc":null,"confidence":"low","warnings":[]}

REGLAS CRÍTICAS:
- amount: monto TOTAL (número, ej: 250.50) o null. Este es el importe FINAL a pagar.
- date: fecha en YYYY-MM-DD o null. Busca "Fecha", "Date", hora con día.
- vendor: nombre del negocio/empresa/comerciante tal como aparece (string) o null
- concept: descripción breve del producto/servicio (string, max 100 chars) o null
- rfc: RFC del emisor formato SAT (ej: ABC123456XYZ) o null. RFC debe ser válido.
- confidence: "high" si lees claramente el monto, fecha y proveedor; "medium" si hay 2 de 3; "low" si ilegible/borroso
- warnings: lista de problemas (["Image too dark", "Amount unclear"] etc) o []

FORMATO DEL RFC:
- Persona Moral: 3 letras + 6 dígitos + 3 alfanuméricos (ej: ABC123456XYZ)
- Persona Física: 4 letras + 6 dígitos + 3 alfanuméricos (ej: ABCD123456XYZ)
- Si no está claro o ilegible, devuelve null

INSTRUCCIÓN FINAL: Responde SOLO con el JSON, nada más.`;

  const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            amount: { type: 'number', nullable: true },
            date: { type: 'string', nullable: true },
            vendor: { type: 'string', nullable: true },
            concept: { type: 'string', nullable: true },
            rfc: { type: 'string', nullable: true },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            warnings: { type: 'array', items: { type: 'string' } },
          },
          required: ['confidence', 'warnings'],
        },
      },
    }),
  });

  if (!geminiRes.ok) {
    const err = await geminiRes.text();
    console.error('Gemini error:', err);
    throw new Error(`Gemini API falló: ${err}`);
  }

  const geminiData = await geminiRes.json();
  const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const finishReason: string = geminiData?.candidates?.[0]?.finishReason ?? 'UNKNOWN';

  console.log('scan-document finishReason:', finishReason);
  console.log('scan-document rawText:', rawText.slice(0, 200));

  // Estrategias de parseo
  let parsed: ScannedDocument | null = null;

  // 1. Parse directo (responseMimeType:'application/json' → JSON limpio)
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      /* sigue */
    }
  }

  // 2. Strip markdown fences si Gemini los añadió
  if (!parsed && rawText) {
    const stripped = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    try {
      parsed = JSON.parse(stripped);
    } catch {
      /* sigue */
    }
  }

  // 3. Extraer primer bloque JSON del texto
  if (!parsed && rawText) {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseErr) {
        console.error('JSON parse error:', parseErr);
      }
    }
  }

  // Default si falla parseo
  const result: ScannedDocument = parsed || {
    amount: null,
    date: null,
    vendor: null,
    concept: null,
    rfc: null,
    confidence: 'low',
    warnings: [
      `Parseo fallido: finish=${finishReason}, txt="${rawText.slice(0, 100)}"`,
      'Ingresa los datos manualmente',
    ],
  };

  // ── Sanitización y normalización ──────────────────────────────

  // Validar amount (debe ser número)
  if (typeof result.amount !== 'number' && result.amount !== null) {
    result.warnings.push(`Monto inválido: ${result.amount}`);
    result.amount = null;
  }

  // Validar date (debe ser YYYY-MM-DD)
  if (result.date && typeof result.date === 'string') {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(result.date)) {
      result.warnings.push(`Fecha con formato inválido: ${result.date}`);
      result.date = null;
    }
  }

  // Validar RFC (formato SAT)
  if (result.rfc && typeof result.rfc === 'string') {
    const rfcCleaned = result.rfc.replace(/\s/g, '').toUpperCase();
    const rfcRegex = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
    if (!rfcRegex.test(rfcCleaned)) {
      result.warnings.push(`RFC con formato inválido: ${result.rfc}`);
      result.rfc = null;
    } else {
      result.rfc = rfcCleaned;
    }
  }

  // Normalizar vendor (string)
  if (result.vendor && typeof result.vendor !== 'string') {
    result.vendor = String(result.vendor).trim() || null;
  } else if (result.vendor) {
    result.vendor = result.vendor.trim() || null;
  }

  // Normalizar concept (string)
  if (result.concept && typeof result.concept !== 'string') {
    result.concept = String(result.concept).trim() || null;
  } else if (result.concept) {
    result.concept = result.concept.trim() || null;
  }

  // Validar confidence
  if (!['high', 'medium', 'low'].includes(result.confidence)) {
    result.confidence = 'low';
  }

  // Validar warnings array
  if (!Array.isArray(result.warnings)) {
    result.warnings = [];
  }

  // Agregar advertencias automáticas según confianza
  if (result.confidence === 'low') {
    if (!result.warnings.includes('Baja confianza — revisa manualmente')) {
      result.warnings.push('Baja confianza — revisa manualmente');
    }
  }

  if (!result.amount && !result.vendor && !result.date) {
    result.warnings.push('No se detectaron datos principales (monto, proveedor, fecha)');
    if (result.confidence !== 'low') {
      result.confidence = 'low';
    }
  }

  return result;
}

/**
 * Handler HTTP para POST /scan-document
 * Body: { image_base64, mime_type? }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  try {
    const { image_base64, mime_type } = (await req.json()) as {
      image_base64: string;
      mime_type?: string;
    };

    if (!image_base64) {
      return Response.json(
        { error: 'image_base64 requerido' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const mimeType = mime_type ?? 'image/jpeg';
    const result = await scanDocument(image_base64);

    return Response.json(
      { ok: true, data: result },
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('scan-document error:', e);
    return Response.json(
      { ok: false, error: String(e) },
      { status: 500, headers: CORS_HEADERS },
    );
  }
});
