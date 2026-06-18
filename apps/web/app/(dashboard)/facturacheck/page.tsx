'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSessionUser } from '../../../lib/supabase';
import { CFDI_STATUS_META } from '@gastocheck/shared';
import type { CfdiDocument } from '@gastocheck/shared';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

export default function FacturaCheckPage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [cfdis, setCfdis] = useState<CfdiDocument[]>([]);
  const [tab, setTab] = useState<'received' | 'issued' | 'problems'>('received');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (cid: string) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('cfdi_documents')
        .select('*').eq('company_id', cid)
        .order('created_at', { ascending: false })
        .limit(200);
      setCfdis((data ?? []) as CfdiDocument[]);
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

  const filtered = cfdis.filter(c => {
    if (tab === 'received') return c.direction === 'received' && c.status !== 'cancelado';
    if (tab === 'issued') return c.direction === 'issued' && c.status !== 'cancelado';
    if (tab === 'problems') return ['cancelado', 'not_found', 'duplicate'].includes(c.status);
    return true;
  });

  const totalAmount = filtered.reduce((s, c) => s + (c.total ?? 0), 0);
  const problemCount = cfdis.filter(c => ['cancelado','not_found','duplicate'].includes(c.status)).length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">📄 FacturaCheck</h1>
        <p className="text-slate-500 text-sm mt-1">Gestión de CFDI y validación SAT</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-600 mb-1">Recibidas vigentes</p>
          <p className="text-2xl font-black text-slate-900">
            {cfdis.filter(c => c.direction === 'received' && c.status === 'vigente').length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-600 mb-1">Emitidas vigentes</p>
          <p className="text-2xl font-black text-slate-900">
            {cfdis.filter(c => c.direction === 'issued' && c.status === 'vigente').length}
          </p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <p className="text-xs font-semibold text-red-600 mb-1">Con problemas</p>
          <p className="text-2xl font-black text-red-700">{problemCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {[
          { key: 'received', label: `Recibidas (${cfdis.filter(c => c.direction === 'received').length})` },
          { key: 'issued',   label: `Emitidas (${cfdis.filter(c => c.direction === 'issued').length})` },
          { key: 'problems', label: `Con problemas (${problemCount})` },
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

      {/* Acciones */}
      {tab !== 'problems' && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => router.push('/facturacheck/subir')}
            className="px-4 py-2.5 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600"
          >
            📤 Subir XML
          </button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-2">📋</p>
          <p className="text-slate-500 font-medium">
            {tab === 'problems' ? 'Sin problemas' : 'Sin CFDI'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const meta = CFDI_STATUS_META[c.status as keyof typeof CFDI_STATUS_META] || {
              label: c.status, color: '#999', icon: '?',
            };
            return (
              <div
                key={c.id}
                onClick={() => router.push(`/facturacheck/${c.id}`)}
                className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer flex items-start gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate font-mono">{c.uuid_cfdi}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {c.rfc_emisor} → {c.rfc_receptor}
                  </p>
                  {c.razon_social_emisor && (
                    <p className="text-xs text-slate-500">{c.razon_social_emisor}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {c.total && <p className="text-base font-black text-slate-900">{money(c.total)}</p>}
                  <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ color: meta.color, backgroundColor: meta.color + '15' }}>
                    {meta.icon} {meta.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
