// POST /api/cobracheck/registrar-pago
// Registrar pago + crear póliza automáticamente

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(request: Request) {
  try {
    const { empresa_id, factura_id, cliente_id, monto, fecha_pago, metodo_pago } = await request.json();

    if (!empresa_id || !factura_id || !monto) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos' }), { status: 400 });
    }

    // Llamar Edge Function
    const pagoRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/registrar-pago-automatico`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        empresa_id,
        factura_id,
        cliente_id,
        monto,
        fecha_pago: fecha_pago || new Date().toISOString().split('T')[0],
        metodo_pago,
      }),
    });

    const pagoData = await pagoRes.json();

    if (!pagoRes.ok) throw pagoData;

    return new Response(
      JSON.stringify({
        success: true,
        pago_id: pagoData.pago_id,
        poliza_id: pagoData.poliza_id,
        message: 'Pago registrado + póliza creada',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
}
