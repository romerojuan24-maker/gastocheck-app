'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSessionUser } from '../../../lib/supabase';
import { ADVISOR_SEVERITY_META } from '@gastocheck/shared';
import type { AdvisorInsight } from '@gastocheck/shared';

export default function AdvisorPage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [insights, setInsights] = useState<AdvisorInsight[]>([]);
  const [tab, setTab] = useState<'insights' | 'preguntas'>('insights');
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);

  const load = useCallback(async (cid: string) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('advisor_insights')
        .select('*').eq('company_id', cid).eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(20);
      setInsights((data ?? []) as AdvisorInsight[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getSessionUser().then(u => {
      if (!u) return;
      setCompanyId(u.company_id);
      load(u.company_id);
    });
  }, [load]);

  async function askAdvisor() {
    if (!question.trim() || !companyId) return;
    setAsking(true);
    try {
      // Aquí iría llamada a Edge Function que usa Claude API
      // Para MVP, simplemente mostrar placeholder
      const { error: err } = await supabase
        .from('advisor_questions')
        .insert({
          company_id: companyId,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          question,
          status: 'pending',
        });

      if (!err) {
        setQuestion('');
        // En producción, aquí vendría la respuesta
        alert('Pregunta enviada. En el dashboard verás la respuesta del Advisor IA.');
      }
    } finally {
      setAsking(false);
    }
  }

  const criticalCount = insights.filter(i => i.severity === 'critical').length;
  const warningCount = insights.filter(i => i.severity === 'warning').length;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">🤖 Advisor IA</h1>
        <p className="text-slate-500 text-sm mt-1">¿Qué debo hacer primero?</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-600 mb-1">Total insights</p>
          <p className="text-2xl font-black text-slate-900">{insights.length}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <p className="text-xs text-red-600 mb-1">Urgentes</p>
          <p className="text-2xl font-black text-red-700">{criticalCount}</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <p className="text-xs text-amber-600 mb-1">Atención</p>
          <p className="text-2xl font-black text-amber-700">{warningCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {[
          { key: 'insights', label: 'Insights automáticos' },
          { key: 'preguntas', label: 'Hazme una pregunta' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`px-3 py-3 text-sm font-bold transition-colors ${
              tab === t.key
                ? 'text-emerald-600 border-b-2 border-emerald-500'
                : 'text-slate-500 border-b-2 border-transparent hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Insights */}
      {tab === 'insights' && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-6 h-6 border-3 border-emerald-500 border-t-transparent rounded-full" />
            </div>
          ) : insights.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <p className="text-4xl mb-2">✨</p>
              <p className="text-slate-500 font-medium">Sin insights en este momento</p>
            </div>
          ) : (
            insights.map(i => {
              const meta = ADVISOR_SEVERITY_META[i.severity];
              return (
                <div
                  key={i.id}
                  className="bg-white border-l-4 rounded-lg p-4"
                  style={{ borderLeftColor: meta.color, backgroundColor: meta.bgColor }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p style={{ color: meta.color }} className="text-sm font-bold">
                        {i.title}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">{i.body}</p>
                      {i.action_url && (
                        <button
                          onClick={() => router.push(i.action_url!)}
                          className="text-xs font-bold mt-2 hover:underline"
                          style={{ color: meta.color }}
                        >
                          Ver detalles →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Preguntas */}
      {tab === 'preguntas' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <p className="text-sm font-semibold text-slate-900 mb-4">Pregúntale al Advisor</p>
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Ej: ¿Quién me debe más? ¿Me alcanza para pagar a los proveedores? ¿Qué productos se está"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            rows={3}
          />
          <button
            onClick={askAdvisor}
            disabled={asking || !question.trim()}
            className="w-full py-2.5 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors"
          >
            {asking ? 'Pensando...' : '💬 Preguntar'}
          </button>
          <p className="text-xs text-slate-500 mt-3">
            El Advisor analizará tus datos de GastoCheck, CobraCheck, BancoCheck y FlujoCheck para responder.
          </p>
        </div>
      )}
    </div>
  );
}
