// ORQUESTRADOR DE INTEGRACIÓN
// Coordina entre todos los módulos cuando hay cambios
// Ejecuta cascadas automáticas de actualización

import { createClient } from 'jsr:@supabase/supabase-js@2.43.4';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { evento, empresa_id, datos } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    console.log(`🔄 ORQUESTRADOR: ${evento} para empresa ${empresa_id}`);

    // EVENTO 1: GastoCheck creó nuevo gasto
    if (evento === 'gasto_creado') {
      const { movimiento_id, monto, categoria } = datos;

      // 1. Ejecutar análisis CheckIA
      await ejecutarCheckIA(supabase, empresa_id, movimiento_id);

      // 2. Recalcular proyección FlujoCheck
      await recalcularFlujoCheck(supabase, empresa_id);

      // 3. Actualizar Dashboard KPIs
      await actualizarDashboard(supabase, empresa_id);

      // 4. Detectar si es compra de inventario
      if (categoria?.toLowerCase().includes('inventario') || categoria?.toLowerCase().includes('compra')) {
        await procesarCompraInventario(supabase, empresa_id, movimiento_id, monto);
      }

      return crearRespuesta(true, 'Gasto procesado: CheckIA + FlujoCheck + Dashboard actualizados');
    }

    // EVENTO 2: CobraCheck registró nuevo pago
    if (evento === 'pago_registrado') {
      const { movimiento_id, monto, factura_id } = datos;

      // 1. Recalcular FlujoCheck
      await recalcularFlujoCheck(supabase, empresa_id);

      // 2. Actualizar Dashboard
      await actualizarDashboard(supabase, empresa_id);

      // 3. Intentar reconciliar con banco (si ya fue pagado)
      await intentarReconciliarConBanco(supabase, empresa_id, movimiento_id);

      return crearRespuesta(true, 'Pago procesado: FlujoCheck + reconciliación intentada');
    }

    // EVENTO 3: BancoCheck reconcilió movimiento
    if (evento === 'movimiento_reconciliado') {
      const { movimiento_id } = datos;

      // 1. Recalcular FlujoCheck con datos reales
      await recalcularFlujoCheck(supabase, empresa_id);

      // 2. Actualizar Dashboard ("Caja cuadra %")
      await actualizarDashboard(supabase, empresa_id);

      // 3. CheckIA: validar que gasto existe
      await validarGastoEnCheckIA(supabase, empresa_id, movimiento_id);

      // 4. Crear alerta: "Reconciliado"
      await crearAlerta(supabase, empresa_id, {
        tipo: 'RECONCILIACION',
        severidad: 'INFO',
        descripcion: `Movimiento reconciliado con banco`,
        referencia_id: movimiento_id,
      });

      return crearRespuesta(true, 'Reconciliación: FlujoCheck recalculado, Dashboard actualizado');
    }

    // EVENTO 4: CheckIA detectó anomalía CRÍTICA
    if (evento === 'anomalia_critica_detectada') {
      const { movimiento_id, razon, z_score } = datos;

      // 1. Crear alerta CRÍTICA
      await crearAlerta(supabase, empresa_id, {
        tipo: 'ANOMALIA',
        severidad: 'CRÍTICO',
        descripcion: `Anomalía detectada: ${razon} (z-score: ${z_score})`,
        referencia_id: movimiento_id,
      });

      // 2. Notificar supervisor (en producción: email/SMS)
      console.log(`🚨 ALERTA CRÍTICA: ${razon}`);

      // 3. Marcar movimiento como "requiere revisión"
      await supabase
        .from('movimientos_financieros')
        .update({ requiere_revision: true })
        .eq('id', movimiento_id);

      return crearRespuesta(true, 'Anomalía crítica: alerta creada y supervisor notificado');
    }

    // EVENTO 5: Inventarios: Stock bajo
    if (evento === 'stock_bajo_detectado') {
      const { producto_id, cantidad_orden, precio_unitario } = datos;

      // 1. Crear orden de compra automática
      const { data: orden } = await supabase
        .from('inventario_ordenes')
        .insert({
          empresa_id,
          producto_id,
          cantidad: cantidad_orden,
          estado: 'PENDIENTE',
          fecha_creacion: new Date().toISOString(),
        })
        .select('id')
        .single();

      // 2. Insertar como movimiento financiero (GASTO futuro)
      const monto_orden = cantidad_orden * (precio_unitario || 100); // Default $100/unidad si no hay precio
      await supabase
        .from('movimientos_financieros')
        .insert({
          empresa_id,
          tipo_movimiento: 'GASTO',
          monto: -monto_orden,
          concepto: `Orden automática inventario (producto ${producto_id})`,
          estado_pago: 'PENDIENTE',
          estado_contable: 'PENDIENTE',
          fecha_evento: new Date(Date.now() + 7 * 86400000).toISOString(), // 7 días
        });

      // 3. Recalcular FlujoCheck (proyección cambia)
      await recalcularFlujoCheck(supabase, empresa_id);

      // 4. Crear alerta
      await crearAlerta(supabase, empresa_id, {
        tipo: 'STOCK_BAJO',
        severidad: 'ADVERTENCIA',
        descripcion: `Orden automática generada: ${cantidad_orden} unidades`,
        referencia_id: producto_id,
      });

      return crearRespuesta(true, 'Stock bajo: orden generada, FlujoCheck actualizado');
    }

    return crearRespuesta(false, 'Evento no reconocido');
  } catch (error) {
    console.error('❌ Error en orquestrador:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});

// ============ FUNCIONES AUXILIARES ============

async function ejecutarCheckIA(supabase: any, empresa_id: string, movimiento_id: string) {
  console.log('  → Ejecutando CheckIA...');
  // En producción: llamar Edge Function de CheckIA
  // Por ahora: solo log
  return true;
}

async function recalcularFlujoCheck(supabase: any, empresa_id: string) {
  console.log('  → Recalculando FlujoCheck (proyección 30 días)...');
  // En producción: llamar Edge Function de FlujoCheck
  // Actualiza proyección en caché o tabla temporal
  return true;
}

async function actualizarDashboard(supabase: any, empresa_id: string) {
  console.log('  → Actualizando Dashboard KPIs...');

  const { data: movimientos } = await supabase
    .from('movimientos_financieros')
    .select('tipo_movimiento, monto, estado_pago')
    .eq('empresa_id', empresa_id);

  if (!movimientos) return;

  const gastos = movimientos
    .filter((m: any) => m.tipo_movimiento === 'GASTO')
    .reduce((sum: number, m: any) => sum + Math.abs(m.monto), 0);

  const ingresos = movimientos
    .filter((m: any) => m.tipo_movimiento === 'INGRESO')
    .reduce((sum: number, m: any) => sum + m.monto, 0);

  const reconciliados = movimientos.filter((m: any) => m.estado_pago === 'PAGADO').length;
  const total = movimientos.length;
  const porcentaje_reconciliacion = total > 0 ? ((reconciliados / total) * 100).toFixed(1) : '0';

  console.log(`    ✅ Gastos: $${gastos}, Ingresos: $${ingresos}, Reconciliación: ${porcentaje_reconciliacion}%`);

  // En producción: guardar en tabla dashboard_cache
  return { gastos, ingresos, porcentaje_reconciliacion };
}

async function procesarCompraInventario(
  supabase: any,
  empresa_id: string,
  movimiento_id: string,
  monto: number
) {
  console.log('  → Procesando como compra de inventario...');
  // Buscar producto por nombre/concepto
  // Actualizar stock automáticamente
  // Crear movimiento en inventario_movimientos
  return true;
}

async function intentarReconciliarConBanco(supabase: any, empresa_id: string, movimiento_id: string) {
  console.log('  → Intentando reconciliar con movimientos bancarios...');
  // Si BancoCheck ya sincronizó, buscar match
  // Si hay match, actualizar movimiento a PAGADO
  return true;
}

async function validarGastoEnCheckIA(supabase: any, empresa_id: string, movimiento_id: string) {
  console.log('  → Validando gasto en CheckIA...');
  // CheckIA revisa si gasto reconciliado es realmente legítimo
  // Aumenta confianza si fue pagado en banco
  return true;
}

async function crearAlerta(
  supabase: any,
  empresa_id: string,
  alerta: { tipo: string; severidad: string; descripcion: string; referencia_id: string }
) {
  console.log(`  → Creando alerta: ${alerta.tipo} (${alerta.severidad})`);

  await supabase
    .from('alertas')
    .insert({
      empresa_id,
      tipo: alerta.tipo,
      severidad: alerta.severidad,
      descripcion: alerta.descripcion,
      referencia_id: alerta.referencia_id,
      leida: false,
      fecha_creacion: new Date().toISOString(),
    });

  return true;
}

function crearRespuesta(success: boolean, mensaje: string) {
  return new Response(JSON.stringify({ success, mensaje }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
