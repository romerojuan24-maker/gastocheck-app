'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase, getSessionUser } from '../../../lib/supabase';
import { getStockStatus } from '@gastocheck/shared';
import type { InventoryProduct, InventoryAlert } from '@gastocheck/shared';

export default function InventarioCheckPage() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'stock' | 'alertas'>('stock');

  const load = useCallback(async (cid: string) => {
    setLoading(true);
    try {
      const [prodRes, alertRes] = await Promise.all([
        supabase.from('inventory_products').select('*').eq('company_id', cid).eq('is_active', true),
        supabase.from('inventory_alerts').select('*').eq('company_id', cid).eq('is_read', false),
      ]);
      setProducts((prodRes.data ?? []) as InventoryProduct[]);
      setAlerts((alertRes.data ?? []) as InventoryAlert[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getSessionUser().then(u => { if (u) { setCompanyId(u.company_id); load(u.company_id); } });
  }, [load]);

  const agotados = products.filter(p => p.stock_current <= 0).length;
  const bajos = products.filter(p => p.stock_current > 0 && p.stock_current <= p.stock_minimum).length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6"><h1 className="text-2xl font-black text-slate-900">📦 InventarioCheck</h1><p className="text-slate-500 text-sm mt-1">Gestión de stock</p></div>
      <div className="grid grid-cols-3 gap-4 mb-6"><div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-600">Total</p><p className="text-2xl font-black">{products.length}</p></div><div className="bg-amber-50 rounded-xl border border-amber-200 p-4"><p className="text-xs text-amber-600">Bajo</p><p className="text-2xl font-black text-amber-700">{bajos}</p></div><div className="bg-red-50 rounded-xl border border-red-200 p-4"><p className="text-xs text-red-600">Agotados</p><p className="text-2xl font-black text-red-700">{agotados}</p></div></div>
      <div className="flex gap-1 mb-6 border-b border-slate-200">{['stock', 'alertas'].map(t => <button key={t} onClick={() => setTab(t as any)} className={`px-3 py-3 text-sm font-bold ${tab === t ? 'text-emerald-600 border-b-2 border-emerald-500' : 'text-slate-500'}`}>{t === 'stock' ? 'Productos' : 'Alertas'}</button>)}</div>
      {loading ? <div className="text-center py-12">Cargando...</div> : tab === 'stock' ? (products.length === 0 ? <div className="text-center py-12 bg-white rounded-xl">Sin productos</div> : <div className="space-y-3">{products.map(p => {const status = getStockStatus(p); return <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4 flex justify-between"><div><p className="font-bold">{p.name}</p><p className="text-xs text-slate-500">SKU: {p.sku || '—'}</p></div><div><p style={{ color: status.color }} className="font-black">{p.stock_current.toFixed(1)}</p><p className="text-xs">{status.label}</p></div></div>;})}  </div>) : (alerts.length === 0 ? <div className="text-center py-12 bg-white rounded-xl">Sin alertas</div> : <div className="space-y-3">{alerts.map(a => <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4"><p className="font-bold">{a.message}</p><p className="text-xs text-slate-500 mt-1">{a.alert_type}</p></div>)}</div>)}
    </div>
  );
}
