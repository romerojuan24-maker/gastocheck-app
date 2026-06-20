// Exportar pólizas a formato CONTPAQi (CSV)
// DIFERENCIAL: 10x más rápido que Excel manual

import { createClient } from 'jsr:@supabase/supabase-js@2.43.4';

Deno.serve(async (req) => {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  try {
    const url = new URL(req.url);
    const empresa_id = url.searchParams.get('empresa_id');
    const fecha_inicio = url.searchParams.get('fecha_inicio') || new Date().toISOString().split('T')[0];
    const fecha_fin = url.searchParams.get('fecha_fin') || new Date().toISOString().split('T')[0];

    if (!empresa_id) {
      return new Response(JSON.stringify({ error: 'empresa_id requerido' }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Obtener pólizas en rango de fechas
    const { data: polizas } = await supabase
      .from('polizas')
      .select('*')
      .eq('empresa_id', empresa_id)
      .gte('fecha_poliza', fecha_inicio)
      .lte('fecha_poliza', fecha_fin)
      .eq('cuadrada', true);

    if (!polizas || polizas.length === 0) {
      return new Response('No hay pólizas para exportar', { status: 404 });
    }

    // Generar CSV CONTPAQi
    const csv_lines = [];

    // Header CONTPAQi
    csv_lines.push('FECHA,NUMERO,CONCEPTO,REFERENCIA,CUENTA,DEBIT,CREDIT');

    let numero_poliza = 1;

    polizas.forEach(poliza => {
      const lineas = poliza.lineas || [];

      lineas.forEach(linea => {
        const fecha = poliza.fecha_poliza.split('T')[0];
        const numero = String(numero_poliza).padStart(5, '0');
        const concepto = poliza.concepto || 'Poliza';
        const cuenta = linea.cuenta || 'GENERAL';
        const debit = linea.tipo === 'DEBIT' ? linea.monto : '';
        const credit = linea.tipo === 'CREDIT' ? linea.monto : '';

        csv_lines.push(`${fecha},${numero},"${concepto}","${poliza.id}","${cuenta}",${debit},${credit}`);
      });

      numero_poliza++;
    });

    const csv_content = csv_lines.join('\n');

    // Retornar como descarga
    return new Response(csv_content, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="polizas_${empresa_id}_${fecha_inicio}_${fecha_fin}.csv"`,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
