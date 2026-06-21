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
    const { empresa_id } = await req.json()

    if (!empresa_id) {
      return new Response(
        JSON.stringify({ error: "empresa_id requerido" }),
        { status: 400, headers: corsHeaders }
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // Obtener todos los clientes
    const { data: clientes } = await supabase
      .from("cobros")
      .select("DISTINCT cliente_rfc, cliente_nombre")
      .eq("empresa_id", empresa_id)

    if (!clientes || clientes.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          clientes_procesados: 0,
          mensaje: "No hay clientes para procesar",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      )
    }

    // Procesar cada cliente
    const resultados = []

    for (const cliente of clientes) {
      // Obtener cobros del cliente
      const { data: cobros } = await supabase
        .from("cobros")
        .select("fecha_pago, fecha_vencimiento")
        .eq("cliente_rfc", cliente.cliente_rfc)
        .eq("empresa_id", empresa_id)
        .not("fecha_pago", "is", null)

      if (!cobros) continue

      // Calcular métricas
      let pagos_a_tiempo = 0
      let pagos_atrasados = 0
      let suma_retrasos = 0

      for (const cobro of cobros) {
        const fechaPago = new Date(cobro.fecha_pago)
        const fechaVencimiento = new Date(cobro.fecha_vencimiento)
        const diferencia = Math.floor(
          (fechaPago.getTime() - fechaVencimiento.getTime()) / (1000 * 60 * 60 * 24)
        )

        if (diferencia <= 0) {
          pagos_a_tiempo++
        } else {
          pagos_atrasados++
          suma_retrasos += diferencia
        }
      }

      const promedio_retrasos = pagos_atrasados > 0 ? suma_retrasos / pagos_atrasados : 0

      // Calcular puntaje (0-100)
      let puntaje_riesgo = 50
      if (pagos_atrasados === 0) puntaje_riesgo = 10
      else if (pagos_atrasados === 1) puntaje_riesgo = 30
      else if (promedio_retrasos < 5) puntaje_riesgo = 40
      else if (promedio_retrasos < 15) puntaje_riesgo = 60
      else if (promedio_retrasos < 30) puntaje_riesgo = 80
      else puntaje_riesgo = 100

      // Determinar nivel de puntualidad
      let puntualidad_nivel = "NORMAL"
      if (puntaje_riesgo <= 20) puntualidad_nivel = "EXCELENTE"
      else if (puntaje_riesgo <= 40) puntualidad_nivel = "BUENO"
      else if (puntaje_riesgo <= 60) puntualidad_nivel = "NORMAL"
      else if (puntaje_riesgo <= 80) puntualidad_nivel = "MALO"
      else puntualidad_nivel = "PÉSIMO"

      // Determinar prioridad de cobranza
      let prioridad_cobranza = "NORMAL"
      if (puntaje_riesgo >= 80) prioridad_cobranza = "URGENTE"
      else if (puntaje_riesgo >= 60) prioridad_cobranza = "ALTA"
      else if (puntaje_riesgo >= 40) prioridad_cobranza = "NORMAL"
      else prioridad_cobranza = "BAJA"

      // Guardar o actualizar scoring
      const { error } = await supabase.from("scoring_cliente_cobranza").upsert(
        {
          empresa_id,
          cliente_rfc: cliente.cliente_rfc,
          cliente_nombre: cliente.cliente_nombre,
          puntaje_riesgo,
          historial_retrasos: pagos_atrasados,
          promedio_dias_retraso: Number(promedio_retrasos.toFixed(2)),
          pagos_a_tiempo,
          pagos_atrasados,
          puntualidad_nivel,
          prioridad_cobranza,
          actualizado_en: new Date().toISOString(),
        },
        {
          onConflict: "empresa_id,cliente_rfc",
        }
      )

      if (error) {
        console.error(`Error procesando cliente ${cliente.cliente_rfc}:`, error)
      } else {
        resultados.push({
          cliente_rfc: cliente.cliente_rfc,
          puntaje_riesgo,
          prioridad_cobranza,
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        clientes_procesados: resultados.length,
        clientes: resultados,
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
