// Edge Function: Extracción enriquecida de comprobantes con Gemini 1.5 Flash
// Versión 2.0 — extrae RFC, hora, folio, UUID, conceptos detallados y warnings
// Deploy: npx supabase functions deploy ocr-extract

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

interface OcrLineItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  confidence: number;
}

interface OcrResult {
  providerName:  string | null;
  providerRfc:   string | null;
  receiptDate:   string | null;  // YYYY-MM-DD
  receiptTime:   string | null;  // HH:MM
  subtotal:      number | null;
  tax:           number | null;
  total:         number | null;
  currency:      string;
  fiscalUuid:    string | null;  // UUID CFDI timbrado
  internalFolio: string | null;
  paymentMethod: string | null;  // efectivo, tarjeta, transferencia
  fullText:      string;
  lineItems:     OcrLineItem[];
  confidence:    'high' | 'medium' | 'low';
  warnings:      string[];
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { image_base64, mime_type } = (await req.json()) as {
      image_base64: string;
      mime_type?: string;
    };

    if (!image_base64) {
      return Response.json({ error: 'image_base64 requerido' }, { status: 400 });
    }
    if (!GEMINI_API_KEY) {
      return Response.json(
        { error: 'GEMINI_API_KEY no configurada en Supabase Secrets' },
        { status: 500 },
      );
    }

    const prompt = `Eres un experto en lectura de tickets, facturas y recibos mexicanos.
Lee este comprobante y extrae TODOS los datos disponibles en el siguiente JSON exacto.
Si un campo no está visible o no aplica, usa null.

{
  "providerName":  "nombre del negocio/proveedor como aparece en el ticket",
  "providerRfc":   "RFC del emisor si aparece (formato SAT: 3-4 letras + 6 dígitos + 3 alfanuméricos)",
  "receiptDate":   "fecha YYYY-MM-DD o null",
  "receiptTime":   "hora HH:MM o null",
  "subtotal":      número o null,
  "tax":           número de IVA o null,
  "total":         monto total o null,
  "currency":      "MXN",
  "fiscalUuid":    "UUID del CFDI timbrado (32 hex con guiones) o null",
  "internalFolio": "folio o número de ticket interno o null",
  "paymentMethod": "efectivo | tarjeta | transferencia | cheque | otro | null",
  "fullText":      "transcripción completa del texto visible en el ticket",
  "lineItems": [
    {
      "name":       "descripción del producto o servicio",
      "quantity":   número o null,
      "unit":       "PZA|LT|KG|MT|SERVICIO|etc o null",
      "unitPrice":  precio unitario o null,
      "totalPrice": importe total del renglón o null,
      "confidence": número 0-100
    }
  ],
  "confidence": "high | medium | low",
  "warnings": ["lista de advertencias: ilegible, cortado, borroso, sin IVA, etc"]
}

Reglas importantes:
- Si no ves IVA pero hay subtotal y total: tax = total - subtotal (si diferencia > 0)
- Normaliza fechas a YYYY-MM-DD aunque estén en DD/MM/YYYY o DD-MM-YY
- El UUID del CFDI tiene formato: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX (36 caracteres con guiones)
- Sólo extrae RFC si claramente pertenece al emisor; ignora RFC de receptor
- Los montos son en MXN sin símbolo de moneda (solo número)
- Si el ticket está muy borroso o cortado, confidence = "low" y agrega warning
- lineItems: incluye TODOS los productos o servicios visibles, incluso si son parciales
- DEVUELVE SOLO JSON VÁLIDO, SIN EXPLICACIONES NI MARKDOWN`;

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
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      console.error('Gemini error:', err);
      return Response.json({ error: 'Gemini API falló', detail: err }, { status: 502 });
    }

    const geminiData = await geminiRes.json();
    const rawText: string =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Extrae JSON (Gemini a veces rodea con markdown)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json(
        { error: 'No se pudo extraer JSON del ticket', raw_response: rawText },
        { status: 400 },
      );
    }

    const result: OcrResult = JSON.parse(jsonMatch[0]);

    // Sanitizar y normalizar
    if (typeof result.total !== 'number')    result.total    = null;
    if (typeof result.subtotal !== 'number') result.subtotal = null;
    if (typeof result.tax !== 'number')      result.tax      = null;

    // Si tenemos total y subtotal pero no tax, calcularlo
    if (result.total && result.subtotal && !result.tax) {
      const diff = result.total - result.subtotal;
      if (diff > 0.01) result.tax = Math.round(diff * 100) / 100;
    }

    if (!['high', 'medium', 'low'].includes(result.confidence)) {
      result.confidence = 'low';
    }
    if (!Array.isArray(result.lineItems))  result.lineItems = [];
    if (!Array.isArray(result.warnings))   result.warnings  = [];
    if (!result.currency) result.currency = 'MXN';
    if (!result.fullText) result.fullText  = '';

    // Normalizar UUID: quitar espacios, forzar guiones
    if (result.fiscalUuid) {
      const cleaned = result.fiscalUuid.replace(/\s/g, '').toUpperCase();
      // Validar formato UUID CFDI
      const uuidRegex = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;
      if (!uuidRegex.test(cleaned)) {
        result.warnings.push(`UUID detectado con formato inválido: ${result.fiscalUuid}`);
        result.fiscalUuid = null;
      } else {
        result.fiscalUuid = cleaned;
      }
    }

    // Normalizar RFC del emisor
    if (result.providerRfc) {
      const rfcCleaned = result.providerRfc.replace(/\s/g, '').toUpperCase();
      const rfcRegex = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
      if (!rfcRegex.test(rfcCleaned)) {
        result.warnings.push(`RFC detectado con formato inválido: ${result.providerRfc}`);
        result.providerRfc = null;
      } else {
        result.providerRfc = rfcCleaned;
      }
    }

    // Agregar advertencias automáticas
    if (result.confidence === 'low') {
      result.warnings.push('Baja confianza en la lectura — revisar manualmente');
    }
    if (!result.fiscalUuid && !result.internalFolio) {
      result.warnings.push('Sin UUID fiscal ni folio — ticket sin CFDI');
    }
    if (!result.providerName) {
      result.warnings.push('No se detectó nombre del proveedor');
    }

    return Response.json(
      { ok: true, data: result },
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('ocr-extract error:', e);
    return Response.json(
      { ok: false, error: String(e) },
      { status: 500, headers: CORS_HEADERS },
    );
  }
});
