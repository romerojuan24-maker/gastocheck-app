// Edge Function: Stripe Webhook Handler para GastoCheck
// Eventos: checkout.session.completed, customer.subscription.*, invoice.*
// Deploy: npx supabase functions deploy stripe-webhook
// Config Stripe: apuntar webhook a <supabase_url>/functions/v1/stripe-webhook

import Stripe from 'https://esm.sh/stripe@16?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-10-28',
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // ── Verificar firma Stripe ────────────────────────────────────────────────
  const signature    = req.headers.get('stripe-signature') ?? '';
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
  const body         = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')              ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  console.log(`Webhook: ${event.type}`);

  try {
    switch (event.type) {

      // ── Checkout completado: crear registro inicial de suscripción ──────
      case 'checkout.session.completed': {
        const session        = event.data.object as Stripe.Checkout.Session;
        const company_id     = session.metadata?.company_id;
        const plan_code      = session.metadata?.plan_code;
        const stripe_customer_id     = session.customer as string;
        const stripe_subscription_id = session.subscription as string;

        if (!company_id || !plan_code || !stripe_subscription_id) break;

        const sub = await stripe.subscriptions.retrieve(stripe_subscription_id);

        await supabase.from('subscriptions').upsert({
          company_id,
          plan_code,
          stripe_customer_id,
          stripe_subscription_id,
          status:               mapStatus(sub.status),
          trial_start:          toIso(sub.trial_start),
          trial_end:            toIso(sub.trial_end),
          current_period_start: toIso(sub.current_period_start),
          current_period_end:   toIso(sub.current_period_end),
          cancel_at_period_end: sub.cancel_at_period_end,
        }, { onConflict: 'stripe_subscription_id' });

        console.log(`checkout.completed → company=${company_id} plan=${plan_code} status=${sub.status}`);
        break;
      }

      // ── Suscripción creada / actualizada ───────────────────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub        = event.data.object as Stripe.Subscription;
        const company_id = sub.metadata?.company_id;
        const plan_code  = sub.metadata?.plan_code;

        if (!company_id || !plan_code) {
          // Metadata puede llegar vacía en updated; buscar en DB
          const { data: existing } = await supabase
            .from('subscriptions')
            .select('company_id, plan_code')
            .eq('stripe_subscription_id', sub.id)
            .maybeSingle();

          if (!existing) {
            console.warn(`subscription ${sub.id} sin metadata y sin registro previo`);
            break;
          }

          await supabase.from('subscriptions').update({
            status:               mapStatus(sub.status),
            trial_start:          toIso(sub.trial_start),
            trial_end:            toIso(sub.trial_end),
            current_period_start: toIso(sub.current_period_start),
            current_period_end:   toIso(sub.current_period_end),
            cancel_at_period_end: sub.cancel_at_period_end,
          }).eq('stripe_subscription_id', sub.id);

          break;
        }

        await supabase.from('subscriptions').upsert({
          company_id,
          plan_code,
          stripe_customer_id:    sub.customer as string,
          stripe_subscription_id: sub.id,
          status:               mapStatus(sub.status),
          trial_start:          toIso(sub.trial_start),
          trial_end:            toIso(sub.trial_end),
          current_period_start: toIso(sub.current_period_start),
          current_period_end:   toIso(sub.current_period_end),
          cancel_at_period_end: sub.cancel_at_period_end,
        }, { onConflict: 'stripe_subscription_id' });

        console.log(`subscription.${event.type.split('.')[2]} → ${sub.id} status=${sub.status}`);
        break;
      }

      // ── Suscripción cancelada ──────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await supabase
          .from('subscriptions')
          .update({ status: 'canceled' })
          .eq('stripe_subscription_id', sub.id);

        console.log(`subscription.deleted → ${sub.id}`);
        break;
      }

      // ── Factura pagada: activar y actualizar periodo ───────────────────
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;

        const periodEnd = invoice.lines?.data?.[0]?.period?.end;

        await supabase
          .from('subscriptions')
          .update({
            status:             'active',
            current_period_end: toIso(periodEnd ?? null),
          })
          .eq('stripe_subscription_id', invoice.subscription as string)
          .neq('status', 'canceled');

        console.log(`invoice.paid → sub=${invoice.subscription}`);
        break;
      }

      // ── Pago fallido: marcar past_due ──────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;

        await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', invoice.subscription as string)
          .neq('status', 'canceled');

        console.log(`invoice.payment_failed → sub=${invoice.subscription}`);
        break;
      }

      default:
        console.log(`Evento ignorado: ${event.type}`);
    }

    return Response.json({ received: true });
  } catch (e) {
    console.error(`Error handling ${event.type}:`, e);
    // Retornar 200 para evitar reintentos de Stripe en errores internos
    return Response.json({ received: true, internal_error: String(e) });
  }
});

// ── Utilidades ──────────────────────────────────────────────────────────────

function mapStatus(stripeStatus: Stripe.Subscription.Status): string {
  const map: Record<string, string> = {
    trialing:    'trialing',
    active:      'active',
    past_due:    'past_due',
    canceled:    'canceled',
    incomplete:  'incomplete',
    paused:      'paused',
    unpaid:      'past_due',
    incomplete_expired: 'canceled',
  };
  return map[stripeStatus] ?? 'incomplete';
}

function toIso(unix: number | null | undefined): string | null {
  if (!unix) return null;
  return new Date(unix * 1000).toISOString();
}
