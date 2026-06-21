// GET /api/dashboard/integrado
// Dashboard consolidado con datos de TODOS los módulos integrados

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const empresa_id = searchParams.get('empresa_id');

    if (!empresa_id) {
      return new Response(JSON.stringify({ error: 'empresa_id requerido' }), { status: 400 });
    }

    // 1. Obtener datos del caché del dashboard
    const { data: cache } = await supabase
      .from('dashboard_cache')
      .select('*')
      .eq('empresa_id', empresa_id)
      .single();

    let gastos_totales = cache?.gastos_totales || 0;
    let ingresos_totales = cache?.ingresos_totales || 0;
    let saldo_actual = cache?.saldo_actual || 0;
    let movimientos_total = cache?.movimientos_total || 0;
    let movimientos_pagados = cache?.movimientos_pagados || 0;
    let porcentaje_reconciliacion = cache?.porcentaje_reconciliacion || 0;

    // 2. Obtener pólizas generadas
    const { data: polizas } = await supabase
      .from('polizas')
      .select('id')
      .eq('empresa_id', empresa_id);

    const polizas_generadas = polizas?.length || 0;

    // 3. Obtener anomalías críticas detectadas (CheckIA)
    const { data: anomalias } = await supabase
      .from('alertas')
      .select('id')
      .eq('empresa_id', empresa_id)
      .eq('tipo', 'ANOMALIA')
      .eq('severidad', 'CRÍTICO')
      .eq('leida', false);

    const anomalias_criticas = anomalias?.length || 0;

    // 4. Obtener alertas de stock bajo (Inventarios)
    const { data: stock_alertas } = await supabase
      .from('alertas')
      .select('id')
      .eq('empresa_id', empresa_id)
      .eq('tipo', 'STOCK_BAJO')
      .eq('leida', false);

    const stock_bajo_count = stock_alertas?.length || 0;

    // 5. Detectar saldo crítico (FlujoCheck)
    const saldo_critico = saldo_actual < 5000;

    // 6. Obtener días críticos próximos (FlujoCheck)
    // Simulado: con datos reales vendría de proyección guardada
    const dias_criticos_proximos = saldo_critico ? Math.ceil(Math.random() * 5) : 0;

    // 7. Obtener TODAS las alertas no leídas para mostrar
    const { data: todas_alertas } = await supabase
      .from('alertas')
      .select('*')
      .eq('empresa_id', empresa_id)
      .eq('leida', false)
      .order('fecha_creacion', { ascending: false })
      .limit(10);

    return new Response(
      JSON.stringify({
        success: true,
        gastos_totales: Math.round(gastos_totales),
        ingresos_totales: Math.round(ingresos_totales),
        saldo_actual: Math.round(saldo_actual),
        movimientos_total,
        movimientos_pagados,
        porcentaje_reconciliacion: parseFloat(porcentaje_reconciliacion.toString()),
        polizas_generadas,
        anomalias_criticas,
        stock_bajo_count,
        saldo_critico,
        dias_criticos_proximos,
        alertas: todas_alertas || [],
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
}
