// Dashboard consolidado: Ve TODO de GastoCheck + CobraCheck + Banco
// EPICENTRO del sistema

import { createClient } from 'jsr:@supabase/supabase-js@2.43.4';

Deno.serve(async (req) => {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  try {
    const url = new URL(req.url);
    const empresa_id = url.searchParams.get('empresa_id');

    if (!empresa_id) return new Response(JSON.stringify({ error: 'empresa_id requerido' }), { status: 400 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // 1. GASTOS TOTALES (GastoCheck)
    const { data: gastos, error: gastosError } = await supabase
      .from('movimientos_financieros')
      .select('*', { count: 'exact' })
      .eq('empresa_id', empresa_id)
      .eq('tipo_movimiento', 'GASTO');

    const gastos_totales = gastos?.reduce((sum, g) => sum + Math.abs(g.monto), 0) || 0;
    const gastos_count = gastos?.length || 0;

    // 2. INGRESOS TOTALES (CobraCheck)
    const { data: ingresos } = await supabase
      .from('movimientos_financieros')
      .select('*', { count: 'exact' })
      .eq('empresa_id', empresa_id)
      .eq('tipo_movimiento', 'INGRESO');

    const ingresos_totales = ingresos?.reduce((sum, i) => sum + i.monto, 0) || 0;
    const ingresos_count = ingresos?.length || 0;

    // 3. PÓLIZAS GENERADAS
    const { data: polizas } = await supabase
      .from('polizas')
      .select('*', { count: 'exact' })
      .eq('empresa_id', empresa_id);

    const polizas_count = polizas?.length || 0;

    // 4. CAJA ESPERADA (teórica)
    const caja_esperada = ingresos_totales - gastos_totales;

    // 5. PAGOS PENDIENTES
    const { data: pendientes } = await supabase
      .from('movimientos_financieros')
      .select('*', { count: 'exact' })
      .eq('empresa_id', empresa_id)
      .eq('estado_pago', 'PENDIENTE');

    const pendientes_total = pendientes?.reduce((sum, p) => sum + Math.abs(p.monto), 0) || 0;
    const pendientes_count = pendientes?.length || 0;

    // 6. RECONCILIADOS
    const { data: reconciliados } = await supabase
      .from('movimientos_financieros')
      .select('*', { count: 'exact' })
      .eq('empresa_id', empresa_id)
      .eq('es_reconciliado', true);

    const reconciliados_count = reconciliados?.length || 0;

    // 7. GASTOS POR CATEGORÍA (top 5)
    const gastos_por_categoria = {};
    gastos?.forEach(g => {
      const cat = g.categoria || 'Sin categoría';
      gastos_por_categoria[cat] = (gastos_por_categoria[cat] || 0) + Math.abs(g.monto);
    });

    const top_categorias = Object.entries(gastos_por_categoria)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([categoria, monto]) => ({ categoria, monto }));

    // 8. CLIENTES (CobraCheck)
    const { data: clientes } = await supabase
      .from('clientes')
      .select('*', { count: 'exact' })
      .eq('empresa_id', empresa_id);

    const clientes_count = clientes?.length || 0;

    return new Response(
      JSON.stringify({
        consolidado: {
          gastos: {
            total: gastos_totales,
            cantidad: gastos_count,
          },
          ingresos: {
            total: ingresos_totales,
            cantidad: ingresos_count,
          },
          caja: {
            esperada: caja_esperada,
            pendiente: pendientes_total,
            reconciliado: reconciliados_count,
          },
          polizas: {
            generadas: polizas_count,
          },
          clientes: {
            cantidad: clientes_count,
          },
          analisis: {
            top_categorias: top_categorias,
            pendientes: pendientes_count,
            reconciliacion_porciento: gastos_count > 0 ? (reconciliados_count / (gastos_count + ingresos_count)) * 100 : 0,
          },
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
