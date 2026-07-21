// Edge Function: OCR de ESTADOS DE CUENTA bancarios con Gemini 2.5 Flash.
// Reutiliza el mismo motor Gemini que ocr-extract (tickets) — cambia solo el
// prompt y el responseSchema: en vez de UN documento con UN total, extrae una
// TABLA de N movimientos (fecha, concepto, cargo, abono, saldo).
// Soporta imagen (JPEG/PNG) Y PDF (Gemini procesa PDF nativamente por inline_data).
// NO inserta nada — solo devuelve los movimientos leídos para que el cliente
// los revise y confirme antes de guardarlos en bank_transactions.
// Deploy: npx supabase functions deploy bank-statement-ocr

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PROMPT = `Eres un asistente contable que lee ESTADOS DE CUENTA BANCARIOS mexicanos.
Extrae TODOS los movimientos de la tabla del estado de cuenta, en orden.
Para cada movimiento:
- date: fecha del movimiento en formato YYYY-MM-DD (infiere el año del periodo del estado de cuenta).
- description: el concepto/descripción tal como aparece.
- charge: monto del CARGO (dinero que SALE) como número positivo, o null si es un abono.
- deposit: monto del ABONO/DEPÓSITO (dinero que ENTRA) como número positivo, o null si es un cargo.
- balance: saldo después del movimiento si aparece, o null.
Reglas:
- Un movimiento tiene charge O deposit, nunca ambos.
- No inventes movimientos. Si una fila no es un movimiento (encabezado, subtotal, corte), omítela.
- Los montos sin signo ni comas de miles: 1234.56, no "$1,234.56".
- accountNumber/clabe: los últimos 4 dígitos de la cuenta si aparecen, o null.
- periodStart/periodEnd: fechas del periodo del estado de cuenta (YYYY-MM-DD) si aparecen.
- confidence: 'high' si la tabla es clara, 'medium' si hubo que interpretar, 'low' si es difícil de leer.
- warnings: lista de avisos (ej. "columna de saldo ilegible en 2 filas").`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY no configurada en Supabase Secrets' }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const { file_base64, mime_type } = await req.json();
    if (!file_base64) {
      return new Response(JSON.stringify({ error: 'Falta file_base64' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mime_type ?? 'image/jpeg', data: file_base64 } },
            { text: PROMPT },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              accountLast4: { type: 'string', nullable: true },
              periodStart:  { type: 'string', nullable: true },
              periodEnd:    { type: 'string', nullable: true },
              confidence:   { type: 'string', enum: ['high', 'medium', 'low'] },
              warnings:     { type: 'array', items: { type: 'string' } },
              movements: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    date:        { type: 'string', nullable: true },
                    description: { type: 'string' },
                    charge:      { type: 'number', nullable: true },
                    deposit:     { type: 'number', nullable: true },
                    balance:     { type: 'number', nullable: true },
                  },
                  required: ['description'],
                },
              },
            },
            required: ['confidence', 'warnings', 'movements'],
          },
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return new Response(JSON.stringify({ error: `Gemini: ${errText.slice(0, 300)}` }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const geminiJson = await geminiRes.json();
    const text = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Fallback: extraer el primer bloque {...}
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('Respuesta de Gemini no es JSON válido');
      parsed = JSON.parse(m[0]);
    }

    // Normalizar: cada movimiento con amount firmado (deposit + / charge -)
    const movements = (parsed.movements ?? [])
      .map((mv: any) => {
        const charge = typeof mv.charge === 'number' ? mv.charge : null;
        const deposit = typeof mv.deposit === 'number' ? mv.deposit : null;
        const amount = deposit != null ? Math.abs(deposit) : charge != null ? -Math.abs(charge) : 0;
        return {
          date: mv.date ?? null,
          description: mv.description ?? '',
          amount,
          balance: typeof mv.balance === 'number' ? mv.balance : null,
        };
      })
      .filter((mv: any) => mv.amount !== 0 || mv.description);

    return new Response(JSON.stringify({
      accountLast4: parsed.accountLast4 ?? null,
      periodStart:  parsed.periodStart ?? null,
      periodEnd:    parsed.periodEnd ?? null,
      confidence:   parsed.confidence ?? 'low',
      warnings:     parsed.warnings ?? [],
      movements,
      count: movements.length,
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? 'Error desconocido' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
