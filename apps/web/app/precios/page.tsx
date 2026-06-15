'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Session } from '@supabase/supabase-js';

// ── Configuración de planes ───────────────────────────────────────────────────

interface PlanDef {
  tier:       string;
  label:      string;
  desc:       string;
  codeMonth:  string;
  codeYear:   string;
  priceMonth: number;
  priceYear:  number;
  badge?:     string;
  features:   string[];
  maxUsers:   string;
  maxReceipts: string;
  highlight:  boolean;
}

const PLANS: PlanDef[] = [
  {
    tier: 'starter', label: 'Starter', desc: 'Para equipos pequeños',
    codeMonth: 'GC_STARTER_M', codeYear: 'GC_STARTER_A',
    priceMonth: 299, priceYear: 2990,
    maxUsers: '3 usuarios', maxReceipts: '100 comprobantes/mes',
    highlight: false,
    features: [
      'Captura de tickets con cámara',
      'OCR automático de comprobantes',
      'Control de anticipos y pólizas',
      'Exportación Excel y ZIP',
      '3 usuarios activos',
    ],
  },
  {
    tier: 'pro', label: 'Pro', desc: 'Para empresas en crecimiento',
    codeMonth: 'GC_PRO_M', codeYear: 'GC_PRO_A',
    priceMonth: 699, priceYear: 6990,
    badge: 'Más popular',
    maxUsers: '10 usuarios', maxReceipts: '500 comprobantes/mes',
    highlight: true,
    features: [
      'Todo lo de Starter',
      'Validación SAT de CFDI',
      'Módulo de cobranza',
      'Centros de costo ilimitados',
      '10 usuarios activos',
    ],
  },
  {
    tier: 'business', label: 'Business', desc: 'Para operaciones multi-sitio',
    codeMonth: 'GC_BUSINESS_M', codeYear: 'GC_BUSINESS_A',
    priceMonth: 1499, priceYear: 14990,
    maxUsers: '30 usuarios', maxReceipts: '2,000 comprobantes/mes',
    highlight: false,
    features: [
      'Todo lo de Pro',
      'Vertical de flota vehicular',
      'Hasta 3 empresas',
      'Reportes avanzados',
      '30 usuarios activos',
    ],
  },
  {
    tier: 'enterprise', label: 'Enterprise', desc: 'Sin límites',
    codeMonth: 'GC_ENTERPRISE_M', codeYear: 'GC_ENTERPRISE_A',
    priceMonth: 2999, priceYear: 29990,
    maxUsers: 'Usuarios ilimitados', maxReceipts: 'Comprobantes ilimitados',
    highlight: false,
    features: [
      'Todo lo de Business',
      'Empresas ilimitadas',
      'SLA garantizado',
      'Soporte prioritario',
      'Onboarding dedicado',
    ],
  },
];

const formatMXN = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

// ── Componente principal ──────────────────────────────────────────────────────

export default function PreciosPage() {
  const [interval,   setInterval]   = useState<'month' | 'year'>('month');
  const [loading,    setLoading]    = useState<string | null>(null);
  const [session,    setSession]    = useState<Session | null>(null);
  const [companyId,  setCompanyId]  = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  // Cargar sesión y empresa del usuario
  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id || !supabase) return;

    supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', session.user.id)
      .eq('role', 'owner')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setCompanyId(data?.company_id ?? null));
  }, [session]);

  async function handleCheckout(plan: PlanDef) {
    setError(null);

    if (!session) {
      // Redirigir a login guardando el plan seleccionado
      const code = interval === 'month' ? plan.codeMonth : plan.codeYear;
      window.location.href = `/login?redirect=/precios&plan=${code}`;
      return;
    }

    if (!companyId) {
      setError('No se encontró tu empresa. Inicia sesión como dueño (owner) de la empresa.');
      return;
    }

    const planCode = interval === 'month' ? plan.codeMonth : plan.codeYear;
    setLoading(planCode);

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
      const { data: { session: currentSession } } = await supabase!.auth.getSession();
      const token = currentSession?.access_token ?? '';

      const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          company_id:  companyId,
          plan_code:   planCode,
          success_url: `${window.location.origin}/billing/success?plan=${planCode}`,
          cancel_url:  `${window.location.origin}/precios`,
        }),
      });

      const body = await res.json();

      if (!res.ok || !body.url) {
        setError(body.error ?? 'Error al crear sesión de pago');
        setLoading(null);
        return;
      }

      window.location.href = body.url;
    } catch (e) {
      setError(String(e));
      setLoading(null);
    }
  }

  const saving = (p: PlanDef) =>
    Math.round(((p.priceMonth * 12 - p.priceYear) / (p.priceMonth * 12)) * 100);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#0F172A] text-white py-16 px-4 text-center">
        <div className="inline-block bg-[#00A650] text-white text-sm font-semibold px-4 py-1 rounded-full mb-4">
          30 días gratis • Sin tarjeta requerida al inicio
        </div>
        <h1 className="text-4xl font-bold mb-3">Elige tu plan</h1>
        <p className="text-gray-300 text-lg max-w-xl mx-auto">
          Todos los planes incluyen 30 días de prueba gratuita. Cancela cuando quieras.
        </p>

        {/* Toggle mensual / anual */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <span className={interval === 'month' ? 'text-white font-semibold' : 'text-gray-400'}>
            Mensual
          </span>
          <button
            onClick={() => setInterval(i => i === 'month' ? 'year' : 'month')}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              interval === 'year' ? 'bg-[#00A650]' : 'bg-gray-600'
            }`}
          >
            <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
              interval === 'year' ? 'translate-x-7' : ''
            }`} />
          </button>
          <span className={interval === 'year' ? 'text-white font-semibold' : 'text-gray-400'}>
            Anual
            <span className="ml-2 bg-[#00A650] text-white text-xs px-2 py-0.5 rounded-full">
              Ahorra hasta 17%
            </span>
          </span>
        </div>
      </div>

      {/* Error global */}
      {error && (
        <div className="max-w-5xl mx-auto px-4 mt-6">
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* Cards */}
      <div className="max-w-6xl mx-auto px-4 py-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map(plan => {
          const planCode = interval === 'month' ? plan.codeMonth : plan.codeYear;
          const price    = interval === 'month' ? plan.priceMonth : plan.priceYear;
          const isLoading = loading === planCode;

          return (
            <div
              key={plan.tier}
              className={`rounded-2xl p-6 flex flex-col ${
                plan.highlight
                  ? 'bg-[#0F172A] text-white shadow-2xl scale-105 border-2 border-[#00A650]'
                  : 'bg-white text-gray-900 shadow-md'
              }`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="bg-[#00A650] text-white text-xs font-bold px-3 py-1 rounded-full self-start mb-3">
                  {plan.badge}
                </div>
              )}

              <h2 className="text-xl font-bold">{plan.label}</h2>
              <p className={`text-sm mb-4 ${plan.highlight ? 'text-gray-300' : 'text-gray-500'}`}>
                {plan.desc}
              </p>

              {/* Precio */}
              <div className="mb-2">
                <span className="text-3xl font-extrabold">{formatMXN(price)}</span>
                <span className={`text-sm ml-1 ${plan.highlight ? 'text-gray-300' : 'text-gray-500'}`}>
                  /{interval === 'month' ? 'mes' : 'año'}
                </span>
              </div>

              {interval === 'year' && (
                <div className="text-[#00A650] text-xs font-semibold mb-4">
                  Ahorra {saving(plan)}% vs mensual
                </div>
              )}

              {/* Límites */}
              <div className={`text-xs mb-4 space-y-1 ${plan.highlight ? 'text-gray-300' : 'text-gray-500'}`}>
                <div>👥 {plan.maxUsers}</div>
                <div>🧾 {plan.maxReceipts}</div>
              </div>

              {/* Features */}
              <ul className="flex-1 space-y-2 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="text-[#00A650] mt-0.5">✓</span>
                    <span className={plan.highlight ? 'text-gray-200' : 'text-gray-700'}>{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => handleCheckout(plan)}
                disabled={isLoading}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-opacity ${
                  plan.highlight
                    ? 'bg-[#00A650] text-white hover:opacity-90'
                    : 'bg-[#0F172A] text-white hover:opacity-80'
                } disabled:opacity-50`}
              >
                {isLoading ? 'Redirigiendo...' : 'Comenzar prueba gratis'}
              </button>

              <p className={`text-xs text-center mt-2 ${plan.highlight ? 'text-gray-400' : 'text-gray-400'}`}>
                30 días gratis • Sin cobro al inicio
              </p>
            </div>
          );
        })}
      </div>

      {/* Aviso de pago */}
      <div className="text-center pb-12 px-4">
        <p className="text-sm text-gray-500 max-w-xl mx-auto">
          El pago se realiza a través de Stripe en la web.
          La app móvil valida automáticamente el estado de tu suscripción.
          No se realizan cobros dentro de Google Play ni App Store.
        </p>
      </div>
    </div>
  );
}
