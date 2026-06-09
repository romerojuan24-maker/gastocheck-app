'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  computeBalance, STATUS_META, RECEIPT_STATUS_META, DUPLICATE_STATUS_META,
  BATCH_STATUS_META, EXPORT_FORMAT_META,
  canCloseBatch, canExportBatch,
  type Expense, type Policy, type Advance,
  type ExportFormat,
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

interface BatchRow {
  id:            string;
  name:          string;
  status:        string;
  period_start:  string | null;
  period_end:    string | null;
  notes:         string | null;
  created_at:    string;
  receipt_count?: number;
  total_amount?:  number;
}

type AppTab = 'expenses' | 'receipts' | 'batches' | 'export';

// ── Subcomponentes ────────────────────────────────────────────────────────────

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold" style={{ color: accent ?? '#0D1B2A' }}>{value}</div>
    </div>
  );
}

function RejectModal({ onConfirm, onCancel }: {
  onConfirm: (reason: string) => void;
  onCancel:  () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-bold mb-2">Motivo de rechazo</h3>
        <p className="text-sm text-gray-500 mb-4">El empleado verá este motivo para corregirlo.</p>
        <textarea
          className="w-full border rounded-xl p-3 text-sm resize-none"
          rows={3}
          placeholder="Ej: Ticket ilegible, falta RFC, monto no coincide..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-3 mt-4 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-xl border text-sm font-medium text-gray-600">Cancelar</button>
          <button onClick={() => reason.trim() && onConfirm(reason)}
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
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: meta.color + '20', color: meta.color }}>
      {meta.icon} {meta.label}
    </span>
  );
}

// ── Utilidades web ───────────────────────────────────────────────────────

function downloadBase64(base64: string, filename: string, mime: string): void {
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Home() {
  const [loading,        setLoading]        = useState(true);
  const [expenses,       setExpenses]       = useState<ExpenseRow[]>([]);
  const [receipts,       setReceipts]       = useState<ReceiptRow[]>([]);
  const [batches,        setBatches]        = useState<BatchRow[]>([]);
  const [policy,         setPolicy]         = useState<Policy | null>(null);
  const [companyId,      setCompanyId]      = useState<string | null>(null);
  const [advances,       setAdvances]       = useState<Pick<Advance, 'amount'>[]>([]);
  const [actionLoading,  setActionLoading]  = useState<string | null>(null);
  const [rejectTarget,   setRejectTarget]   = useState<{ id: string; type: 'expense' | 'receipt' } | null>(null);
  const [toast,          setToast]          = useState<{ msg: string; ok: boolean } | null>(null);
  const [tab,            setTab]            = useState<AppTab>('expenses');

  // Estado exportación
  const [exportFormat,   setExportFormat]   = useState<ExportFormat>('universal_excel');
  const [exportBatchId,  setExportBatchId]  = useState('');
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo,   setExportDateTo]   = useState('');
  const [exporting,      setExporting]      = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Cargar datos ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: policies } = await supabase
        .from('policies').select('*').eq('status', 'open')
        .order('created_at', { ascending: false }).limit(1);

      if (policies && policies.length > 0) {
        const pol = policies[0] as Policy;
        setPolicy(pol);
        setCompanyId(pol.company_id);

        const { data: advData } = await supabase.from('advances').select('amount').eq('policy_id', pol.id);
        setAdvances(advData ?? []);

        const { data: expData } = await supabase
          .from('expenses')
          .select(`id, provider_name, total, status, spender_id, expense_date,
            spender:profiles!expenses_spender_id_fkey(full_name)`)
          .eq('policy_id', pol.id)
          .not('status', 'in', '(deleted,duplicate,closed_in_policy)')
          .order('created_at', { ascending: false });
        setExpenses((expData as unknown as ExpenseRow[]) ?? []);

        const { data: recData } = await supabase
          .from('receipts')
          .select(`id, provider_name, total_amount, receipt_date, status,
            duplicate_status, source_type, ocr_confidence, batch_id,
            created_at, uploaded_by,
            uploader:profiles!receipts_uploaded_by_fkey(full_name)`)
          .eq('company_id', pol.company_id)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false }).limit(50);
        setReceipts((recData as unknown as ReceiptRow[]) ?? []);

        const { data: batchData } = await supabase
          .from('receipt_batches')
          .select('id, name, status, period_start, period_end, notes, created_at')
          .eq('company_id', pol.company_id)
          .order('created_at', { ascending: false }).limit(30);

        const enriched: BatchRow[] = [];
        for (const b of batchData ?? []) {
          const { count } = await supabase
            .from('receipt_batch_items').select('*', { count: 'exact', head: true }).eq('batch_id', b.id);
          const { data: tots } = await supabase
            .from('receipt_batch_items')
            .select('receipt:receipts!receipt_batch_items_receipt_id_fkey(total_amount)')
            .eq('batch_id', b.id);
          const total = (tots ?? []).reduce((s: number, t: any) => s + (t.receipt?.total_amount ?? 0), 0);
          enriched.push({ ...b, receipt_count: count ?? 0, total_amount: total });
        }
        setBatches(enriched);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Acciones gastos ───────────────────────────────────────────────────────

  async function applyExpenseAction(expenseId: string, action: string, reason?: string) {
    setActionLoading(expenseId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/authorize-expense`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ expense_id: expenseId, action, rejection_reason: reason }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error');
      showToast(action === 'authorize' ? '✓ Gasto autorizado' : '✕ Gasto rechazado', action === 'authorize');
      await loadData();
    } catch (e: any) { showToast(e.message, false); }
    finally { setActionLoading(null); setRejectTarget(null); }
  }

  // ── Acciones comprobantes ─────────────────────────────────────────────────

  async function applyReceiptAction(receiptId: string, action: 'approve' | 'reject', reason?: string) {
    setActionLoading(receiptId);
    try {
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase.from('receipts').update({
        status:           newStatus,
        rejection_reason: reason ?? null,
        approved_by:  action === 'approve' ? user?.id : null,
        approved_at:  action === 'approve' ? new Date().toISOString() : null,
        rejected_by:  action === 'reject'  ? user?.id : null,
        rejected_at:  action === 'reject'  ? new Date().toISOString() : null,
      }).eq('id', receiptId);
      if (error) throw new Error(error.message);
      showToast(action === 'approve' ? '✓ Comprobante aprobado' : '✕ Comprobante rechazado', action === 'approve');
      await loadData();
    } catch (e: any) { showToast(e.message, false); }
    finally { setActionLoading(null); setRejectTarget(null); }
  }

  // ── Acciones relaciones ───────────────────────────────────────────────────

  async function closeBatch(batchId: string) {
    if (!confirm('¿Cerrar esta relación? Ya no se podrán agregar comprobantes.')) return;
    setActionLoading(batchId);
    const { error } = await supabase.from('receipt_batches')
      .update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', batchId);
    if (error) showToast(error.message, false);
    else { showToast('✓ Relación cerrada'); await loadData(); }
    setActionLoading(null);
  }

  // ── Exportar ───────────────────────────────────────────────────────────────

  async function triggerExport() {
    if (!companyId) return;
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const body: Record<string, unknown> = { company_id: companyId, format: exportFormat };
      if (exportBatchId)  body.batch_id  = exportBatchId;
      if (exportDateFrom) body.date_from = exportDateFrom;
      if (exportDateTo)   body.date_to   = exportDateTo;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-export`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Error generando exportación');
      downloadBase64(json.content, json.filename, json.mime);
      showToast(`✓ ${json.row_count} comprobantes exportados — ${json.filename}`);
    } catch (e: any) { showToast(e.message, false); }
    finally { setExporting(false); }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const balance = policy ? computeBalance(
    { opening_balance: policy.opening_balance }, advances,
    expenses.map((e) => ({ total: e.total, status: e.status })),
  ) : null;

  const pendingExpenses  = expenses.filter((e) => e.status === 'pending_auth');
  const pendingReceipts  = receipts.filter((r) => r.status === 'submitted');
  const duplicateWarnings = receipts.filter((r) => r.duplicate_status !== 'no_duplicate');
  const openBatches      = batches.filter((b) => b.status === 'open' || b.status === 'draft');
  const exportableBatches = batches.filter((b) => canExportBatch(b.status as any));

  const tabBadge = (t: AppTab) => ({
    expenses: pendingExpenses.length,
    receipts: pendingReceipts.length + duplicateWarnings.length,
    batches:  openBatches.length,
    export:   0,
  }[t]);

  const TAB_LABEL: Record<AppTab, string> = {
    expenses: 'Gastos', receipts: 'Comprobantes', batches: 'Relaciones', export: 'Exportar',
  };

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-5 py-3 text-white text-sm font-medium shadow-lg
          ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Modal rechazo */}
      {rejectTarget && (
        <RejectModal
          onConfirm={(reason) =>
            rejectTarget.type === 'expense'
              ? applyExpenseAction(rejectTarget.id, 'reject', reason)
              : applyReceiptAction(rejectTarget.id, 'reject', reason)
          }
          onCancel={() => setRejectTarget(null)}
        />
      )}

      {/* Header */}
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-2xl font-bold">GastoCheck</h1>
            <p className="text-sm text-gray-500">
              {policy ? `Póliza: ${policy.name}` : 'Sin póliza activa'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          {[1,2,3,4].map((i) => <div key={i} className="rounded-2xl bg-white p-5 shadow-sm animate-pulse h-20" />)}
        </div>
      ) : balance ? (
        <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Kpi label="Anticipos"          value={money(balance.advances)}        accent="#1565C0" />
          <Kpi label="Gastos autorizados" value={money(balance.authorizedSpent)} accent="#43A047" />
          <Kpi label="Por comprobar"      value={money(balance.pendingToVerify)} accent="#FF9800" />
          <Kpi label="Saldo disponible"   value={money(balance.available)}       accent="#0D1B2A" />
        </section>
      ) : (
        <div className="mb-6 rounded-2xl bg-white p-6 text-center text-gray-500">No hay póliza activa.</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 rounded-xl bg-gray-100 p-1 w-fit flex-wrap">
        {(['expenses','receipts','batches','export'] as AppTab[]).map((t) => {
          const cnt = tabBadge(t);
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all
                ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
              {TAB_LABEL[t]}
              {cnt > 0 && (
                <span className="ml-2 rounded-full bg-orange-500 text-white text-xs px-1.5 py-0.5">{cnt}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ══ TAB GASTOS ══════════════════════════════════════════════════════ */}
      {tab === 'expenses' && (
        <>
          <section className="rounded-2xl bg-white p-5 shadow-sm mb-6">
            <h2 className="mb-1 text-lg font-semibold">
              Autorizaciones pendientes
              {pendingExpenses.length > 0 && (
                <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-sm text-orange-700 font-medium">
                  {pendingExpenses.length}
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-400 mb-4">Revisa antes de autorizar o rechazar</p>
            {pendingExpenses.length === 0
              ? <p className="text-center text-gray-400 py-8">✓ Sin autorizaciones pendientes</p>
              : (
                <div className="divide-y">
                  {pendingExpenses.map((e) => {
                    const meta = STATUS_META[e.status]; const busy = actionLoading === e.id;
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
                            style={{ backgroundColor: meta.color }}>{meta.label}</span>
                          <button onClick={() => applyExpenseAction(e.id, 'authorize')} disabled={busy}
                            className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
                            {busy ? '...' : '✓ Autorizar'}
                          </button>
                          <button onClick={() => setRejectTarget({ id: e.id, type: 'expense' })} disabled={busy}
                            className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
                            ✕ Rechazar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            }
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Todos los gastos ({expenses.length})</h2>
            <div className="divide-y">
              {expenses.length === 0
                ? <p className="text-center text-gray-400 py-8">Sin gastos</p>
                : expenses.map((e) => {
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
                          style={{ backgroundColor: meta.color }}>{meta.label}</span>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          </section>
        </>
      )}

      {/* ══ TAB COMPROBANTES ════════════════════════════════════════════════ */}
      {tab === 'receipts' && (
        <>
          {pendingReceipts.length > 0 && (
            <section className="rounded-2xl bg-white p-5 shadow-sm mb-6">
              <h2 className="mb-1 text-lg font-semibold">
                En revisión
                <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-sm text-orange-700 font-medium">
                  {pendingReceipts.length}
                </span>
              </h2>
              <div className="divide-y">
                {pendingReceipts.map((r) => {
                  const busy = actionLoading === r.id;
                  return (
                    <div key={r.id} className="py-4 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{r.provider_name ?? '(sin proveedor)'}</div>
                        <div className="text-sm text-gray-500">
                          {(r.uploader as any)?.full_name ?? r.uploaded_by}
                          {r.receipt_date && <span className="ml-2 text-gray-400">· {r.receipt_date}</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <DuplicateBadge status={r.duplicate_status} />
                          {r.ocr_confidence != null && r.ocr_confidence < 70 && (
                            <span className="text-xs text-orange-600 font-medium">⚠ OCR {r.ocr_confidence}%</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {r.total_amount != null && <span className="font-semibold text-lg">{money(r.total_amount)}</span>}
                        <button onClick={() => applyReceiptAction(r.id, 'approve')} disabled={busy}
                          className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
                          {busy ? '...' : '✓ Aprobar'}
                        </button>
                        <button onClick={() => setRejectTarget({ id: r.id, type: 'receipt' })} disabled={busy}
                          className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
                          ✕ Rechazar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Todos los comprobantes ({receipts.length})</h2>
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
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="py-3 font-medium max-w-[180px] truncate">{r.provider_name ?? '—'}</td>
                        <td className="py-3 text-xs text-gray-600">{(r.uploader as any)?.full_name ?? '—'}</td>
                        <td className="py-3 text-gray-500">{r.receipt_date ?? '—'}</td>
                        <td className="py-3 text-right font-semibold">{r.total_amount != null ? money(r.total_amount) : '—'}</td>
                        <td className="py-3">
                          {sMeta && (
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{ backgroundColor: sMeta.color + '20', color: sMeta.color }}>
                              {sMeta.label}
                            </span>
                          )}
                        </td>
                        <td className="py-3"><DuplicateBadge status={r.duplicate_status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {receipts.length === 0 && <p className="text-center text-gray-400 py-8">Sin comprobantes</p>}
            </div>
          </section>
        </>
      )}

      {/* ══ TAB RELACIONES ══════════════════════════════════════════════════ */}
      {tab === 'batches' && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold">
            Relaciones contables
            {openBatches.length > 0 && (
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-sm text-blue-700 font-medium">
                {openBatches.length} abiertas
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Agrupa comprobantes por período para exportarlos a contabilidad
          </p>
          {batches.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Sin relaciones. Crea la primera desde la app móvil.</p>
          ) : (
            <div className="divide-y">
              {batches.map((b) => {
                const meta = BATCH_STATUS_META[b.status as keyof typeof BATCH_STATUS_META];
                const busy = actionLoading === b.id;
                if (!meta) return null;
                return (
                  <div key={b.id} className="py-4 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-gray-900">{b.name}</div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        {b.period_start ? `${b.period_start} — ${b.period_end ?? '…'}` : 'Sin período'}
                        <span className="ml-3">{b.receipt_count ?? 0} comprobantes</span>
                        {(b.total_amount ?? 0) > 0 && (
                          <span className="ml-3 font-medium text-gray-700">{money(b.total_amount!)}</span>
                        )}
                      </div>
                      {b.notes && <div className="text-xs text-gray-400 italic mt-1">{b.notes}</div>}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="rounded-full px-3 py-1 text-xs font-medium"
                        style={{ backgroundColor: meta.color + '20', color: meta.color }}>
                        {meta.icon} {meta.label}
                      </span>
                      {canCloseBatch(b.status as any, b.receipt_count ?? 0) && (
                        <button onClick={() => closeBatch(b.id)} disabled={busy}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
                          {busy ? '...' : '✓ Cerrar'}
                        </button>
                      )}
                      {canExportBatch(b.status as any) && (
                        <button onClick={() => { setExportBatchId(b.id); setTab('export'); }}
                          className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white">
                          📤 Exportar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ══ TAB EXPORTAR ════════════════════════════════════════════════════ */}
      {tab === 'export' && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold">Exportación contable</h2>
          <p className="text-sm text-gray-400 mb-6">
            Genera el archivo listo para importar en tu sistema de contabilidad
          </p>

          {/* Selección de formato */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Formato de salida</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(EXPORT_FORMAT_META) as ExportFormat[]).map((fmt) => {
                const m = EXPORT_FORMAT_META[fmt];
                return (
                  <button key={fmt} onClick={() => setExportFormat(fmt)}
                    className={`text-left rounded-xl border-2 p-4 transition-all
                      ${exportFormat === fmt ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="font-semibold text-gray-900 flex items-center gap-2">
                      <span>{m.icon}</span> {m.label}
                      <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono">.{m.ext}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{m.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Alcance */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Alcance</label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Relación (opcional)</label>
                <select value={exportBatchId} onChange={(e) => setExportBatchId(e.target.value)}
                  className="w-full border rounded-xl p-2.5 text-sm text-gray-900 bg-white">
                  <option value="">— Usar rango de fechas —</option>
                  {exportableBatches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.receipt_count} comprobantes)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fecha inicio</label>
                <input type="date" value={exportDateFrom} onChange={(e) => setExportDateFrom(e.target.value)}
                  disabled={!!exportBatchId}
                  className="w-full border rounded-xl p-2.5 text-sm disabled:opacity-40 bg-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fecha fin</label>
                <input type="date" value={exportDateTo} onChange={(e) => setExportDateTo(e.target.value)}
                  disabled={!!exportBatchId}
                  className="w-full border rounded-xl p-2.5 text-sm disabled:opacity-40 bg-white" />
              </div>
            </div>
          </div>

          <button onClick={triggerExport} disabled={exporting || !companyId}
            className="w-full rounded-xl bg-blue-600 py-3 text-white font-semibold text-base
              disabled:opacity-50 hover:bg-blue-700 transition-colors">
            {exporting ? '⏳ Generando...' : `📥 Descargar ${EXPORT_FORMAT_META[exportFormat].label}`}
          </button>

          {exportableBatches.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Relaciones disponibles para exportar</p>
              <div className="space-y-2">
                {exportableBatches.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                    <div>
                      <span className="font-medium text-sm">{b.name}</span>
                      <span className="ml-3 text-xs text-gray-400">
                        {b.receipt_count} comprobantes · {money(b.total_amount ?? 0)}
                      </span>
                    </div>
                    <button onClick={() => setExportBatchId(b.id)}
                      className={`text-xs px-3 py-1 rounded-full font-semibold
                        ${exportBatchId === b.id ? 'bg-blue-600 text-white' : 'bg-white border text-blue-600 hover:bg-blue-50'}`}>
                      {exportBatchId === b.id ? '✓ Seleccionada' : 'Usar esta'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <footer className="mt-8 text-center text-sm text-gray-400">
        GastoCheck · datos en tiempo real desde Supabase
      </footer>
    </main>
  );
}
