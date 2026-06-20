// Edge Function: guardar-gasto-integrado
// Propósito: Guardar gasto Y crear movimiento_financiero automáticamente
// Fecha: 2026-06-20
// CRÍTICO: Esto es la integración con arquitectura integral

import { createClient } from 'jsr:@supabase/supabase-js@2.43.4';

interface GastoRequest {
  empresa_id: string;
  monto: number;
  fecha: string;
  concepto: string;
  rfc_proveedor: string;
  nombre_proveedor: string;
  categoria?: string;
  ocr_image_url?: string;
  ocr_confidence?: string;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { empresa_id, monto, fecha, concepto, rfc_proveedor, nombre_proveedor, categoria, ocr_image_url, ocr_confidence } = (await req.json()) as GastoRequest;

    // Validaciones básicas
    if (!empresa_id || !monto || !fecha || !concepto) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos' }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // PASO 1: Crear movimiento_financiero (CRÍTICO - arquitectura integral)
    const { data: movimiento, error: movError } = await supabase
      .from('movimientos_financieros')
      .insert({
        empresa_id,
        tipo_movimiento: 'GASTO',
        monto: -Math.abs(monto),  // Negativo para egresos
        fecha_evento: fecha,
        concepto,
        rfc_otra_parte: rfc_proveedor,
        nombre_otra_parte: nombre_proveedor,
        categoria: categoria || 'Sin categorizar',
        estado_registro: 'REGISTRADO',
        estado_pago: 'PENDIENTE',
        requiere_revision: ocr_confidence === 'low' || ocr_confidence === 'medium',
      })
      .select('id')
      .single();

    if (movError) {
      console.error('Error creando movimiento:', movError);
      return new Response(JSON.stringify({ error: 'Error creando movimiento', detail: movError }), { status: 500 });
    }

    // PASO 2: Crear gasto (vinculado a movimiento)
    const { data: gasto, error: gastoError } = await supabase
      .from('gastos')
      .insert({
        empresa_id,
        movimiento_id: movimiento.id,  // VÍNCULO CON ARQUITECTURA
        monto: -Math.abs(monto),
        fecha,
        concepto,
        proveedor: nombre_proveedor,
        rfc_proveedor,
        categoria: categoria || 'Sin categorizar',
        origen: 'OCR',
        ocr_image_url,
        ocr_confidence,
      })
      .select('id')
      .single();

    if (gastoError) {
      console.error('Error creando gasto:', gastoError);
      return new Response(JSON.stringify({ error: 'Error creando gasto', detail: gastoError }), { status: 500 });
    }

    // PASO 3: Crear póliza automáticamente (DIFERENCIAL)
    const { data: poliza, error: polizaError } = await supabase
      .from('polizas')
      .insert({
        empresa_id,
        movimiento_financiero_id: movimiento.id,  // VÍNCULO CON ARQUITECTURA
        gasto_id: gasto.id,
        tipo: 'EGRESO',
        fecha_poliza: fecha,
        concepto: `Gasto: ${concepto}`,
        // Líneas de póliza (debit/credit automático)
        lineas: [
          {
            cuenta: 'GASTO_' + (categoria || 'GENERAL'),
            tipo: 'DEBIT',
            monto: Math.abs(monto),
          },
          {
            cuenta: 'PROVEEDOR_' + rfc_proveedor,
            tipo: 'CREDIT',
            monto: Math.abs(monto),
          },
        ],
      })
      .select('id')
      .single();

    if (polizaError) {
      console.error('Error creando póliza (no bloquea):', polizaError);
      // No retornar error, solo loguear - gasto se guardó
    }

    // PASO 4: Actualizar movimiento con referencia a póliza
    if (poliza) {
      await supabase
        .from('movimientos_financieros')
        .update({
          poliza_id: poliza.id,
          estado_contable: 'PÓLIZA_CREADA',
        })
        .eq('id', movimiento.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        movimiento_id: movimiento.id,
        gasto_id: gasto.id,
        poliza_id: poliza?.id,
        message: 'Gasto guardado + póliza creada automáticamente',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
