// POST /api/bancocheck/conectar
// Conectar banco con Plaid

export async function POST(request: Request) {
  try {
    const { empresa_id, public_token, metadata } = await request.json();

    // Llamar Edge Function
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/conectar-plaid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        empresa_id,
        public_token,
        metadata,
      }),
    });

    const data = await response.json();

    if (!response.ok) throw data;

    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
}
