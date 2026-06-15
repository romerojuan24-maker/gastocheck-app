// Edge Function: Crea Stripe Checkout Session para suscripción GastoCheck
// Input:  { company_id, plan_code, success_url, cancel_url }
// Output: { url, session_id }
// Deploy: npx supabase functions deploy create-checkout-session

import Stripe from 'https://esm.sh/stripe@16?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-10-28',
  httpClient: Stripe.createFetchHttpClient(),
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { company_id, plan_code, success_url, cancel_url } =
      (await req.json()) as {
        company_id:  string;
        plan_code:   string;
        success_url: string;
        cancel_url:  string;
      };

    if (!company_id || !plan_code || !success_url || !cancel_url) {
      return Response.json(
        { error: 'company_id, plan_code, success_url y cancel_url son requeridos' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')              ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // ── 1. Validar plan_code ──────────────────────────────────────────────────
    const { data: plan, error: planErr } = await supabase
      .from('billing_plans')
      .select('*')
      .eq('plan_code', plan_code)
      .eq('status', 'active')
      .maybeSingle();

    if (planErr || !plan) {
      return Response.json(
        { error: `plan_code "${plan_code}" no existe o está inactivo` },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    if (!plan.stripe_price_id) {
      return Response.json(
        { error: 'Este plan aún no está disponible para compra (sin stripe_price_id)' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // ── 2. Obtener o crear Stripe Customer ────────────────────────────────────
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('company_id', company_id)
      .not('stripe_customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let customerId = existingSub?.stripe_customer_id as string | undefined;

    if (!customerId) {
      // Obtener datos de la empresa para el customer
      const { data: company } = await supabase
        .from('companies')
        .select('name, rfc')
        .eq('id', company_id)
        .maybeSingle();

      // Obtener email del owner
      const { data: ownerRow } = await supabase
        .from('company_members')
        .select('user_id')
        .eq('company_id', company_id)
        .eq('role', 'owner')
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      let ownerEmail: string | undefined;
      if (ownerRow?.user_id) {
        const { data: userData } = await supabase.auth.admin.getUserById(ownerRow.user_id);
        ownerEmail = userData?.user?.email;
      }

      const customer = await stripe.customers.create({
        metadata: { company_id, gc_rfc: company?.rfc ?? '', source: 'gastocheck' },
        ...(company?.name  ? { name:  company.name } : {}),
        ...(ownerEmail     ? { email: ownerEmail   } : {}),
      });
      customerId = customer.id;
    }

    // ── 3. Crear Checkout Session ─────────────────────────────────────────────
    const session = await stripe.checkout.sessions.create({
      mode:     'subscription',
      customer: customerId,
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      subscription_data: {
        trial_period_days: 30,
        metadata: { company_id, plan_code },
      },
      metadata: { company_id, plan_code },
      success_url,
      cancel_url,
      allow_promotion_codes:       true,
      billing_address_collection:  'auto',
      locale:                      'es',
    });

    return Response.json(
      { url: session.url, session_id: session.id },
      { headers: CORS_HEADERS },
    );
  } catch (e) {
    console.error('create-checkout-session error:', e);
    return Response.json(
      { error: String(e) },
      { status: 500, headers: CORS_HEADERS },
    );
  }
});
