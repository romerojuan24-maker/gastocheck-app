'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSessionUser } from '../../../lib/supabase';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

interface PendingAdvance {
  id: string; folio: string; amount: number; concept: string; spender: string; created_at: string;
}
interface PendingReceipt {
  id: string; folio: string; amount: number; vendor: string; spender: string; sat_fail: boolean; created_at: string;
}
interface OverdueInvoice {
  id: string; folio: string; amount: number; client: string; days_overdue: number;
}
interface BankUnmatched {
  id: string; transaction_date: string; description: string; amount: number;
}
interface CfdiProblem {
  id: string; uuid_cfdi: string; status: string; total: number | null; rfc_emisor: string;
}

export default function PendientesPage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [advances,  setAdvances]  = useState<PendingAdvance[]>([]);
  const [receipts,  setReceipts]  = useState<PendingReceipt[]>([]);
  const [overdue,   setOverdue]   = useState<OverdueInvoice[]>([]);
  const [bank,      setBank]      = useState<BankUnmatched[]>([]);
  const [cfdi,      setCfdi]      = useState<CfdiProblem[]>([]);
  const [tab, setTab] = useState<'anticipos' | 'comprobantes' | 'cobranza' | 'banco' | 'cfdi'>('anticipos');

  const load = useCallback(async (cid: string) => {
    setLoading(true);
    try {
      const [advRes, recRes, cobRes, bankRes, cfdiRes] = await Promise.all([
        supabase.from('advances')
          .select('id, folio, amount, concept, profiles:user_id(full_name)')
          .eq('company_id', cid).eq('status', 'requested')
          .order('created_at', { ascending: false }).limit(30),

        supabase.from('receipts')
          .select('id, folio, amount, vendor_name, sat_validation_status, profiles:user_id(full_name)')
          .eq('company_id', cid).eq('status', 'submitted')
          .order('created_at', { ascending: false }).limit(30),

        supabase.from('cobra_invoices')
          .select('id, folio, amount, days_overdue, cobra_clients:client_id(name)')
          .eq('company_id', cid).eq('status', 'overdue')
          .order('days_overdue', { ascending: false }).limit(30),

        supabase.from('bank_transactions')
          .select('id, transaction_date, description, amount')
          .eq('company_id', cid).in('status', ['new', 'unidentified'])
          .order('transaction_date', { ascending: false }).limit(30),

        supabase.from('cfdi_documents')
          .select('id, uuid_cfdi, status, total, rfc_emisor')
          .eq('company_id', cid).in('status', ['cancelado','not_found','pending_complement'])
          .order('created_at', { ascending: false }).limit(30),
      ]);

      setAdvances((advRes.data ?? []).map((r: any) => ({
        id: r.id, folio: r.folio, amount: r.amount,
        concept: r.concept, spender: r.profiles?.full_name ?? '—',
        created_at: r.created_at,
      })));
      setReceipts((recRes.data ?? []).map((r: any) => ({
        id: r.id, folio: r.folio, amount: r.amount,
        vendor: r.vendor_name ?? '—', spender: r.profiles?.full_name ?? '—',
        sat_fail: r.sat_validation_status === 'cancelled',
        created_at: r.created_at,
      })));
      setOverdue((cobRes.data ?? []).map((r: any) => ({
        id: r.id, folio: r.folio, amount: r.amount,
        client: r.cobra_clients?.name ?? '—', days_overdue: r.days_overdue,
      })));
      setBank((bankRes.data ?? []) as BankUnmatched[]);
      setCfdi((cfdiRes.data ?? []) as CfdiProblem[]);
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

  const TABS = [
    { key: 'anticipos',    label: `Anticipos (${advances.length})` },
    { key: 'comprobantes', label: `Comprobantes (${receipts.length})` },
    { key: 'cobranza',     label: `Cobranza vencida (${overdue.length})` },
    { key: 'banco',        label: `Banco sin clasificar (${bank.length})` },
    { key: 'cfdi',         label: `CFDI problema (${cfdi.length})` },
  ] as const;

  async function approveAdvance(id: string) {
    await supabase.from('advances').update({ status: 'approved' }).eq('id', id);
    setAdvances(p => p.filter(a => a.id !== id));
  }
  async function rejectAdvance(id: string) {
    await supabase.from('advances').update({ status: 'rejected' }).eq('id', id);
    setAdvances(p => p.filter(a => a.id !== id));
  }
  async function approveReceipt(id: string) {
    await supabase.from('receipts').update({ status: 'approved' }).eq('id', id);
    setReceipts(p => p.filter(r => r.id !== id));
  }
  async function classifyBank(id: string, category: string) {
    await supabase.from('bank_transactions').update({ status: 'explained', category }).eq('id', id);
    setBank(p => p.filter(b => b.id !== id));
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Pendientes</h1>
        <p className="text-slate-500 text-sm mt-1">Revisa, autoriza y corrige</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              tab === t.key
                ? 'bg-emerald-500 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* ANTICIPOS */}
          {tab === 'anticipos' && (
            <div className="space-y-3">
              {advances.length === 0 && <Empty label="Sin anticipos pendientes" icon="✅" />}
              {advances.map(a => (
                <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{a.folio} · {a.spender}</p>
                    <p className="text-xs text-slate-500 truncate">{a.concept}</p>
                  </div>
                  <p className="text-base font-black text-slate-900 shrink-0">{money(a.amount)}</p>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => approveAdvance(a.id)}
                      className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600">
                      Aprobar
                    </button>
                    <button onClick={() => rejectAdvance(a.id)}
                      className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-red-50 hover:text-red-600">
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* COMPROBANTES */}
          {tab === 'comprobantes' && (
            <div className="space-y-3">
              {receipts.length === 0 && <Empty label="Sin comprobantes por revisar" icon="✅" />}
              {receipts.map(r => (
                <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{r.folio} · {r.spender}</p>
                      {r.sat_fail && (
                        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold">
                          CFDI cancelado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{r.vendor}</p>
                  </div>
                  <p className="text-base font-black text-slate-900 shrink-0">{money(r.amount)}</p>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => approveReceipt(r.id)}
                      className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600">
                      Aprobar
                    </button>
                    <button onClick={() => router.push(`/gastocheck/comprobantes/${r.id}`)}
                      className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200">
                      Ver
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* COBRANZA */}
          {tab === 'cobranza' && (
            <div className="space-y-3">
              {overdue.length === 0 && <Empty label="Sin facturas vencidas" icon="🎉" />}
              {overdue.map(o => (
                <div key={o.id} className="bg-white border border-red-200 rounded-xl p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{o.folio} · {o.client}</p>
                    <p className="text-xs text-red-600">{o.days_overdue} días vencido</p>
                  </div>
                  <p className="text-base font-black text-red-700 shrink-0">{money(o.amount)}</p>
                  <button onClick={() => router.push(`/cobracheck/facturas?resaltar=${o.id}`)}
                    className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 shrink-0">
                    Cobrar
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* BANCO */}
          {tab === 'banco' && (
            <div className="space-y-3">
              {bank.length === 0 && <Empty label="Banco al día" icon="✅" />}
              {bank.map(b => (
                <div key={b.id} className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{b.description}</p>
                      <p className="text-xs text-slate-500">{b.transaction_date}</p>
                    </div>
                    <p className={`text-base font-black shrink-0 ${b.amount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {money(Math.abs(b.amount))}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['expense','collection','advance','supplier','personal','ignore'].map(cat => (
                      <button key={cat} onClick={() => classifyBank(b.id, cat)}
                        className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-lg hover:bg-emerald-100 hover:text-emerald-700 capitalize">
                        {cat === 'expense' ? 'Gasto' : cat === 'collection' ? 'Cobranza' :
                         cat === 'advance' ? 'Anticipo' : cat === 'supplier' ? 'Proveedor' :
                         cat === 'personal' ? 'Personal' : 'Ignorar'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CFDI */}
          {tab === 'cfdi' && (
            <div className="space-y-3">
              {cfdi.length === 0 && <Empty label="Sin problemas en CFDI" icon="✅" />}
              {cfdi.map(c => (
                <div key={c.id} className="bg-white border border-amber-200 rounded-xl p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{c.uuid_cfdi}</p>
                    <p className="text-xs text-slate-500">{c.rfc_emisor}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    c.status === 'cancelado' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {c.status === 'cancelado' ? 'Cancelado' : c.status === 'not_found' ? 'No encontrado' : 'Falta complemento'}
                  </span>
                  {c.total && <p className="text-sm font-bold text-slate-900 shrink-0">{money(c.total)}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Empty({ label, icon }: { label: string; icon: string }) {
  return (
    <div className="text-center py-16">
      <p className="text-4xl mb-3">{icon}</p>
      <p className="text-slate-500 font-medium">{label}</p>
    </div>
  );
}
