'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase, getSessionUser } from '../../../lib/supabase';
import { CASH_FLOW_RISK_META, projectCashFlow } from '@gastocheck/shared';
import type { CashFlowItem } from '@gastocheck/shared';

const money = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export default function FlujoCheckPage() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [items, setItems] = useState<CashFlowItem[]>([]);
  const [risk, setRisk] = useState<'green' | 'yellow' | 'red'>('green');
  const [projected, setProjected] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (cid: string) => {
    setLoading(true);
    try {
      const [accData, itemsRes] = await Promise.all([
        supabase.from('bank_accounts').select('current_balance').eq('company_id', cid).eq('is_active', true),
        supabase.from('cash_flow_items').select('*').eq('company_id', cid).eq('is_scenario', false).order('expected_date', { ascending: true }).limit(50),
      ]);
      const bal = (accData.data ?? []).reduce((s, a) => s + (a.current_balance ?? 0), 0);
      setCurrentBalance(bal);
      const its = (itemsRes.data ?? []) as CashFlowItem[];
      setItems(its);
      const { balance, risk: r } = projectCashFlow(bal, its, 7);
      setProjected(balance);
      setRisk(r);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getSessionUser().then(u => { if (u) { setCompanyId(u.company_id); load(u.company_id); } });
  }, [load]);

  const riskMeta = CASH_FLOW_RISK_META[risk];
  const income = items.filter(i => i.direction === 'in').reduce((s, i) => s + i.amount, 0);
  const expense = items.filter(i => i.direction === 'out').reduce((s, i) => s + i.amount, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6"><h1 className="text-2xl font-black text-slate-900">📈 FlujoCheck</h1><p className="text-slate-500 text-sm mt-1">Proyección de flujo de caja</p></div>
      <div className="grid grid-cols-3 gap-4 mb-6"><div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-600 mb-1">Saldo hoy</p><p className="text-2xl font-black">{money(currentBalance)}</p></div><div className="bg-green-50 rounded-xl border border-green-200 p-4"><p className="text-xs text-green-600 mb-1">Ingresos</p><p className="text-2xl font-black text-green-700">+{money(income)}</p></div><div className="bg-red-50 rounded-xl border border-red-200 p-4"><p className="text-xs text-red-600 mb-1">Egresos</p><p className="text-2xl font-black text-red-700">-{money(expense)}</p></div></div>
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6"><p className="text-sm font-bold text-slate-600 mb-2">PROYECCIÓN 7 DÍAS</p><div className="flex items-baseline gap-4"><p className="text-4xl font-black">{money(projected)}</p><p style={{ color: riskMeta.color }} className="text-sm font-bold">{riskMeta.label}</p></div></div>
      {loading ? <div className="text-center py-12">Cargando...</div> : items.length === 0 ? <div className="text-center py-12 bg-white rounded-xl">Sin movimientos</div> : <div className="space-y-3">{items.map(i => <div key={i.id} className={`rounded-xl p-4 flex justify-between ${i.direction === 'in' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}><p className="font-bold">{i.description}</p><p className={`font-black ${i.direction === 'in' ? 'text-green-600' : 'text-red-600'}`}>{i.direction === 'in' ? '+' : '-'}{money(Math.abs(i.amount))}</p></div>)}</div>}
    </div>
  );
}
