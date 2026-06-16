import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno&no-check"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const PLAN_PRICE_MAP: Record<string, string> = {
  basico:      "price_1Tj1zzL2neyywaFYirjaQbQ0",
  profesional: "price_1Tj21yL2neyywaFYbhdUtrZm",
  empresarial: "price_1Tj26cL2neyywaFYT6KJGCCh",
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2024-04-10",
      httpClient: Stripe.createFetchHttpClient(),
    })

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    )

    // Autenticar usuario
    const authHeader = req.headers.get("Authorization") ?? ""
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    )
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const { plan } = await req.json()

    if (!PLAN_PRICE_MAP[plan]) {
      throw new Error(`Plan inválido: ${plan}`)
    }
    const priceId = PLAN_PRICE_MAP[plan]

    // Obtener empresa del usuario
    const { data: member } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    if (!member?.company_id) {
      throw new Error("El usuario no pertenece a ninguna empresa")
    }
    const companyId = member.company_id

    // Buscar o crear stripe_customer para la empresa
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const { data: existing } = await supabaseAdmin
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("company_id", companyId)
      .maybeSingle()

    let stripeCustomerId: string

    if (existing?.stripe_customer_id) {
      stripeCustomerId = existing.stripe_customer_id
    } else {
      // Obtener datos de la empresa
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("name")
        .eq("id", companyId)
        .maybeSingle()

      const customer = await stripe.customers.create({
        email: user.email,
        name: company?.name ?? undefined,
        metadata: { company_id: companyId, user_id: user.id },
      })
      stripeCustomerId = customer.id

      await supabaseAdmin
        .from("stripe_customers")
        .insert({ company_id: companyId, stripe_customer_id: stripeCustomerId })
    }

    // Crear sesión de checkout
    const appUrl = Deno.env.get("APP_URL") || "https://gastocheck.app"
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing`,
      metadata: { plan, company_id: companyId },
    })

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  } catch (error: any) {
    console.error("Checkout error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }
})
