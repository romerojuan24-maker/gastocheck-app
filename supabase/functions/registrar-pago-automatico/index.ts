// Registrar pago + crear póliza automáticamente
// Cuando usuario registra que recibió dinero

import { createClient } from 'jsr:@supabase/supabase-js@2.43.4';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { empresa_id, factura_id, cliente_id, monto, fecha_pago, metodo_pago } = await req.json();

    if (!empresa_id || !factura_id || !monto) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos' }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // 1. Obtener movimiento asociado a factura (si existe)
    const { data: mov_factura } = await supabase
      .from('movimientos_financieros')
      .select('*')
      .eq('factura_id', factura_id)
      .single();

    // 2. Crear/actualizar movimiento para el pago
    if (mov_factura) {
      // Ya existe movimiento, solo actualizar estado
      const { error: updError } = await supabase
        .from('movimientos_financieros')
        .update({
          estado_pago: 'PAGADO',
          fecha_pago: fecha_pago || new Date().toISOString().split('T')[0],
          es_reconciliado: true,
          trazabilidad_completa: true,
        })
        .eq('id', mov_factura.id);

      if (updError) {
        return new Response(JSON.stringify({ error: updError }), { status: 500 });
      }
    }

    // 3. Crear registro de pago
    const { data: pago, error: pagoError } = await supabase
      .from('pagos')
      .insert({
        empresa_id,
        factura_id,
        cliente_id,
        movimiento_id: mov_factura?.id,
        monto,
        fecha_pago: fecha_pago || new Date().toISOString().split('T')[0],
        metodo_pago,
        estado: 'COMPLETADO',
      })
      .select('id')
      .single();

    if (pagoError) {
      return new Response(JSON.stringify({ error: pagoError }), { status: 500 });
    }

    // 4. Crear póliza automáticamente (DIFERENCIAL)
    const { data: poliza } = await supabase
      .from('polizas')
      .insert({
        empresa_id,
        movimiento_financiero_id: mov_factura?.id,
        pago_id: pago.id,
        factura_id,
        tipo: 'INGRESO',
        fecha_poliza: fecha_pago || new Date().toISOString().split('T')[0],
        concepto: `Pago recibido de cliente`,
        lineas: [
          {
            cuenta: 'BANCO_PRINCIPAL',
            tipo: 'DEBIT',
            monto: monto,
            descripcion: `Depósito cliente`,
          },
          {
            cuenta: `CLIENTE_${cliente_id}`,
            tipo: 'CREDIT',
            monto: monto,
            descripcion: `Pago factura`,
          },
        ],
        total_debit: monto,
        total_credit: monto,
        cuadrada: true,
      })
      .select('id')
      .single();

    // 5. Actualizar movimiento con referencia a póliza
    if (mov_factura && poliza) {
      await supabase
        .from('movimientos_financieros')
        .update({
          poliza_id: poliza.id,
          estado_contable: 'PÓLIZA_CREADA',
        })
        .eq('id', mov_factura.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        pago_id: pago.id,
        poliza_id: poliza?.id,
        message: 'Pago registrado + póliza creada automáticamente',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
