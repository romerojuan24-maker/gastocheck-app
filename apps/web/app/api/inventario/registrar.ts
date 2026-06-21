// POST /api/inventario/registrar
// Registrar movimiento de entrada/salida de stock

export async function POST(request: Request) {
  try {
    const { empresa_id, accion, producto_id, cantidad, tipo, nota } = await request.body ? await request.json() : {};

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/gestionar-inventario`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          empresa_id,
          accion,
          producto_id,
          cantidad,
          tipo,
          nota,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) throw data;

    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
}
