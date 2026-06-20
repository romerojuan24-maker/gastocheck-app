// Crear póliza automáticamente desde movimiento_financiero
// DIFERENCIAL: 10x más rápido que manual

import { createClient } from 'jsr:@supabase/supabase-js@2.43.4';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { movimiento_id, empresa_id, tipo } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Obtener movimiento
    const { data: movimiento, error: movError } = await supabase
      .from('movimientos_financieros')
      .select('*')
      .eq('id', movimiento_id)
      .single();

    if (movError) return new Response(JSON.stringify({ error: movError }), { status: 400 });

    // Generar líneas de póliza automáticamente
    const lineas = [];
    const monto = Math.abs(movimiento.monto);

    if (tipo === 'GASTO' || movimiento.tipo_movimiento === 'GASTO') {
      // EGRESO: Debit gasto, Credit proveedor
      lineas.push({
        cuenta: `GASTO_${movimiento.categoria || 'GENERAL'}`,
        tipo: 'DEBIT',
        monto: monto,
        descripcion: movimiento.concepto,
      });
      lineas.push({
        cuenta: `PROVEEDOR_${movimiento.rfc_otra_parte || 'DESCONOCIDO'}`,
        tipo: 'CREDIT',
        monto: monto,
        descripcion: movimiento.nombre_otra_parte,
      });
    } else if (tipo === 'INGRESO' || movimiento.tipo_movimiento === 'INGRESO') {
      // INGRESO: Debit banco, Credit cliente
      lineas.push({
        cuenta: 'BANCO_PRINCIPAL',
        tipo: 'DEBIT',
        monto: monto,
        descripcion: `Depósito de ${movimiento.nombre_otra_parte}`,
      });
      lineas.push({
        cuenta: `CLIENTE_${movimiento.rfc_otra_parte || 'DESCONOCIDO'}`,
        tipo: 'CREDIT',
        monto: monto,
        descripcion: movimiento.concepto,
      });
    }

    // Validar: Debit = Credit
    const debit = lineas.filter(l => l.tipo === 'DEBIT').reduce((sum, l) => sum + l.monto, 0);
    const credit = lineas.filter(l => l.tipo === 'CREDIT').reduce((sum, l) => sum + l.monto, 0);

    if (Math.abs(debit - credit) > 0.01) {
      return new Response(JSON.stringify({ error: 'Póliza no cuadra: Debit != Credit' }), { status: 400 });
    }

    // Crear póliza
    const { data: poliza, error: polizaError } = await supabase
      .from('polizas')
      .insert({
        empresa_id,
        movimiento_financiero_id: movimiento_id,
        gasto_id: movimiento.gasto_id,
        factura_id: movimiento.factura_id,
        tipo: tipo === 'INGRESO' ? 'INGRESO' : 'EGRESO',
        fecha_poliza: movimiento.fecha_evento,
        concepto: movimiento.concepto,
        lineas: lineas,
        total_debit: debit,
        total_credit: credit,
        cuadrada: true,
      })
      .select('id')
      .single();

    if (polizaError) {
      return new Response(JSON.stringify({ error: polizaError }), { status: 500 });
    }

    // Actualizar movimiento con referencia a póliza
    await supabase
      .from('movimientos_financieros')
      .update({
        poliza_id: poliza.id,
        estado_contable: 'PÓLIZA_CREADA',
      })
      .eq('id', movimiento_id);

    return new Response(
      JSON.stringify({
        success: true,
        poliza_id: poliza.id,
        lineas: lineas,
        debit: debit,
        credit: credit,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
