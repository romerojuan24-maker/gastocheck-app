// POST /api/gastocheck/crear
// Crear gasto + movimiento + póliza automáticamente

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(request: Request) {
  try {
    const { empresa_id, monto, fecha, concepto, rfc_proveedor, nombre_proveedor, categoria, ocr_image_url, ocr_confidence } = await request.json();

    // Validar
    if (!empresa_id || !monto || !fecha || !concepto) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos' }), { status: 400 });
    }

    // 1. Crear movimiento_financiero
    const { data: movimiento, error: movError } = await supabase
      .from('movimientos_financieros')
      .insert({
        empresa_id,
        tipo_movimiento: 'GASTO',
        monto: -Math.abs(monto),
        fecha_evento: fecha,
        concepto,
        rfc_otra_parte: rfc_proveedor,
        nombre_otra_parte: nombre_proveedor,
        categoria: categoria || 'Sin categorizar',
        estado_registro: 'REGISTRADO',
        estado_pago: 'PENDIENTE',
        requiere_revision: ocr_confidence === 'low' || ocr_confidence === 'medium',
      })
      .select('id')
      .single();

    if (movError) throw movError;

    // 2. Crear gasto
    const { data: gasto, error: gastoError } = await supabase
      .from('gastos')
      .insert({
        empresa_id,
        movimiento_id: movimiento.id,
        monto: -Math.abs(monto),
        fecha,
        concepto,
        proveedor: nombre_proveedor,
        rfc_proveedor,
        categoria: categoria || 'Sin categorizar',
        origen: 'OCR',
        ocr_image_url,
        ocr_confidence,
      })
      .select('id')
      .single();

    if (gastoError) throw gastoError;

    // 3. Crear póliza (llamar Edge Function)
    const polizaRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/crear-poliza-automatica`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        movimiento_id: movimiento.id,
        empresa_id,
        tipo: 'GASTO',
      }),
    });

    const polizaData = await polizaRes.json();

    return new Response(
      JSON.stringify({
        success: true,
        gasto_id: gasto.id,
        movimiento_id: movimiento.id,
        poliza_id: polizaData.poliza_id,
        message: 'Gasto creado + póliza automática',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
}
