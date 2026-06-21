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
    const { plan_id } = await req.json()

    if (!plan_id) {
      return new Response(
        JSON.stringify({ error: "plan_id requerido" }),
        { status: 400, headers: corsHeaders }
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // Llamar función PL/pgSQL que genera alertas
    const { error } = await supabase.rpc("fn_generar_alertas_flujo", {
      p_plan_id: plan_id,
    })

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Obtener alertas generadas
    const { data: alertas } = await supabase
      .from("alerta_flujo_semanal")
      .select("*")
      .eq("plan_id", plan_id)
      .eq("resuelta", false)

    return new Response(
      JSON.stringify({
        success: true,
        alertas_generadas: alertas?.length || 0,
        alertas,
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
