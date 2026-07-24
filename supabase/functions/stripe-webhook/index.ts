import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno&no-check"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? "",
)

// Mapa inverso: stripe_price_id → plan_code
const PRICE_PLAN_MAP: Record<string, string> = {
  "price_1Tj1zzL2neyywaFYirjaQbQ0": "basico",
  "price_1Tj21yL2neyywaFYbhdUtrZm": "profesional",
  "price_1Tj26cL2neyywaFYT6KJGCCh": "empresarial",
}

Deno.serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature") ?? ""
  const body = await req.text()

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
    apiVersion: "2024-04-10",
    httpClient: Stripe.createFetchHttpClient(),
  })

  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "",
    )
  } catch (err: any) {
    console.error("Webhook signature error:", err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 400 })
  }

  console.log("Stripe event:", event.type)

  try {
    switch (event.type) {

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const companyId = session.metadata?.company_id
        const plan = session.metadata?.plan ?? "basico"

        if (!companyId) {
          console.error("No company_id in session metadata")
          break
        }

        // Si ya tiene subscription_id, upsert inmediato
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string)
          await supabase.from("subscriptions").upsert({
            company_id:            companyId,
            plan_code:             plan,
            stripe_customer_id:    sub.customer as string,
            stripe_subscription_id: sub.id,
            status:                sub.status,
            current_period_start:  new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end:    new Date(sub.current_period_end   * 1000).toISOString(),
            cancel_at_period_end:  sub.cancel_at_period_end,
          }, { onConflict: "company_id" })
        }
        break
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription

        // Buscar company_id por stripe_customer_id
        const { data: sc } = await supabase
          .from("stripe_customers")
          .select("company_id")
          .eq("stripe_customer_id", sub.customer as string)
          .maybeSingle()

        if (!sc?.company_id) {
          console.error("company_id not found for customer", sub.customer)
          break
        }

        const priceId = sub.items.data[0]?.price?.id ?? ""
        const plan = PRICE_PLAN_MAP[priceId] ?? "basico"

        await supabase.from("subscriptions").upsert({
          company_id:             sc.company_id,
          plan_code:              plan,
          stripe_customer_id:     sub.customer as string,
          stripe_subscription_id: sub.id,
          status:                 sub.status,
          current_period_start:   new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end:     new Date(sub.current_period_end   * 1000).toISOString(),
          cancel_at_period_end:   sub.cancel_at_period_end,
        }, { onConflict: "company_id" })

        console.log("Subscription upserted:", sub.id, "plan:", plan)
        break
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        await supabase
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", sub.id)
        console.log("Subscription cancelled:", sub.id)
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.subscription) {
          await supabase
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("stripe_subscription_id", invoice.subscription as string)
        }
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    })
  } catch (error: any) {
    console.error("Webhook error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
