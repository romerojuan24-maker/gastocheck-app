'use client';

import { useEffect, useState, useCallback } from 'react';
import { computeBalance, STATUS_META, type Expense, type Policy, type Advance } from '@gastocheck/shared';
import { createClient } from '@supabase/supabase-js';
import { Logo } from '../components/Logo';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

type ExpenseRow = Pick<Expense, 'id' | 'provider_name' | 'total' | 'status' | 'spender_id'> & {
  spender?: { full_name: string } | null;
  expense_date?: string | null;
};

// ── Componente KPI ────────────────────────────────────────────
function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold" style={{ color: accent ?? '#0D1B2A' }}>
        {value}
      </div>
    </div>
  );
}

// ── Modal de rechazo ──────────────────────────────────────────
function RejectModal({
  expenseId,
  onConfirm,
  onCancel,
}: {
  expenseId: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-bold text-navy mb-2">Motivo de rechazo</h3>
        <p className="text-sm text-gray-500 mb-4">Indica el motivo para que el empleado pueda corregirlo.</p>
        <textarea
          className="w-full border rounded-xl p-3 text-sm resize-none"
          rows={3}
          placeholder="Ej: Ticket ilegible, falta RFC emisor, monto incorrecto..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-3 mt-4 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border text-sm font-medium text-gray-600"
          >
            Cancelar
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason)}
            disabled={!reason.trim()}
            className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium disabled:opacity-50"
          >
            Rechazar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────
export default function Home() {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [advances, setAdvances] = useState<Pick<Advance, 'amount'>[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Pólizas abiertas de la empresa (el supervisor ve todas)
      const { data: policies } = await supabase
        .from('policies')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1);

      if (policies && policies.length > 0) {
        setPolicy(policies[0] as Policy);

        const { data: advData } = await supabase
          .from('advances')
          .select('amount')
          .eq('policy_id', policies[0].id);
        setAdvances(advData ?? []);

        // Gastos de TODAS las pólizas abiertas de la empresa
        const { data: expData } = await supabase
          .from('expenses')
          .select(`
            id, provider_name, total, status, spender_id, expense_date,
            spender:profiles!expenses_spender_id_fkey(full_name)
          `)
          .eq('policy_id', policies[0].id)
          .not('status', 'in', '(deleted,duplicate,closed_in_policy)')
          .order('created_at', { ascending: false });

        setExpenses((expData as ExpenseRow[]) ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function applyAction(expenseId: string, action: string, rejectionReason?: string) {
    setActionLoading(expenseId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/authorize-expense`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ expense_id: expenseId, action, rejection_reason: rejectionReason }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error');
      showToast(action === 'authorize' ? '✓ Gasto autorizado' : '✕ Gasto rechazado', action === 'authorize');
      await loadData();
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setActionLoading(null);
      setRejectTarget(null);
    }
  }

  const balance = policy
    ? computeBalance(
        { opening_balance: policy.opening_balance },
        advances,
        expenses.map((e) => ({ total: e.total, status: e.status })),
      )
    : null;

  const pending = expenses.filter((e) => e.status === 'pending_auth');

  return (
    <main className="mx-auto max-w-5xl p-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-xl px-5 py-3 text-white text-sm font-medium shadow-lg transition-all ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}
        >
          {toast.msg}
        </div>
      )}

      {/* Modal de rechazo */}
      {rejectTarget && (
        <RejectModal
          expenseId={rejectTarget}
          onConfirm={(reason) => applyAction(rejectTarget, 'reject', reason)}
          onCancel={() => setRejectTarget(null)}
        />
      )}

      {/* Header */}
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-2xl font-bold">GastoCheck</h1>
            <p className="text-sm text-gray-500">
              {policy ? `Póliza: ${policy.name}` : 'Sin póliza activa'}
            </p>
          </div>
        </div>
        <button
          onClick={loadData}
          className="rounded-xl border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          ↻ Actualizar
        </button>
      </header>

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl bg-white p-5 shadow-sm animate-pulse h-20" />
          ))}
        </div>
      ) : balance ? (
        <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Kpi label="Anticipos entregados" value={money(balance.advances)} accent="#1565C0" />
          <Kpi label="Gastos autorizados" value={money(balance.authorizedSpent)} accent="#43A047" />
          <Kpi label="Por comprobar" value={money(balance.pendingToVerify)} accent="#FF9800" />
          <Kpi label="Saldo disponible" value={money(balance.available)} accent="#0D1B2A" />
        </section>
      ) : (
        <div className="mb-8 rounded-2xl bg-white p-6 text-center text-gray-500">
          No hay póliza activa. Crea una póliza para comenzar.
        </div>
      )}

      {/* Bandeja de autorización */}
      <section className="rounded-2xl bg-white p-5 shadow-sm mb-6">
        <h2 className="mb-1 text-lg font-semibold">
          Autorizaciones pendientes
          {pending.length > 0 && (
            <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-sm text-orange-700 font-medium">
              {pending.length}
            </span>
          )}
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Revisa imagen y datos antes de autorizar
        </p>

        {pending.length === 0 ? (
          <p className="text-center text-gray-400 py-8">✓ Sin autorizaciones pendientes</p>
        ) : (
          <div className="divide-y">
            {pending.map((e) => {
              const meta = STATUS_META[e.status];
              const isActioning = actionLoading === e.id;
              return (
                <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <div className="font-medium">{e.provider_name ?? '(sin nombre)'}</div>
                    <div className="text-sm text-gray-500">
                      {(e.spender as any)?.full_name ?? e.spender_id}
                      {e.expense_date && <span className="ml-2 text-gray-400">· {e.expense_date}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-lg">{money(e.total)}</span>
                    <span
                      className="rounded-full px-3 py-1 text-xs font-medium text-white"
                      style={{ backgroundColor: meta.color }}
                    >
                      {meta.label}
                    </span>
                    <button
                      onClick={() => applyAction(e.id, 'authorize')}
                      disabled={isActioning}
                      className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-green-700"
                    >
                      {isActioning ? '...' : '✓ Autorizar'}
                    </button>
                    <button
                      onClick={() => setRejectTarget(e.id)}
                      disabled={isActioning}
                      className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-red-700"
                    >
                      ✕ Rechazar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Todos los gastos */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Todos los gastos</h2>
        <div className="divide-y">
          {expenses.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Sin gastos registrados</p>
          ) : (
            expenses.map((e) => {
              const meta = STATUS_META[e.status];
              return (
                <div key={e.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{e.provider_name ?? '(sin nombre)'}</div>
                    <div className="text-sm text-gray-500">
                      {(e.spender as any)?.full_name ?? e.spender_id}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold">{money(e.total)}</span>
                    <span
                      className="rounded-full px-3 py-1 text-xs font-medium text-white"
                      style={{ backgroundColor: meta.color }}
                    >
                      {meta.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <footer className="mt-8 text-center text-sm text-gray-400">
        GastoCheck · datos en tiempo real desde Supabase
      </footer>
    </main>
  );
}
