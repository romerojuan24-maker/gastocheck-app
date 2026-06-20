// Reconciliación automática: Busca si gasto fue pagado
// NÚCLEO: Válida que gasto tiene pago en banco

import { createClient } from 'jsr:@supabase/supabase-js@2.43.4';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { empresa_id, gasto_id } = await req.json();

    if (!empresa_id || !gasto_id) {
      return new Response(JSON.stringify({ error: 'empresa_id y gasto_id requeridos' }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // 1. Obtener gasto
    const { data: gasto } = await supabase
      .from('gastos')
      .select('*, movimientos_financieros(*)')
      .eq('id', gasto_id)
      .single();

    if (!gasto) {
      return new Response(JSON.stringify({ error: 'Gasto no encontrado' }), { status: 404 });
    }

    const movimiento = gasto.movimientos_financieros[0];
    if (!movimiento) {
      return new Response(JSON.stringify({ error: 'Movimiento no encontrado' }), { status: 404 });
    }

    // 2. Buscar egreso en banco que coincida (±1 día, monto exacto)
    const { data: banco_movimientos } = await supabase
      .from('banco_movimientos')
      .select('*')
      .eq('empresa_id', empresa_id)
      .eq('tipo', 'EGRESO')
      .lte('fecha', movimiento.fecha_evento + 3) // 3 días después
      .gte('fecha', movimiento.fecha_evento - 1); // 1 día antes

    let match = null;
    let confianza = 0;

    if (banco_movimientos) {
      for (const bm of banco_movimientos) {
        // Validar monto exacto
        if (Math.abs(Math.abs(bm.monto) - Math.abs(movimiento.monto)) < 0.01) {
          // Validar fecha (±1 día)
          const fecha_diff = Math.abs(
            new Date(bm.fecha).getTime() - new Date(movimiento.fecha_evento).getTime()
          ) / (1000 * 3600 * 24);

          if (fecha_diff <= 1) {
            match = bm;
            confianza = 0.95; // Alta confianza si monto y fecha coinciden
            break;
          } else if (fecha_diff <= 3) {
            match = bm;
            confianza = 0.70; // Confianza media si está dentro de 3 días
          }
        }
      }
    }

    if (match) {
      // Actualizar movimiento con referencia a banco
      const { error: updError } = await supabase
        .from('movimientos_financieros')
        .update({
          banco_movimiento_id: match.id,
          estado_pago: 'PAGADO',
          es_reconciliado: true,
          trazabilidad_completa: true,
          fecha_reconciliacion: new Date().toISOString(),
        })
        .eq('id', movimiento.id);

      if (!updError) {
        return new Response(
          JSON.stringify({
            success: true,
            reconciliado: true,
            banco_movimiento_id: match.id,
            confianza: confianza,
            message: `Gasto reconciliado automáticamente (confianza: ${(confianza * 100).toFixed(0)}%)`,
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reconciliado: false,
        message: 'No se encontró movimiento bancario coincidente',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
