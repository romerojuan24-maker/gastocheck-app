import { createClient } from "@supabase/supabase-js"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// @ts-ignore
const stripe = require("stripe")(Deno.env.get("STRIPE_SECRET_KEY"), {
  httpClient: Deno.fetch,
})

const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
)

export default async (req: Request) => {
  const signature = req.headers.get("stripe-signature") ?? ""
  const body = await req.text()

  let event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "",
    )
  } catch (error: any) {
    console.error("Webhook signature verification failed:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { "Content-Type": "application/json" },
    })
  }

  try {
    console.log("Processing webhook event:", event.type)

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as any
        const customerId = subscription.customer as string

        const customer = await stripe.customers.retrieve(customerId)
        const userId = customer.metadata?.supabase_user_id as string

        if (!userId) {
          throw new Error("User ID not found in customer metadata")
        }

        const priceId = subscription.items.data[0]?.price?.id as string
        const plan = subscription.metadata?.plan || "basico"

        await supabaseClient
          .from("subscriptions")
          .upsert(
            {
              user_id: userId,
              stripe_subscription_id: subscription.id,
              stripe_product_id: subscription.items.data[0]?.price?.product as string,
              plan,
              status: subscription.status,
              current_period_start: new Date(subscription.current_period_start * 1000),
              current_period_end: new Date(subscription.current_period_end * 1000),
              cancel_at_period_end: subscription.cancel_at_period_end,
              updated_at: new Date(),
            },
            { onConflict: "stripe_subscription_id" },
          )

        console.log("Subscription upserted:", subscription.id)
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any

        await supabaseClient
          .from("subscriptions")
          .update({ status: "cancelled", canceled_at: new Date() })
          .eq("stripe_subscription_id", subscription.id)

        console.log("Subscription deleted:", subscription.id)
        break
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any
        const customerId = invoice.customer as string

        const customer = await stripe.customers.retrieve(customerId)
        const userId = customer.metadata?.supabase_user_id as string

        if (!userId) {
          throw new Error("User ID not found in customer metadata")
        }

        await supabaseClient
          .from("invoices")
          .insert({
            user_id: userId,
            stripe_invoice_id: invoice.id,
            stripe_payment_intent_id: invoice.payment_intent as string,
            amount_paid: invoice.amount_paid || 0,
            currency: invoice.currency || "USD",
            status: invoice.status,
            invoice_pdf_url: invoice.pdf,
            paid_at: invoice.paid_date ? new Date(invoice.paid_date * 1000) : new Date(),
          })

        console.log("Invoice recorded:", invoice.id)
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any
        const customerId = invoice.customer as string

        const customer = await stripe.customers.retrieve(customerId)
        const userId = customer.metadata?.supabase_user_id as string

        if (!userId) {
          throw new Error("User ID not found in customer metadata")
        }

        await supabaseClient
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("user_id", userId)
          .eq("stripe_subscription_id", invoice.subscription)

        console.log("Payment failed for:", invoice.subscription)
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    })
  } catch (error: any) {
    console.error("Webhook processing error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { "Content-Type": "application/json" },
    })
  }
}
