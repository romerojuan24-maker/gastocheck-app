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
    const { pago_id, dia_nuevo } = await req.json()

    if (!pago_id || dia_nuevo === undefined) {
      return new Response(
        JSON.stringify({ error: "Faltan parámetros" }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (dia_nuevo < 0 || dia_nuevo > 6) {
      return new Response(
        JSON.stringify({ error: "Día inválido (0-6)" }),
        { status: 400, headers: corsHeaders }
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // Obtener pago
    const { data: pago, error: errorGet } = await supabase
      .from("pago_semanal")
      .select("id, descripcion, plan_id")
      .eq("id", pago_id)
      .single()

    if (errorGet || !pago) {
      return new Response(
        JSON.stringify({ error: "Pago no encontrado" }),
        { status: 404, headers: corsHeaders }
      )
    }

    // Actualizar pago
    const { data: updated, error: errorUpdate } = await supabase
      .from("pago_semanal")
      .update({
        dia_programado: dia_nuevo,
        estado: "ARRASTRADO",
      })
      .eq("id", pago_id)
      .select()
      .single()

    if (errorUpdate) {
      return new Response(
        JSON.stringify({ error: errorUpdate.message }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Recalcular alertas
    await supabase.rpc("fn_generar_alertas_flujo", {
      p_plan_id: pago.plan_id,
    })

    return new Response(
      JSON.stringify({
        success: true,
        pago: updated,
        mensaje: `${pago.descripcion} movido a día ${dia_nuevo}`,
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
