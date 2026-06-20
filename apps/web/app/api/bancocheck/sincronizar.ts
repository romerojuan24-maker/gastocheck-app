// POST /api/bancocheck/sincronizar
// Sincronizar movimientos + reconciliación automática

export async function POST(request: Request) {
  try {
    const { empresa_id, banco_cuenta_id, movimientos_simulados } = await request.json();

    // Llamar Edge Function
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sincronizar-banco`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        empresa_id,
        banco_cuenta_id,
        movimientos_simulados,
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
