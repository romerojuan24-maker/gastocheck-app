'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSessionUser } from '../../../lib/supabase';
import { getStockStatus, INVENTORY_ALERT_META } from '@gastocheck/shared';
import type { InventoryProduct, InventoryAlert } from '@gastocheck/shared';

export default function InventarioCheckPage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'stock' | 'alertas'>('stock');

  const load = useCallback(async (cid: string) => {
    setLoading(true);
    try {
      const [prodRes, alertRes] = await Promise.all([
        supabase.from('inventory_products')
          .select('*').eq('company_id', cid).eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase.from('inventory_alerts')
          .select('*').eq('company_id', cid).eq('is_read', false)
          .order('created_at', { ascending: false }),
      ]);
      setProducts((prodRes.data ?? []) as InventoryProduct[]);
      setAlerts((alertRes.data ?? []) as InventoryAlert[]);
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

  const agotados = products.filter(p => p.stock_current <= 0).length;
  const bajos = products.filter(p => p.stock_current > 0 && p.stock_current <= p.stock_minimum).length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">📦 InventarioCheck</h1>
        <p className="text-slate-500 text-sm mt-1">¿Qué tengo y qué falta?</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-600 mb-1">Total productos</p>
          <p className="text-2xl font-black text-slate-900">{products.length}</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <p className="text-xs text-amber-600 mb-1">Stock bajo</p>
          <p className="text-2xl font-black text-amber-700">{bajos}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <p className="text-xs text-red-600 mb-1">Agotados</p>
          <p className="text-2xl font-black text-red-700">{agotados}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {[
          { key: 'stock',   label: `Productos (${products.length})` },
          { key: 'alertas', label: `Alertas (${alerts.length})` },
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

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      ) : tab === 'stock' ? (
        <div className="space-y-3">
          {products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-2">📦</p>
              <p className="text-slate-500 font-medium">Sin productos</p>
            </div>
          ) : (
            products.map(p => {
              const status = getStockStatus(p);
              return (
                <div
                  key={p.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between hover:shadow-md transition-shadow"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      SKU: {p.sku || '—'} · {p.unit}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    <div>
                      <p className={`text-lg font-black ${status.color}`}>
                        {p.stock_current.toFixed(1)}
                      </p>
                      <span
                        className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
                          status.status === 'ok'
                            ? 'bg-emerald-100 text-emerald-700'
                            : status.status === 'low'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-2">✅</p>
              <p className="text-slate-500 font-medium">Sin alertas</p>
            </div>
          ) : (
            alerts.map(a => {
              const meta = INVENTORY_ALERT_META[a.alert_type as keyof typeof INVENTORY_ALERT_META] || {
                label: a.alert_type,
                color: '#999',
                icon: '⚠',
              };
              return (
                <div
                  key={a.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3"
                >
                  <span className="text-lg mt-0.5">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{a.message}</p>
                    <p className="text-xs text-slate-500 mt-1">{a.alert_type}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
