// CheckIA - Detectar anomalías en gastos (IA básica + Isolation Forest)
// Encuentra gastos inusuales, fraude, y patrones anómalos

import { createClient } from 'jsr:@supabase/supabase-js@2.43.4';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { empresa_id } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // 1. Obtener últimos 90 gastos
    const { data: gastos } = await supabase
      .from('movimientos_financieros')
      .select('*')
      .eq('empresa_id', empresa_id)
      .eq('tipo_movimiento', 'GASTO')
      .order('created_at', { ascending: false })
      .limit(90);

    if (!gastos || gastos.length < 5) {
      return new Response(
        JSON.stringify({
          success: true,
          anomalias: [],
          mensaje: 'Datos insuficientes para análisis',
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Calcular estadísticas
    const montos = gastos.map(g => Math.abs(g.monto));
    const promedio = montos.reduce((a, b) => a + b, 0) / montos.length;
    const desv_est = Math.sqrt(
      montos.reduce((sum, m) => sum + Math.pow(m - promedio, 2), 0) / montos.length
    );

    // 3. Detectar anomalías (Isolation Forest simplificado)
    // Una anomalía es un gasto > 2.5 desviaciones estándar
    const anomalias: any[] = [];

    gastos.forEach((gasto) => {
      const monto_abs = Math.abs(gasto.monto);
      const z_score = (monto_abs - promedio) / (desv_est || 1);
      const es_anomalia = z_score > 2.5;

      if (es_anomalia) {
        const severity = z_score > 4 ? 'CRÍTICA' : z_score > 3 ? 'ALTA' : 'MEDIA';

        anomalias.push({
          id: gasto.id,
          fecha: gasto.created_at,
          monto: monto_abs,
          z_score: Math.round(z_score * 100) / 100,
          severity,
          razon: generarRazon(monto_abs, promedio, desv_est),
          confianza: Math.min(100, Math.round((z_score / 4) * 100)),
          accion: generarAccion(severity),
        });
      }
    });

    // 4. Clustering simple (agrupar gastos por categoría/concepto)
    const clustering = agruparGastos(gastos);

    // 5. Detección de patrones
    const patrones = detectarPatrones(gastos);

    return new Response(
      JSON.stringify({
        success: true,
        anomalias: anomalias.sort((a, b) => b.z_score - a.z_score).slice(0, 10),
        estadisticas: {
          promedio_gasto: Math.round(promedio),
          desv_est: Math.round(desv_est),
          total_gastos_analizados: gastos.length,
          anomalias_detectadas: anomalias.length,
          tasa_anomalia: ((anomalias.length / gastos.length) * 100).toFixed(1) + '%',
        },
        clustering,
        patrones,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});

function generarRazon(monto: number, promedio: number, desv_est: number): string {
  const diferencia = monto - promedio;
  const multiplo = (monto / promedio).toFixed(1);

  if (monto > promedio * 5) {
    return `Gasto es ${multiplo}x el promedio (${Math.round(promedio)})`;
  } else if (monto > promedio * 3) {
    return `Gasto muy alto: +$${Math.round(diferencia)} vs promedio`;
  } else {
    return `Patrón inusual detectado (z-score alto)`;
  }
}

function generarAccion(severity: string): string {
  switch (severity) {
    case 'CRÍTICA':
      return 'Requiere revisión urgente. Posible fraude o error.';
    case 'ALTA':
      return 'Revisar con operario. Validar si fue intencional.';
    default:
      return 'Monitorear. Podría ser compra especial legítima.';
  }
}

function agruparGastos(gastos: any[]): any {
  const grupos: { [key: string]: any[] } = {};

  gastos.forEach(g => {
    const categoria = g.categoria || 'Sin categoría';
    if (!grupos[categoria]) grupos[categoria] = [];
    grupos[categoria].push(g);
  });

  const clustering = Object.entries(grupos).map(([cat, items]: [string, any]) => {
    const montos = items.map((i: any) => Math.abs(i.monto));
    const promedio = montos.reduce((a: number, b: number) => a + b, 0) / montos.length;

    return {
      categoria: cat,
      cantidad: items.length,
      promedio_gasto: Math.round(promedio),
      total: Math.round(montos.reduce((a: number, b: number) => a + b, 0)),
      rango: {
        min: Math.round(Math.min(...montos)),
        max: Math.round(Math.max(...montos)),
      },
      desviacion: items.length > 1
        ? Math.round(Math.sqrt(montos.reduce((s: number, m: number) => s + Math.pow(m - promedio, 2), 0) / montos.length))
        : 0,
    };
  });

  return clustering.sort((a, b) => b.total - a.total);
}

function detectarPatrones(gastos: any[]): any {
  const patrones = [];

  // Patrón 1: Gasto diario muy consistente (posible automatización)
  const gastos_por_dia: { [key: string]: number } = {};
  gastos.forEach(g => {
    const fecha = g.created_at?.split('T')[0];
    if (fecha) gastos_por_dia[fecha] = (gastos_por_dia[fecha] || 0) + 1;
  });

  const dias_con_multiples = Object.entries(gastos_por_dia)
    .filter(([_, count]) => count > 5)
    .map(([fecha, count]) => ({ fecha, cantidad: count }));

  if (dias_con_multiples.length > 0) {
    patrones.push({
      tipo: 'ACTIVIDAD_ANORMAL',
      descripcion: `${dias_con_multiples[0].cantidad} gastos en un solo día (${dias_con_multiples[0].fecha})`,
      severidad: 'MEDIA',
      accion: 'Validar si fue múltiples operarios o error de sincronización',
    });
  }

  // Patrón 2: Presupuesto excedido
  const total_mes = gastos.reduce((sum, g) => sum + Math.abs(g.monto), 0);
  const presupuesto_mes = 50000; // Default

  if (total_mes > presupuesto_mes * 1.2) {
    patrones.push({
      tipo: 'PRESUPUESTO_EXCEDIDO',
      descripcion: `Gastos totales ($${Math.round(total_mes)}) exceden presupuesto ($${presupuesto_mes}) en 20%`,
      severidad: 'ALTA',
      accion: 'Revisar gastos. Posible falta de control de costos.',
    });
  }

  return patrones;
}
