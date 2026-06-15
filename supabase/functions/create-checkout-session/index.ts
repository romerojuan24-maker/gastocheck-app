import { createClient } from "@supabase/supabase-js"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// @ts-ignore
const stripe = require("stripe")(Deno.env.get("STRIPE_SECRET_KEY"), {
  httpClient: Deno.fetch,
})

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    )

    const authHeader = req.headers.get("Authorization") ?? ""
    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const { plan, priceId } = await req.json()

    if (!["basico", "profesional", "empresarial"].includes(plan)) {
      throw new Error("Plan inválido")
    }

    if (!priceId) {
      throw new Error("Price ID requerido")
    }

    let stripeCustomerId: string

    const { data: existing } = await supabaseClient
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single()

    if (existing?.stripe_customer_id) {
      stripeCustomerId = existing.stripe_customer_id
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      })

      stripeCustomerId = customer.id

      await supabaseClient
        .from("stripe_customers")
        .insert({ user_id: user.id, stripe_customer_id: stripeCustomerId })
    }

    const appUrl = Deno.env.get("APP_URL") || "http://localhost:3000"
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing`,
      metadata: {
        plan,
      },
    })

    return new Response(JSON.stringify({
      sessionId: session.id,
      url: session.url,
      success: true
    }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  } catch (error: any) {
    console.error("Checkout error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }
}
