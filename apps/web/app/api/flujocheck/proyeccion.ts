// POST /api/flujocheck/proyeccion
// Obtener proyección de flujo de efectivo

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const empresa_id = searchParams.get('empresa_id');
    const dias = searchParams.get('dias') || '30';

    if (!empresa_id) {
      return new Response(JSON.stringify({ error: 'empresa_id requerido' }), { status: 400 });
    }

    // Llamar Edge Function
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/proyectar-flujo-efectivo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        empresa_id,
        dias_proyeccion: parseInt(dias),
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
