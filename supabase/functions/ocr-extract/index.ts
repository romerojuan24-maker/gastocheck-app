// Edge Function: Extracción enriquecida de comprobantes con Gemini 1.5 Flash
// Versión 2.1 — extrae RFC, hora, folio, UUID, conceptos detallados, warnings
// y recorta automáticamente el documento (bounding box de Gemini + imagescript)
// Deploy: npx supabase functions deploy ocr-extract

import { decode as decodeImage } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import { decodeBase64, encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Fotos de cámara a resolución completa del sensor (ej. 5472x7296 = 40MP) tronan el
// worker (WORKER_RESOURCE_LIMIT / status 546) al decodificarlas con imagescript — es un
// kill del runtime, no una excepción capturable, así que hay que evitar el intento en
// vez de recuperarnos de él. Verificado: 497KB decodifica bien, 1.08MB (40MP) no.
const MAX_CROP_BYTES = 600_000;

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
  tax:           number | null;  // IVA
  discount:      number | null;
  ieps:          number | null;  // IEPS combustibles/alcohol/tabaco
  ish:           number | null;  // Impuesto al Hospedaje (~3%)
  retencionIva:  number | null;  // Retención IVA (honorarios, arrendamiento)
  retencionIsr:  number | null;  // Retención ISR (honorarios, arrendamiento)
  total:         number | null;
  currency:      string;
  fiscalUuid:    string | null;  // UUID CFDI timbrado
  internalFolio: string | null;
  paymentMethod: string | null;  // efectivo, tarjeta, transferencia
  fullText:      string;
  lineItems:     OcrLineItem[];
  confidence:    'high' | 'medium' | 'low';
  warnings:      string[];
  documentBox:   { x0: number; y0: number; x1: number; y1: number } | null; // recorte 0-1
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
    const { image_base64, mime_type, skip_crop } = (await req.json()) as {
      image_base64: string;
      mime_type?: string;
      skip_crop?: boolean;
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

    const prompt = `INSTRUCCIÓN CRÍTICA: Responde ÚNICAMENTE con un objeto JSON válido. Sin texto antes, sin texto después, sin markdown, sin bloques de código. Solo el JSON puro.

Eres un experto en lectura de tickets, facturas y recibos mexicanos. Analiza esta imagen y devuelve EXACTAMENTE este JSON (rellena con null los campos que no puedas leer):

{"providerName":null,"providerRfc":null,"receiptDate":null,"receiptTime":null,"subtotal":null,"tax":null,"discount":null,"ieps":null,"ish":null,"retencionIva":null,"retencionIsr":null,"total":null,"currency":"MXN","fiscalUuid":null,"internalFolio":null,"paymentMethod":null,"fullText":"","lineItems":[],"confidence":"low","warnings":[],"documentBox":null}

Reglas:
- providerName: nombre del negocio tal como aparece
- providerRfc: RFC formato SAT (ej: ABC123456XYZ) o null
- receiptDate: fecha en YYYY-MM-DD o null
- receiptTime: hora HH:MM o null
- subtotal: monto antes de impuestos, solo número (ej: 1500.00) o null
- tax: IVA (16% normal), solo número o null
- discount: descuento o rebaja si aparece, solo número o null
- ieps: IEPS — impuesto especial producción y servicios. Aplica en: gasolineras (PEMEX, SHELL, BP, etc.), combustibles, bebidas alcohólicas, cervezas, cigarros, tabacos, bebidas saborizadas. Solo número o null
- ish: Impuesto al Hospedaje (~3%) — SOLO en hoteles, moteles, airbnb, hospedaje. Solo número o null
- retencionIva: Retención de IVA — aparece en facturas de honorarios, servicios profesionales, arrendamiento, consultoría. Solo número o null
- retencionIsr: Retención de ISR — aparece en facturas de honorarios, servicios profesionales, arrendamiento, consultoría. Solo número o null
- total: monto total a pagar (ya incluye todos los impuestos y descuentos), solo número o null
- fiscalUuid: UUID CFDI formato XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX o null
- internalFolio: número de ticket/folio interno o null
- paymentMethod: "efectivo" | "tarjeta" | "transferencia" | null
- fullText: TODO el texto visible transcrito literalmente
- lineItems: array de productos detectados (puede ser vacío [])
- confidence: "high" si lees todo claramente, "medium" si parcial, "low" si borroso/difícil
- warnings: lista de problemas encontrados (borroso, cortado, ilegible, etc)
- documentBox: rectángulo que delimita el ticket/factura dentro de la foto (para recortar fondo/mesa/mano
  y dejar solo el documento). Coordenadas NORMALIZADAS de 0.0 a 1.0 relativas al tamaño de la imagen
  completa: {"x0": izquierda, "y0": arriba, "x1": derecha, "y1": abajo}. x0<x1, y0<y1. Si el documento
  ya ocupa casi toda la imagen o no puedes determinar el borde con confianza, devuelve null (no inventes
  un recorte agresivo — más vale no recortar que cortar texto real).
- Si el ticket es ilegible, devuelve el JSON con todos nulls y confidence "low"
- NUNCA respondas con texto explicativo. SOLO JSON.`;

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
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              providerName:  { type: 'string',  nullable: true },
              providerRfc:   { type: 'string',  nullable: true },
              receiptDate:   { type: 'string',  nullable: true },
              receiptTime:   { type: 'string',  nullable: true },
              subtotal:      { type: 'number',  nullable: true },
              tax:           { type: 'number',  nullable: true },
              discount:      { type: 'number',  nullable: true },
              ieps:          { type: 'number',  nullable: true },
              ish:           { type: 'number',  nullable: true },
              retencionIva:  { type: 'number',  nullable: true },
              retencionIsr:  { type: 'number',  nullable: true },
              total:         { type: 'number',  nullable: true },
              currency:      { type: 'string'                  },
              fiscalUuid:    { type: 'string',  nullable: true },
              internalFolio: { type: 'string',  nullable: true },
              paymentMethod: { type: 'string',  nullable: true },
              fullText:      { type: 'string'                  },
              confidence:    { type: 'string',  enum: ['high', 'medium', 'low'] },
              warnings:      { type: 'array',   items: { type: 'string' } },
              documentBox: {
                type: 'object', nullable: true,
                properties: {
                  x0: { type: 'number' }, y0: { type: 'number' },
                  x1: { type: 'number' }, y1: { type: 'number' },
                },
                required: ['x0', 'y0', 'x1', 'y1'],
              },
              lineItems: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name:       { type: 'string'           },
                    quantity:   { type: 'number', nullable: true },
                    unit:       { type: 'string', nullable: true },
                    unitPrice:  { type: 'number', nullable: true },
                    totalPrice: { type: 'number', nullable: true },
                    confidence: { type: 'number'           },
                  },
                },
              },
            },
            required: ['currency', 'fullText', 'confidence', 'warnings', 'lineItems'],
          },
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
    const finishReason: string =
      geminiData?.candidates?.[0]?.finishReason ?? 'UNKNOWN';
    const candidatesLen: number = geminiData?.candidates?.length ?? 0;

    console.log('OCR finishReason:', finishReason);
    console.log('OCR rawText length:', rawText.length);
    console.log('OCR rawText:', rawText.slice(0, 500));

    const EMPTY_RESULT = {
      providerName: null, providerRfc: null, receiptDate: null, receiptTime: null,
      subtotal: null, tax: null, discount: null,
      ieps: null, ish: null, retencionIva: null, retencionIsr: null,
      total: null, currency: 'MXN',
      fiscalUuid: null, internalFolio: null, paymentMethod: null,
      fullText: '', lineItems: [], confidence: 'low' as const, warnings: [] as string[],
      documentBox: null as { x0: number; y0: number; x1: number; y1: number } | null,
    };

    // ── Estrategias de parseo (en orden de preferencia) ───────────────────────
    let result: OcrResult;
    let parsed: OcrResult | null = null;

    // 1. Parse directo (responseMimeType:'application/json' → JSON limpio)
    if (!parsed && rawText) {
      try { parsed = JSON.parse(rawText); } catch { /* sigue */ }
    }

    // 2. Strip markdown fences si Gemini los añadió
    if (!parsed && rawText) {
      const stripped = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      try { parsed = JSON.parse(stripped); } catch { /* sigue */ }
    }

    // 3. Extraer primer bloque JSON del texto
    if (!parsed && rawText) {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch (parseErr) {
          // Truncado o malformado — incluir debug en warnings para diagnóstico
          result = {
            ...EMPTY_RESULT,
            warnings: [
              `[DEBUG] finish=${finishReason} len=${rawText.length} err="${String(parseErr).slice(0, 80)}" txt="${rawText.slice(0, 120)}"`,
              'JSON truncado o malformado — ingresa los datos manualmente',
            ],
          };
        }
      }
    }

    if (!parsed && !result!) {
      result = {
        ...EMPTY_RESULT,
        warnings: [
          `[DEBUG] finish=${finishReason} candidates=${candidatesLen} len=${rawText.length} txt="${rawText.slice(0, 150)}"`,
          'El modelo no devolvió JSON — ingresa los datos manualmente',
        ],
      };
    }

    if (parsed) result = parsed;

    // Sanitizar y normalizar
    if (typeof result.total       !== 'number') result.total       = null;
    if (typeof result.subtotal    !== 'number') result.subtotal    = null;
    if (typeof result.tax         !== 'number') result.tax         = null;
    if (typeof result.discount    !== 'number') result.discount    = null;
    if (typeof result.ieps        !== 'number') result.ieps        = null;
    if (typeof result.ish         !== 'number') result.ish         = null;
    if (typeof result.retencionIva !== 'number') result.retencionIva = null;
    if (typeof result.retencionIsr !== 'number') result.retencionIsr = null;

    // Si tenemos total y subtotal pero no tax, estimarlo (solo si no hay IEPS/ISH)
    if (result.total && result.subtotal && !result.tax && !result.ieps && !result.ish) {
      const disc = result.discount ?? 0;
      const retIva = result.retencionIva ?? 0;
      const retIsr = result.retencionIsr ?? 0;
      const diff = result.total - result.subtotal + disc + retIva + retIsr;
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

    // ── Recorte automático del documento (si Gemini devolvió un bounding box confiable) ──
    // No falla el OCR si el recorte da error — result ya tiene todos los datos útiles.
    // Decodificar/recortar/re-codificar con imagescript es el paso más lento de esta
    // función (más que la llamada a Gemini). Los llamadores que solo necesitan los
    // datos extraídos (ej. revisión síncrona con spinner) deben mandar skip_crop:true.
    let croppedImageBase64: string | null = null;
    if (result.documentBox && !skip_crop) {
      try {
        const { x0, y0, x1, y1 } = result.documentBox;
        const validBox =
          [x0, y0, x1, y1].every((n) => typeof n === 'number' && n >= 0 && n <= 1) &&
          x1 > x0 && y1 > y0 &&
          (x1 - x0) > 0.15 && (y1 - y0) > 0.15; // evita recortes absurdos o casi vacíos

        const raw = decodeBase64(image_base64);
        if (validBox && raw.byteLength > MAX_CROP_BYTES) {
          console.warn(`[ocr-extract] Imagen de ${raw.byteLength} bytes excede MAX_CROP_BYTES — se omite recorte para no tronar el worker`);
          result.documentBox = null;
        } else if (validBox) {
          const img = await decodeImage(raw);
          // Margen de seguridad 2% para no cortar texto pegado al borde detectado
          const pad = 0.02;
          const cx0 = Math.max(0, x0 - pad);
          const cy0 = Math.max(0, y0 - pad);
          const cx1 = Math.min(1, x1 + pad);
          const cy1 = Math.min(1, y1 + pad);
          const left   = Math.round(cx0 * img.width);
          const top    = Math.round(cy0 * img.height);
          const width  = Math.round((cx1 - cx0) * img.width);
          const height = Math.round((cy1 - cy0) * img.height);

          if (width > 50 && height > 50) {
            img.crop(left, top, width, height);
            const encoded = await img.encodeJPEG(85);
            croppedImageBase64 = encodeBase64(encoded);
          }
        } else {
          result.documentBox = null; // recorte no confiable — no lo reportamos como aplicado
        }
      } catch (cropErr) {
        console.warn('[ocr-extract] Recorte falló (no bloquea el OCR):', cropErr);
      }
    }

    return Response.json(
      { ok: true, data: result, croppedImageBase64 },
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
