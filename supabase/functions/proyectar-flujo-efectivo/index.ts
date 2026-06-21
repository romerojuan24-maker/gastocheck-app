// Proyectar flujo de efectivo (próximos 30 días)
// CORE: Usa histórico de gastos + facturas vencidas para predecir caja

import { createClient } from 'jsr:@supabase/supabase-js@2.43.4';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { empresa_id, dias_proyeccion = 30 } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // 1. Obtener saldo actual (suma de ingresos - egresos)
    const { data: movimientos } = await supabase
      .from('movimientos_financieros')
      .select('monto, tipo_movimiento')
      .eq('empresa_id', empresa_id);

    const saldo_actual = (movimientos || []).reduce((sum, m) => {
      return sum + (m.tipo_movimiento === 'INGRESO' ? m.monto : -Math.abs(m.monto));
    }, 100000); // Saldo inicial default: $100k

    // 2. Calcular promedio diario de gastos (últimos 30 días)
    const hace_30_dias = new Date();
    hace_30_dias.setDate(hace_30_dias.getDate() - 30);

    const { data: gastos_historicos } = await supabase
      .from('movimientos_financieros')
      .select('monto')
      .eq('empresa_id', empresa_id)
      .eq('tipo_movimiento', 'GASTO')
      .gte('created_at', hace_30_dias.toISOString());

    const total_gastos = (gastos_historicos || []).reduce((sum, g) => sum + Math.abs(g.monto), 0);
    const promedio_gasto_diario = total_gastos / 30 || 500; // Default: $500/día si no hay datos

    // 3. Obtener facturas pendientes (ingresos esperados)
    const { data: facturas_pendientes } = await supabase
      .from('movimientos_financieros')
      .select('monto, fecha_evento')
      .eq('empresa_id', empresa_id)
      .eq('tipo_movimiento', 'INGRESO')
      .eq('estado_pago', 'PENDIENTE')
      .lte('fecha_evento', new Date(Date.now() + dias_proyeccion * 86400000).toISOString());

    // 4. Proyectar 30 días
    const proyeccion = [];
    let saldo = saldo_actual;
    const hoy = new Date();

    for (let dia = 1; dia <= dias_proyeccion; dia++) {
      const fecha_dia = new Date(hoy);
      fecha_dia.setDate(fecha_dia.getDate() + dia);
      const fecha_iso = fecha_dia.toISOString().split('T')[0];

      // Egresos (promedio diario)
      const egresos_hoy = promedio_gasto_diario;

      // Ingresos (facturas vencidas hoy)
      const ingresos_hoy = (facturas_pendientes || [])
        .filter(f => f.fecha_evento?.split('T')[0] === fecha_iso)
        .reduce((sum, f) => sum + f.monto, 0);

      // Calcular saldo
      saldo = saldo - egresos_hoy + ingresos_hoy;

      // Detectar alertas
      const alertas = [];
      if (saldo < 10000) alertas.push('Saldo bajo');
      if (saldo < 5000) alertas.push('Saldo crítico');
      if (ingresos_hoy > 0) alertas.push(`Cobro cliente: $${ingresos_hoy.toFixed(2)}`);

      proyeccion.push({
        dia,
        fecha: fecha_iso,
        saldo_anterior: saldo + egresos_hoy - ingresos_hoy,
        ingresos: ingresos_hoy,
        egresos: egresos_hoy,
        saldo,
        alertas: alertas.length > 0 ? alertas : null,
        es_critico: saldo < 5000,
        es_bajo: saldo < 10000,
      });
    }

    // 5. Detectar días críticos
    const dias_criticos = proyeccion
      .filter(p => p.es_critico)
      .map(p => p.dia);

    // 6. Recomendaciones
    const recomendaciones = [];
    const saldo_final = proyeccion[proyeccion.length - 1]?.saldo || saldo_actual;
    const promedio_saldo = proyeccion.reduce((sum, p) => sum + p.saldo, 0) / proyeccion.length;

    if (saldo_final < 5000) {
      recomendaciones.push('ALERTA: Saldo final muy bajo. Considera aumentar ingresos.');
    }
    if (promedio_saldo < 15000) {
      recomendaciones.push('El saldo promedio es bajo. Corre riesgo de insolvencia.');
    }
    if (dias_criticos.length > 0) {
      recomendaciones.push(`${dias_criticos.length} días con saldo crítico (<$5k). Planifica cobros.`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        saldo_actual,
        saldo_final,
        promedio_gasto_diario: Math.round(promedio_gasto_diario * 100) / 100,
        proyeccion,
        dias_criticos,
        recomendaciones,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
