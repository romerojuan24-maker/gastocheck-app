'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, getSessionUser } from '../../../lib/supabase';
import { projectCashFlow, CASH_FLOW_RISK_META } from '@gastocheck/shared';
import type { CashFlowItem } from '@gastocheck/shared';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

interface Dashboard {
  current_balance: number;
  expected_income_7d: number;
  expected_expense_7d: number;
  projected_balance_7d: number;
  risk_level_7d: 'green' | 'yellow' | 'red';
  items: CashFlowItem[];
}

export default function FlujoCheckPage() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [horizon, setHorizon] = useState(7);

  const load = useCallback(async (cid: string) => {
    setLoading(true);
    try {
      // Saldo actual
      const { data: accData } = await supabase
        .from('bank_accounts')
        .select('current_balance').eq('company_id', cid).eq('is_active', true);
      const currentBalance = (accData ?? []).reduce((s, a) => s + (a.current_balance ?? 0), 0);

      // Items de flujo
      const { data: itemsData } = await supabase
        .from('cash_flow_items')
        .select('*').eq('company_id', cid).eq('is_scenario', false)
        .order('expected_date', { ascending: true });

      const items = (itemsData ?? []) as CashFlowItem[];

      // Calcular proyección
      const { balance: bal7d, risk: risk7d } = projectCashFlow(currentBalance, items, 7);
      const { balance: bal30d, risk: risk30d } = projectCashFlow(currentBalance, items, 30);

      const income7d = items
        .filter(i => i.direction === 'in' && new Date(i.expected_date) <= new Date(Date.now() + 7*24*60*60*1000))
        .reduce((s, i) => s + i.amount, 0);

      const expense7d = items
        .filter(i => i.direction === 'out' && new Date(i.expected_date) <= new Date(Date.now() + 7*24*60*60*1000))
        .reduce((s, i) => s + i.amount, 0);

      setData({
        current_balance: currentBalance,
        expected_income_7d: income7d,
        expected_expense_7d: expense7d,
        projected_balance_7d: bal7d,
        risk_level_7d: risk7d,
        items,
      });
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

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const riskMeta = CASH_FLOW_RISK_META[data.risk_level_7d];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">📈 FlujoCheck</h1>
        <p className="text-slate-500 text-sm mt-1">¿Me va a alcanzar?</p>
      </div>

      {/* KPI principal */}
      <div className={`rounded-2xl p-6 mb-6 border-2 ${
        data.risk_level_7d === 'green'  ? 'bg-emerald-50 border-emerald-300'
        : data.risk_level_7d === 'yellow' ? 'bg-amber-50 border-amber-300'
        : 'bg-red-50 border-red-300'
      }`}>
        <p className={`text-xs font-bold mb-2 ${
          data.risk_level_7d === 'green'  ? 'text-emerald-700'
          : data.risk_level_7d === 'yellow' ? 'text-amber-700'
          : 'text-red-700'
        }`}>
          {riskMeta.message.toUpperCase()}
        </p>
        <p className="text-4xl font-black text-slate-900 mb-1">{money(data.projected_balance_7d)}</p>
        <p className={`text-sm font-bold ${
          data.risk_level_7d === 'green'  ? 'text-emerald-700'
          : data.risk_level_7d === 'yellow' ? 'text-amber-700'
          : 'text-red-700'
        }`}>
          Saldo proyectado en 7 días
        </p>
      </div>

      {/* Fila de KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-600 mb-1">Saldo actual</p>
          <p className="text-xl font-black text-slate-900">{money(data.current_balance)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-600 mb-1">Ingresos 7d</p>
          <p className="text-xl font-black text-emerald-700">+{money(data.expected_income_7d)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-600 mb-1">Egresos 7d</p>
          <p className="text-xl font-black text-red-700">-{money(data.expected_expense_7d)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-600 mb-1">Disponible</p>
          <p className="text-xl font-black text-slate-900">
            {money(data.current_balance + data.expected_income_7d - data.expected_expense_7d)}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <h2 className="text-sm font-bold text-slate-900 mb-4">Próximos movimientos</h2>
      <div className="space-y-2 mb-8">
        {data.items.slice(0, 10).map((item, i) => {
          const daysFromNow = Math.ceil(
            (new Date(item.expected_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          const isIncome = item.direction === 'in';

          return (
            <div
              key={item.id}
              className={`rounded-xl p-3 flex items-center justify-between border ${
                isIncome
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{item.description}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {daysFromNow === 0
                    ? 'Hoy'
                    : daysFromNow === 1
                    ? 'Mañana'
                    : `En ${daysFromNow} días`}
                </p>
              </div>
              <p
                className={`text-sm font-black shrink-0 ml-2 ${
                  isIncome ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {isIncome ? '+' : '-'}{money(Math.abs(item.amount))}
              </p>
            </div>
          );
        })}
        {data.items.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">Sin movimientos proyectados</p>
        )}
      </div>

      {/* Escenarios (futuro) */}
      <div className="bg-slate-100 rounded-xl border border-slate-200 p-4 text-center">
        <p className="text-sm text-slate-600">
          🔮 Escenarios "¿Qué pasa si?" próximamente
        </p>
      </div>
    </div>
  );
}
