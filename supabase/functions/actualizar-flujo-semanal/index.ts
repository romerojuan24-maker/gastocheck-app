import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { empresa_id, plan_id, evento_tipo, monto, descripcion } = await req.json()

    // Validar inputs
    if (!empresa_id || !plan_id || !evento_tipo || !monto) {
      return new Response(
        JSON.stringify({ error: "Faltan parámetros requeridos" }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Crear cliente Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // 1. Obtener plan actual
    const { data: plan, error: errorPlan } = await supabase
      .from("plan_pagos_semanal")
      .select("caja_actual, caja_inicial")
      .eq("id", plan_id)
      .single()

    if (errorPlan || !plan) {
      return new Response(
        JSON.stringify({ error: "Plan no encontrado" }),
        { status: 404, headers: corsHeaders }
      )
    }

    // 2. Calcular nueva caja
    let caja_nueva = plan.caja_actual
    if (evento_tipo === "INGRESO") {
      caja_nueva += monto
    } else if (evento_tipo === "EGRESO") {
      caja_nueva -= monto
    }

    // Validar que caja no quede negativa
    if (caja_nueva < 0) {
      return new Response(
        JSON.stringify({
          error: "Flujo insuficiente",
          caja_disponible: plan.caja_actual,
          caja_requerida: Math.abs(caja_nueva),
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // 3. Actualizar plan
    const { error: errorUpdate } = await supabase
      .from("plan_pagos_semanal")
      .update({
        caja_actual: caja_nueva,
        actualizado_en: new Date().toISOString(),
        actualizado_por: "SISTEMA",
      })
      .eq("id", plan_id)

    if (errorUpdate) {
      return new Response(
        JSON.stringify({ error: "Error actualizando plan: " + errorUpdate.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    // 4. Si es INGRESO, marcar ingresos como recibidos
    if (evento_tipo === "INGRESO") {
      await supabase
        .from("ingreso_semanal_esperado")
        .update({
          recibido: true,
          recibido_en: new Date().toISOString(),
        })
        .eq("plan_id", plan_id)
        .like("cliente_nombre", `%${descripcion.split("-")[0]}%`)
    }

    // 5. Recalcular validaciones de pagos
    const { data: pagos } = await supabase
      .from("pago_semanal")
      .select("id, monto, dia_programado")
      .eq("plan_id", plan_id)
      .in("estado", ["PENDIENTE", "PROGRAMADO"])

    if (pagos) {
      // Ordenar por día programado
      const pagosPorDia = pagos.sort((a, b) => a.dia_programado - b.dia_programado)

      let caja_acumulada = caja_nueva
      for (const pago of pagosPorDia) {
        const puede_pagar = caja_acumulada >= pago.monto

        await supabase
          .from("pago_semanal")
          .update({ caja_permite: puede_pagar })
          .eq("id", pago.id)

        if (puede_pagar) {
          caja_acumulada -= pago.monto
        }
      }
    }

    // 6. Generar alertas
    await supabase.rpc("fn_generar_alertas_flujo", {
      p_plan_id: plan_id,
    })

    // 7. Broadcast a cliente (WebSocket)
    // Supabase realtime se encarga automáticamente

    return new Response(
      JSON.stringify({
        success: true,
        caja_nueva,
        caja_anterior: plan.caja_actual,
        evento: descripcion,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Error desconocido",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    )
  }
})
