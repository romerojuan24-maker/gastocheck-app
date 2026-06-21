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
    const { empresa_id, caja_inicial } = await req.json()

    if (!empresa_id || caja_inicial === undefined) {
      return new Response(
        JSON.stringify({ error: "Faltan parámetros" }),
        { status: 400, headers: corsHeaders }
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // Calcular semana
    const hoy = new Date()
    const diaSemana = hoy.getDay()
    const diasAlLunes = diaSemana === 0 ? 1 : 8 - diaSemana

    const semana_inicio = new Date(hoy)
    semana_inicio.setDate(semana_inicio.getDate() + diasAlLunes)

    const semana_fin = new Date(semana_inicio)
    semana_fin.setDate(semana_fin.getDate() + 6)

    // Crear plan
    const { data: plan, error } = await supabase
      .from("plan_pagos_semanal")
      .insert({
        empresa_id,
        semana_inicio: semana_inicio.toISOString().split("T")[0],
        semana_fin: semana_fin.toISOString().split("T")[0],
        caja_inicial,
        caja_actual: caja_inicial,
        caja_proyectada: caja_inicial,
        estado: "ACTIVA",
      })
      .select()
      .single()

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: corsHeaders }
      )
    }

    return new Response(JSON.stringify(plan), {
      status: 201,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    })
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
