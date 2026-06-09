'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  computeBalance, STATUS_META, RECEIPT_STATUS_META, DUPLICATE_STATUS_META,
  type Expense, type Policy, type Advance,
} from '@gastocheck/shared';
import { createClient } from '@supabase/supabase-js';
import { Logo } from '../components/Logo';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

// ── Tipos locales ─────────────────────────────────────────────────────────────

type ExpenseRow = Pick<Expense, 'id' | 'provider_name' | 'total' | 'status' | 'spender_id'> & {
  spender?: { full_name: string } | null;
  expense_date?: string | null;
};

interface ReceiptRow {
  id:               string;
  provider_name:    string | null;
  total_amount:     number | null;
  receipt_date:     string | null;
  status:           string;
  duplicate_status: string;
  source_type:      string;
  ocr_confidence:   number | null;
  batch_id:         string | null;
  created_at:       string;
  uploaded_by:      string;
  uploader?:        { full_name: string } | null;
}

// ── Componentes menores ───────────────────────────────────────────────────────

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

function RejectModal({
  onConfirm, onCancel, title = 'Motivo de rechazo',
}: {
  onConfirm: (reason: string) => void;
  onCancel:  () => void;
  title?:    string;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-4">
          El empleado verá este motivo para poder corregirlo.
        </p>
        <textarea
          className="w-full border rounded-xl p-3 text-sm resize-none"
          rows={3}
          placeholder="Ej: Ticket ilegible, falta RFC emisor, monto no coincide..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-3 mt-4 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-xl border text-sm font-medium text-gray-600">
            Cancelar
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason)}
            disabled={!reason.trim()}
            className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium disabled:opacity-50">
            Rechazar
          </button>
        </div>
      </div>
    </div>
  );
}

function DuplicateBadge({ status }: { status: string }) {
  if (status === 'no_duplicate') return null;
  const meta = DUPLICATE_STATUS_META[status as keyof typeof DUPLICATE_STATUS_META];
  if (!meta) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: meta.color + '20', color: meta.color }}
    >
      {meta.icon} {meta.label}
    </span>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Home() {
  const [loading,       setLoading]       = useState(true);
  const [expenses,      setExpenses]      = useState<ExpenseRow[]>([]);
  const [receipts,      setReceipts]      = useState<ReceiptRow[]>([]);
  const [policy,        setPolicy]        = useState<Policy | null>(null);
  const [advances,      setAdvances]      = useState<Pick<Advance, 'amount'>[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectTarget,  setRejectTarget]  = useState<{ id: string; type: 'expense' | 'receipt' } | null>(null);
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const [tab,           setTab]           = useState<'expenses' | 'receipts'>('expenses');

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Cargar datos ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: policies } = await supabase
        .from('policies')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1);

      if (policies && policies.length > 0) {
        const pol = policies[0] as Policy;
        setPolicy(pol);

        // Anticipos
        const { data: advData } = await supabase
          .from('advances').select('amount').eq('policy_id', pol.id);
        setAdvances(advData ?? []);

        // Gastos de la póliza
        const { data: expData } = await supabase
          .from('expenses')
          .select(`
            id, provider_name, total, status, spender_id, expense_date,
            spender:profiles!expenses_spender_id_fkey(full_name)
          `)
          .eq('policy_id', pol.id)
          .not('status', 'in', '(deleted,duplicate,closed_in_policy)')
          .order('created_at', { ascending: false });
        setExpenses((expData as ExpenseRow[]) ?? []);

        // Comprobantes de la empresa (últimos 50, excluyendo cancelados)
        const { data: recData } = await supabase
          .from('receipts')
          .select(`
            id, provider_name, total_amount, receipt_date, status,
            duplicate_status, source_type, ocr_confidence, batch_id,
            created_at, uploaded_by,
            uploader:profiles!receipts_uploaded_by_fkey(full_name)
          `)
          .eq('company_id', pol.company_id)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
          .limit(50);
        setReceipts((recData as ReceiptRow[]) ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Acciones sobre gastos (ledger) ─────────────────────────────────────────

  async function applyExpenseAction(expenseId: string, action: string, reason?: string) {
    setActionLoading(expenseId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/authorize-expense`,
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            Authorization: `Bearer ${session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ expense_id: expenseId, action, rejection_reason: reason }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error');
      showToast(action === 'authorize' ? '✓ Gasto autorizado' : '✕ Gasto rechazado',
                action === 'authorize');
      await loadData();
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setActionLoading(null);
      setRejectTarget(null);
    }
  }

  // ── Acciones sobre comprobantes ────────────────────────────────────────────

  async function applyReceiptAction(receiptId: string, action: 'approve' | 'reject', reason?: string) {
    setActionLoading(receiptId);
    try {
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const { error } = await supabase
        .from('receipts')
        .update({
          status:           newStatus,
          rejection_reason: reason ?? null,
          approved_by:      action === 'approve' ? (await supabase.auth.getUser()).data.user?.id : null,
          approved_at:      action === 'approve' ? new Date().toISOString() : null,
          rejected_by:      action === 'reject'  ? (await supabase.auth.getUser()).data.user?.id : null,
          rejected_at:      action === 'reject'  ? new Date().toISOString() : null,
        })
        .eq('id', receiptId);

      if (error) throw new Error(error.message);
      showToast(action === 'approve' ? '✓ Comprobante aprobado' : '✕ Comprobante rechazado',
                action === 'approve');
      await loadData();
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setActionLoading(null);
      setRejectTarget(null);
    }
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  const balance = policy
    ? computeBalance(
        { opening_balance: policy.opening_balance },
        advances,
        expenses.map((e) => ({ total: e.total, status: e.status })),
      )
    : null;

  const pendingExpenses  = expenses.filter((e) => e.status === 'pending_auth');
  const pendingReceipts  = receipts.filter((r) => r.status === 'submitted');
  const duplicateWarnings = receipts.filter((r) => r.duplicate_status !== 'no_duplicate');

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-5 py-3 text-white text-sm font-medium shadow-lg
          ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Modal de rechazo */}
      {rejectTarget && (
        <RejectModal
          onConfirm={(reason) => {
            if (rejectTarget.type === 'expense') {
              applyExpenseAction(rejectTarget.id, 'reject', reason);
            } else {
              applyReceiptAction(rejectTarget.id, 'reject', reason);
            }
          }}
          onCancel={() => setRejectTarget(null)}
        />
      )}

      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-2xl font-bold">GastoCheck</h1>
            <p className="text-sm text-gray-500">
              {policy ? `Póliza: ${policy.name}` : 'Sin póliza activa'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {duplicateWarnings.length > 0 && (
            <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700">
              ⚠ {duplicateWarnings.length} duplicado{duplicateWarnings.length > 1 ? 's' : ''}
            </span>
          )}
          <button onClick={loadData}
            className="rounded-xl border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            ↻ Actualizar
          </button>
        </div>
      </header>

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-6">
          {[1,2,3,4].map((i) => (
            <div key={i} className="rounded-2xl bg-white p-5 shadow-sm animate-pulse h-20" />
          ))}
        </div>
      ) : balance ? (
        <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Kpi label="Anticipos"          value={money(balance.advances)}         accent="#1565C0" />
          <Kpi label="Gastos autorizados" value={money(balance.authorizedSpent)}  accent="#43A047" />
          <Kpi label="Por comprobar"      value={money(balance.pendingToVerify)}  accent="#FF9800" />
          <Kpi label="Saldo disponible"   value={money(balance.available)}        accent="#0D1B2A" />
        </section>
      ) : (
        <div className="mb-6 rounded-2xl bg-white p-6 text-center text-gray-500">
          No hay póliza activa.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 rounded-xl bg-gray-100 p-1 w-fit">
        <button
          onClick={() => setTab('expenses')}
          className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all
            ${tab === 'expenses' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
        >
          Gastos
          {pendingExpenses.length > 0 && (
            <span className="ml-2 rounded-full bg-orange-500 text-white text-xs px-1.5 py-0.5">
              {pendingExpenses.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('receipts')}
          className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all
            ${tab === 'receipts' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
        >
          Comprobantes
          {(pendingReceipts.length + duplicateWarnings.length) > 0 && (
            <span className="ml-2 rounded-full bg-orange-500 text-white text-xs px-1.5 py-0.5">
              {pendingReceipts.length + duplicateWarnings.length}
            </span>
          )}
        </button>
      </div>

      {/* ══ TAB: GASTOS ══════════════════════════════════════════ */}
      {tab === 'expenses' && (
        <>
          {/* Bandeja de autorización */}
          <section className="rounded-2xl bg-white p-5 shadow-sm mb-6">
            <h2 className="mb-1 text-lg font-semibold">
              Autorizaciones pendientes
              {pendingExpenses.length > 0 && (
                <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-sm text-orange-700 font-medium">
                  {pendingExpenses.length}
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Revisa cada gasto antes de autorizar o rechazar
            </p>
            {pendingExpenses.length === 0 ? (
              <p className="text-center text-gray-400 py-8">✓ Sin autorizaciones pendientes</p>
            ) : (
              <div className="divide-y">
                {pendingExpenses.map((e) => {
                  const meta = STATUS_META[e.status];
                  const busy = actionLoading === e.id;
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
                        <span className="rounded-full px-3 py-1 text-xs font-medium text-white"
                          style={{ backgroundColor: meta.color }}>
                          {meta.label}
                        </span>
                        <button onClick={() => applyExpenseAction(e.id, 'authorize')} disabled={busy}
                          className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-green-700">
                          {busy ? '...' : '✓ Autorizar'}
                        </button>
                        <button onClick={() => setRejectTarget({ id: e.id, type: 'expense' })}
                          disabled={busy}
                          className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-red-700">
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
            <h2 className="mb-4 text-lg font-semibold">
              Todos los gastos ({expenses.length})
            </h2>
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
                          {e.expense_date && <span className="ml-2 text-gray-400">· {e.expense_date}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{money(e.total)}</span>
                        <span className="rounded-full px-3 py-1 text-xs font-medium text-white"
                          style={{ backgroundColor: meta.color }}>
                          {meta.label}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </>
      )}

      {/* ══ TAB: COMPROBANTES ════════════════════════════════════ */}
      {tab === 'receipts' && (
        <>
          {/* Comprobantes en revisión (submitted) */}
          {pendingReceipts.length > 0 && (
            <section className="rounded-2xl bg-white p-5 shadow-sm mb-6">
              <h2 className="mb-1 text-lg font-semibold">
                Comprobantes en revisión
                <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-sm text-orange-700 font-medium">
                  {pendingReceipts.length}
                </span>
              </h2>
              <p className="text-sm text-gray-400 mb-4">
                Aprueba o rechaza cada comprobante
              </p>
              <div className="divide-y">
                {pendingReceipts.map((r) => {
                  const busy = actionLoading === r.id;
                  return (
                    <div key={r.id} className="py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{r.provider_name ?? '(sin proveedor)'}</div>
                          <div className="text-sm text-gray-500">
                            {(r.uploader as any)?.full_name ?? r.uploaded_by}
                            {r.receipt_date && <span className="ml-2 text-gray-400">· {r.receipt_date}</span>}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <DuplicateBadge status={r.duplicate_status} />
                            {r.source_type === 'photo' && (
                              <span className="text-xs text-gray-400">📷 Foto</span>
                            )}
                            {r.ocr_confidence != null && r.ocr_confidence < 70 && (
                              <span className="text-xs text-orange-600 font-medium">
                                ⚠ OCR {r.ocr_confidence}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          {r.total_amount != null && (
                            <span className="font-semibold text-lg">{money(r.total_amount)}</span>
                          )}
                          <button onClick={() => applyReceiptAction(r.id, 'approve')} disabled={busy}
                            className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-green-700">
                            {busy ? '...' : '✓ Aprobar'}
                          </button>
                          <button onClick={() => setRejectTarget({ id: r.id, type: 'receipt' })}
                            disabled={busy}
                            className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-red-700">
                            ✕ Rechazar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Todos los comprobantes */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">
              Todos los comprobantes ({receipts.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-400">
                    <th className="pb-3 font-medium">Proveedor</th>
                    <th className="pb-3 font-medium">Empleado</th>
                    <th className="pb-3 font-medium">Fecha</th>
                    <th className="pb-3 font-medium text-right">Monto</th>
                    <th className="pb-3 font-medium">Estado</th>
                    <th className="pb-3 font-medium">Duplicado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {receipts.map((r) => {
                    const sMeta = RECEIPT_STATUS_META[r.status as keyof typeof RECEIPT_STATUS_META];
                    return (
                      <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 font-medium max-w-[180px] truncate">
                          {r.provider_name ?? '—'}
                        </td>
                        <td className="py-3 text-gray-600 text-xs">
                          {(r.uploader as any)?.full_name ?? '—'}
                        </td>
                        <td className="py-3 text-gray-500">{r.receipt_date ?? '—'}</td>
                        <td className="py-3 text-right font-semibold">
                          {r.total_amount != null ? money(r.total_amount) : '—'}
                        </td>
                        <td className="py-3">
                          {sMeta && (
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{
                                backgroundColor: sMeta.color + '20',
                                color: sMeta.color,
                              }}>
                              {sMeta.label}
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <DuplicateBadge status={r.duplicate_status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {receipts.length === 0 && (
                <p className="text-center text-gray-400 py-8">Sin comprobantes registrados</p>
              )}
            </div>
          </section>
        </>
      )}

      <footer className="mt-8 text-center text-sm text-gray-400">
        GastoCheck · datos en tiempo real desde Supabase
      </footer>
    </main>
  );
}
