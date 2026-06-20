// GET /api/dashboard/consolidado
// Dashboard consolidado: TODO en un endpoint

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const empresa_id = searchParams.get('empresa_id');

    if (!empresa_id) {
      return new Response(JSON.stringify({ error: 'empresa_id requerido' }), { status: 400 });
    }

    // Llamar Edge Function
    const dashRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dashboard-consolidado?empresa_id=${empresa_id}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    const dashData = await dashRes.json();

    return new Response(
      JSON.stringify(dashData),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
}
