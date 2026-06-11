'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { computeBalance, STATUS_META, BATCH_STATUS_META } from '@gastocheck/shared';
import type { Policy, Expense, Advance } from '@gastocheck/shared';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

interface ExpenseRow extends Expense {
  spender?: { full_name: string };
}

interface BatchRow {
  id: string;
  name: string;
  status: string;
  receipt_count?: number;
  total_amount?: number;
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [tab, setTab] = useState<'overview' | 'expenses' | 'batches'>('overview');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Cargar póliza activa
      const { data: policies } = await supabase
        .from('policies')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!policies?.length) {
        setLoading(false);
        return;
      }

      const pol = policies[0] as Policy;
      setPolicy(pol);

      // Cargar gastos
      const { data: expData } = await supabase
        .from('expenses')
        .select('*, spender:profiles!expenses_spender_id_fkey(full_name)')
        .eq('policy_id', pol.id)
        .not('status', 'in', '(deleted,duplicate,closed_in_policy)')
        .order('created_at', { ascending: false })
        .limit(50);
      setExpenses((expData ?? []) as ExpenseRow[]);

      // Cargar anticipos
      const { data: advData } = await supabase
        .from('advances')
        .select('*')
        .eq('policy_id', pol.id);
      setAdvances(advData ?? []);

      // Cargar relaciones contables
      const { data: batchData } = await supabase
        .from('receipt_batches')
        .select('id, name, status')
        .eq('company_id', pol.company_id)
        .order('created_at', { ascending: false })
        .limit(20);

      const enriched: BatchRow[] = [];
      for (const b of batchData ?? []) {
        const { count } = await supabase
          .from('receipt_batch_items')
          .select('*', { count: 'exact', head: true })
          .eq('batch_id', b.id);
        const { data: tots } = await supabase
          .from('receipt_batch_items')
          .select('receipt:receipts!receipt_batch_items_receipt_id_fkey(total_amount)')
          .eq('batch_id', b.id);
        const total = (tots ?? []).reduce((s: number, t: any) => s + (t.receipt?.total_amount ?? 0), 0);
        enriched.push({ ...b, receipt_count: count ?? 0, total_amount: total });
      }
      setBatches(enriched);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-white rounded-2xl p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">GastoCheck</h1>
          <p className="text-gray-500">Sin póliza activa. Crea una desde la app móvil.</p>
        </div>
      </div>
    );
  }

  const balance = computeBalance(
    { opening_balance: policy.opening_balance },
    advances,
    expenses.map((e) => ({ total: e.total, status: e.status })),
  );

  const pending = expenses.filter((e) => e.status === 'pending_auth');
  const approved = expenses.filter((e) => e.status === 'authorized');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">GastoCheck</h1>
          <p className="text-gray-600 mt-1">
            Póliza: <span className="font-semibold">{policy.name}</span>
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Anticipos</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{money(balance.advances)}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Autorizados</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{money(balance.authorizedSpent)}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Por verificar</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{money(balance.pendingToVerify)}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Disponible</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{money(balance.available)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-200 rounded-xl p-1 w-fit">
          {(['overview', 'expenses', 'batches'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t === 'overview' ? 'Resumen' : t === 'expenses' ? 'Gastos' : 'Relaciones'}
            </button>
          ))}
        </div>

        {/* TAB: OVERVIEW */}
        {tab === 'overview' && (
          <>
            {/* Gastos pendientes */}
            {pending.length > 0 && (
              <section className="bg-white rounded-2xl p-6 shadow-sm mb-6">
                <h2 className="text-lg font-semibold mb-4">
                  Autorizaciones pendientes
                  <span className="ml-2 bg-orange-100 text-orange-700 text-sm font-medium px-2 py-0.5 rounded-full">
                    {pending.length}
                  </span>
                </h2>
                <div className="divide-y">
                  {pending.map((e) => {
                    const meta = STATUS_META[e.status];
                    return (
                      <div key={e.id} className="py-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{e.provider_name ?? '(sin nombre)'}</p>
                          <p className="text-sm text-gray-500">
                            {e.spender?.full_name ?? e.spender_id}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-lg">{money(e.total)}</p>
                          <span
                            className="inline-block text-xs font-medium px-2 py-1 rounded-full text-white mt-1"
                            style={{ backgroundColor: meta.color }}
                          >
                            {meta.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Últimos gastos autorizados */}
            {approved.length > 0 && (
              <section className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Últimos gastos autorizados</h2>
                <div className="divide-y">
                  {approved.slice(0, 5).map((e) => (
                    <div key={e.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{e.provider_name ?? '—'}</p>
                        <p className="text-sm text-gray-500">{e.spender?.full_name ?? '—'}</p>
                      </div>
                      <p className="font-semibold">{money(e.total)}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* TAB: EXPENSES */}
        {tab === 'expenses' && (
          <section className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Todos los gastos ({expenses.length})</h2>
            {expenses.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Sin gastos</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 font-medium">Proveedor</th>
                      <th className="pb-3 font-medium">Empleado</th>
                      <th className="pb-3 font-medium">Monto</th>
                      <th className="pb-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {expenses.map((e) => {
                      const meta = STATUS_META[e.status];
                      return (
                        <tr key={e.id} className="hover:bg-gray-50">
                          <td className="py-3 font-medium max-w-[180px] truncate">
                            {e.provider_name ?? '—'}
                          </td>
                          <td className="py-3 text-xs text-gray-600">
                            {e.spender?.full_name ?? '—'}
                          </td>
                          <td className="py-3 font-semibold">{money(e.total)}</td>
                          <td className="py-3">
                            <span
                              className="px-2 py-1 text-xs font-medium rounded-full text-white"
                              style={{ backgroundColor: meta.color }}
                            >
                              {meta.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* TAB: BATCHES */}
        {tab === 'batches' && (
          <section className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Relaciones contables ({batches.length})</h2>
            {batches.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Sin relaciones</p>
            ) : (
              <div className="divide-y">
                {batches.map((b) => {
                  const meta = BATCH_STATUS_META[b.status as keyof typeof BATCH_STATUS_META];
                  return (
                    <div key={b.id} className="py-4 flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{b.name}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {b.receipt_count ?? 0} comprobantes · {money(b.total_amount ?? 0)}
                        </p>
                      </div>
                      {meta && (
                        <span
                          className="px-3 py-1 text-xs font-medium rounded-full text-white whitespace-nowrap"
                          style={{ backgroundColor: meta.color }}
                        >
                          {meta.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
