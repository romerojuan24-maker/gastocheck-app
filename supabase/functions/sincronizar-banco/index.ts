// Sincronizar movimientos bancarios + reconciliación cruzada AUTOMÁTICA
// NÚCLEO: Busca match en GastoCheck + CobraCheck

import { createClient } from 'jsr:@supabase/supabase-js@2.43.4';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { empresa_id, banco_cuenta_id, movimientos_simulados } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const resultados = [];

    for (const mov of movimientos_simulados) {
      // 1. Insertar movimiento bancario
      const { data: banco_mov, error: movError } = await supabase
        .from('banco_movimientos')
        .insert({
          banco_cuenta_id,
          fecha: mov.fecha,
          concepto: mov.concepto,
          monto: mov.monto,
          tipo: mov.monto < 0 ? 'EGRESO' : 'INGRESO',
          plaid_transaction_id: mov.id,
        })
        .select('id, monto, fecha')
        .single();

      if (movError) {
        resultados.push({ error: movError });
        continue;
      }

      // 2. RECONCILIACIÓN CRUZADA AUTOMÁTICA
      let match_type = 'SIN_MATCH';
      let match_id = null;
      let confianza = 0;

      if (mov.monto < 0) {
        // EGRESO: Buscar en GastoCheck
        const { data: gastos } = await supabase
          .from('movimientos_financieros')
          .select('id, monto, fecha_evento, estado_pago')
          .eq('empresa_id', empresa_id)
          .eq('tipo_movimiento', 'GASTO')
          .eq('estado_pago', 'PENDIENTE');

        for (const gasto of gastos || []) {
          // Match: monto exacto + fecha ±1 día
          if (Math.abs(Math.abs(gasto.monto) - Math.abs(mov.monto)) < 0.01) {
            const fecha_diff =
              Math.abs(new Date(gasto.fecha_evento).getTime() - new Date(mov.fecha).getTime()) /
              (1000 * 3600 * 24);

            if (fecha_diff <= 1) {
              match_type = 'GASTO';
              match_id = gasto.id;
              confianza = 0.95;
              break;
            }
          }
        }
      } else {
        // INGRESO: Buscar en CobraCheck
        const { data: facturas } = await supabase
          .from('movimientos_financieros')
          .select('id, monto, fecha_evento, estado_pago')
          .eq('empresa_id', empresa_id)
          .eq('tipo_movimiento', 'INGRESO')
          .eq('estado_pago', 'PENDIENTE');

        for (const factura of facturas || []) {
          // Match: monto exacto + fecha ±2 días (los depósitos pueden tardar)
          if (Math.abs(factura.monto - mov.monto) < 0.01) {
            const fecha_diff =
              Math.abs(new Date(factura.fecha_evento).getTime() - new Date(mov.fecha).getTime()) /
              (1000 * 3600 * 24);

            if (fecha_diff <= 2) {
              match_type = 'PAGO_CLIENTE';
              match_id = factura.id;
              confianza = 0.95;
              break;
            }
          }
        }
      }

      // 3. Actualizar movimiento financiero si hay match
      if (match_id) {
        await supabase
          .from('movimientos_financieros')
          .update({
            banco_movimiento_id: banco_mov.id,
            estado_pago: 'PAGADO',
            es_reconciliado: true,
            trazabilidad_completa: true,
            fecha_reconciliacion: new Date().toISOString(),
          })
          .eq('id', match_id);
      }

      resultados.push({
        banco_movimiento_id: banco_mov.id,
        monto: mov.monto,
        match_type,
        confianza,
        mensaje: match_type === 'SIN_MATCH' ? 'No se encontró match' : 'Reconciliado automáticamente',
      });
    }

    // 4. Actualizar flujo_efectivo_diario
    // (Simplified: just calculate for today)
    const hoy = new Date().toISOString().split('T')[0];
    const { data: movs_hoy } = await supabase
      .from('banco_movimientos')
      .select('monto')
      .eq('banco_cuenta_id', banco_cuenta_id)
      .gte('fecha', hoy)
      .lte('fecha', hoy);

    const ingresos = (movs_hoy || []).filter(m => m.monto > 0).reduce((s, m) => s + m.monto, 0);
    const egresos = (movs_hoy || []).filter(m => m.monto < 0).reduce((s, m) => s + m.monto, 0);

    return new Response(
      JSON.stringify({
        success: true,
        procesados: resultados.length,
        reconciliados: resultados.filter(r => r.match_type !== 'SIN_MATCH').length,
        detalle: resultados,
        resumenes: {
          ingresos_hoy: ingresos,
          egresos_hoy: Math.abs(egresos),
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
