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
    const {
      plan_id,
      nombre_escenario,
      cliente_perdido_monto = 0,
      gastos_adicionales = 0,
      ingresos_adicionales = 0,
    } = await req.json()

    if (!plan_id || !nombre_escenario) {
      return new Response(
        JSON.stringify({ error: "Faltan parámetros" }),
        { status: 400, headers: corsHeaders }
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // Obtener plan
    const { data: plan, error: errorPlan } = await supabase
      .from("plan_pagos_semanal")
      .select("caja_proyectada, empresa_id")
      .eq("id", plan_id)
      .single()

    if (errorPlan || !plan) {
      return new Response(
        JSON.stringify({ error: "Plan no encontrado" }),
        { status: 404, headers: corsHeaders }
      )
    }

    // Calcular escenario
    const caja_original = plan.caja_proyectada || 0
    const caja_escenario =
      caja_original - cliente_perdido_monto + ingresos_adicionales - gastos_adicionales

    const diferencia = caja_escenario - caja_original
    const es_viable = caja_escenario >= 0

    // Guardar escenario
    const { data: escenario, error: errorInsert } = await supabase
      .from("escenario_what_if")
      .insert({
        plan_id,
        empresa_id: plan.empresa_id,
        nombre_escenario,
        cliente_perdido_monto: cliente_perdido_monto > 0 ? cliente_perdido_monto : null,
        gastos_adicionales: gastos_adicionales > 0 ? gastos_adicionales : null,
        ingresos_adicionales: ingresos_adicionales > 0 ? ingresos_adicionales : null,
        caja_proyectada_original: caja_original,
        caja_proyectada_escenario: caja_escenario,
        diferencia,
        es_viable,
        creado_por: null,
      })
      .select()
      .single()

    if (errorInsert) {
      return new Response(
        JSON.stringify({ error: errorInsert.message }),
        { status: 400, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        escenario,
        caja_original,
        caja_escenario,
        diferencia,
        es_viable,
      }),
      {
        status: 201,
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
