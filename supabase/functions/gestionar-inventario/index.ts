// Inventarios - Gestionar stock (entrada/salida)
// Rastrear artículos, alertas de stock bajo, órdenes automáticas

import { createClient } from 'jsr:@supabase/supabase-js@2.43.4';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { empresa_id, accion, producto_id, cantidad, tipo, nota } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // 1. Obtener producto actual
    const { data: producto } = await supabase
      .from('inventario_productos')
      .select('*')
      .eq('id', producto_id)
      .single();

    if (!producto) {
      return new Response(JSON.stringify({ error: 'Producto no encontrado' }), { status: 404 });
    }

    let stock_nuevo = producto.stock_actual;
    let movimiento_tipo = tipo || 'ENTRADA';

    if (accion === 'entrada') {
      stock_nuevo = producto.stock_actual + cantidad;
      movimiento_tipo = 'ENTRADA';
    } else if (accion === 'salida') {
      stock_nuevo = producto.stock_actual - cantidad;
      if (stock_nuevo < 0) stock_nuevo = 0;
      movimiento_tipo = 'SALIDA';
    }

    // 2. Actualizar stock
    const { error: updateError } = await supabase
      .from('inventario_productos')
      .update({
        stock_actual: stock_nuevo,
        stock_reservado: Math.max(0, producto.stock_reservado - (accion === 'salida' ? cantidad : 0)),
        fecha_ultima_actualizacion: new Date().toISOString(),
      })
      .eq('id', producto_id);

    if (updateError) throw updateError;

    // 3. Registrar movimiento
    const { data: movimiento, error: movError } = await supabase
      .from('inventario_movimientos')
      .insert({
        empresa_id,
        producto_id,
        tipo: movimiento_tipo,
        cantidad,
        stock_anterior: producto.stock_actual,
        stock_nuevo,
        nota,
        fecha: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (movError) throw movError;

    // 4. Detectar si stock es bajo
    let orden_generada = false;
    let alerta = null;

    if (stock_nuevo <= producto.stock_minimo) {
      alerta = 'STOCK_BAJO';

      // Generar orden automática si está habilitada
      if (producto.auto_ordenar) {
        const cantidad_orden = producto.stock_maximo - stock_nuevo;
        const { error: ordenError } = await supabase
          .from('inventario_ordenes')
          .insert({
            empresa_id,
            producto_id,
            proveedor_id: producto.proveedor_id,
            cantidad: cantidad_orden,
            estado: 'PENDIENTE',
            fecha_creacion: new Date().toISOString(),
            fecha_entrega_esperada: new Date(Date.now() + 7 * 86400000).toISOString(),
          });

        if (!ordenError) {
          orden_generada = true;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        movimiento_id: movimiento.id,
        producto: {
          id: producto_id,
          nombre: producto.nombre,
          stock_anterior: producto.stock_actual,
          stock_nuevo,
          stock_minimo: producto.stock_minimo,
          stock_maximo: producto.stock_maximo,
        },
        alerta,
        orden_generada,
        mensaje: `Stock actualizado: ${producto.stock_actual} → ${stock_nuevo}`,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
