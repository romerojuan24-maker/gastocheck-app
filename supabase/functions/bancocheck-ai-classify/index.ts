// Edge Function: sugiere CUENTA CONTABLE para movimientos bancarios con IA.
// Reutiliza el patrón Gemini (responseSchema + validación) de ocr-extract /
// advisor-explain. NO aplica nada: solo devuelve, por cada movimiento, el
// código de cuenta sugerido del catálogo que le pasa el cliente. El contador
// revisa y puede modificar cada uno antes de aplicar (regla: la IA sugiere,
// el humano decide).
// Deploy: npx supabase functions deploy bancocheck-ai-classify

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY no configurada' }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // movements: [{id, description, amount}]  ·  accounts: [{code, name}]
    const { movements, accounts } = await req.json();
    if (!Array.isArray(movements) || movements.length === 0) {
      return new Response(JSON.stringify({ error: 'Falta movements' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return new Response(JSON.stringify({ error: 'Falta el catálogo de cuentas (accounts)' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // Limitar tamaño del prompt (catálogo puede ser grande)
    const catalog = accounts.slice(0, 400).map((a: any) => `${a.code} — ${a.name}`).join('\n');
    const movesText = movements.slice(0, 80).map((m: any, i: number) =>
      `${i}. [${m.amount >= 0 ? 'INGRESO' : 'EGRESO'} ${Math.abs(m.amount)}] ${m.description}`).join('\n');

    const prompt = `Eres un contador mexicano. Clasifica cada MOVIMIENTO BANCARIO asignándole la CUENTA CONTABLE más apropiada del CATÁLOGO.
Devuelve SOLO códigos que existan EXACTAMENTE en el catálogo. Si ninguno aplica con confianza, deja accountCode en null.

CATÁLOGO DE CUENTAS (código — nombre):
${catalog}

MOVIMIENTOS (índice. [tipo monto] descripción):
${movesText}

Para cada movimiento devuelve: index (el número), accountCode (código exacto del catálogo o null), confidence (0..1).`;

    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              suggestions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    index:       { type: 'number' },
                    accountCode: { type: 'string', nullable: true },
                    confidence:  { type: 'number' },
                  },
                  required: ['index'],
                },
              },
            },
            required: ['suggestions'],
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
    try { parsed = JSON.parse(text); }
    catch { const m = text.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : { suggestions: [] }; }

    // Validar: solo códigos que existan en el catálogo; mapear al id del movimiento
    const validCodes = new Set(accounts.map((a: any) => String(a.code)));
    const suggestions = (parsed.suggestions ?? [])
      .filter((s: any) => typeof s.index === 'number' && movements[s.index])
      .map((s: any) => ({
        movementId: movements[s.index].id ?? null,
        accountCode: s.accountCode && validCodes.has(String(s.accountCode)) ? String(s.accountCode) : null,
        confidence: typeof s.confidence === 'number' ? s.confidence : 0,
      }))
      .filter((s: any) => s.accountCode);

    return new Response(JSON.stringify({ suggestions, count: suggestions.length }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? 'Error' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
