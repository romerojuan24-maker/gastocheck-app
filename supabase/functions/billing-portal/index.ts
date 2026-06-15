// Edge Function: Stripe Customer Portal — gestión de suscripción desde web
// Input:  { company_id, return_url }
// Output: { url }
// Deploy: npx supabase functions deploy billing-portal

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
    const { company_id, return_url } =
      (await req.json()) as { company_id: string; return_url: string };

    if (!company_id || !return_url) {
      return Response.json(
        { error: 'company_id y return_url son requeridos' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')              ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Obtener stripe_customer_id de la suscripción activa
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('company_id', company_id)
      .not('stripe_customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      return Response.json(
        { error: 'No se encontró suscripción activa para esta empresa' },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer:   sub.stripe_customer_id,
      return_url,
    });

    return Response.json(
      { url: portalSession.url },
      { headers: CORS_HEADERS },
    );
  } catch (e) {
    console.error('billing-portal error:', e);
    return Response.json(
      { error: String(e) },
      { status: 500, headers: CORS_HEADERS },
    );
  }
});
