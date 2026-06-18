'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BankClassifyCard from '../../../components/BankClassifyCard';
import { supabase, getSessionUser } from '../../../lib/supabase';
import type { BankAccount, BankTransaction } from '@gastocheck/shared';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

export default function BancoCheckPage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [tab, setTab] = useState<'new' | 'explained' | 'pending'>('new');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (cid: string) => {
    setLoading(true);
    try {
      const [accRes, txnRes] = await Promise.all([
        supabase.from('bank_accounts')
          .select('*').eq('company_id', cid).eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase.from('bank_transactions')
          .select('*').eq('company_id', cid)
          .order('transaction_date', { ascending: false })
          .limit(100),
      ]);
      setAccounts((accRes.data ?? []) as BankAccount[]);
      setTransactions((txnRes.data ?? []) as BankTransaction[]);
      if (accRes.data?.length) setSelectedAccount(accRes.data[0].id);
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

  const filtered = transactions.filter(t => {
    if (selectedAccount && t.bank_account_id !== selectedAccount) return false;
    if (tab === 'new') return t.status === 'new';
    if (tab === 'explained') return t.status === 'explained';
    if (tab === 'pending') return ['pending_document', 'pending_invoice', 'unidentified'].includes(t.status);
    return true;
  });

  const selectedAccData = accounts.find(a => a.id === selectedAccount);
  const totalBalance = accounts.reduce((s, a) => s + (a.current_balance ?? 0), 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">🏦 BancoCheck</h1>
        <p className="text-slate-500 text-sm mt-1">Explícame mi banco</p>
      </div>

      {/* Saldo total */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 mb-6">
        <p className="text-xs text-slate-400 mb-1">Saldo total en bancos</p>
        <p className="text-3xl font-black">{money(totalBalance)}</p>
        <p className="text-xs text-slate-400 mt-1">{accounts.length} cuenta(s) activa(s)</p>
      </div>

      {/* Selector de cuenta */}
      {accounts.length > 1 && (
        <div className="mb-6">
          <label className="text-xs font-semibold text-slate-600 block mb-2">Seleccionar cuenta</label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {accounts.map(a => (
              <button
                key={a.id}
                onClick={() => setSelectedAccount(a.id)}
                className={`shrink-0 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                  selectedAccount === a.id
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {a.name}
                <br />
                <span className="text-xs font-normal">{money(a.current_balance ?? 0)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => router.push('/bancocheck/importar')}
          className="px-4 py-2.5 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600"
        >
          📥 Importar CSV
        </button>
        <button
          className="px-4 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200"
          disabled
        >
          📊 Exportar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {[
          { key: 'new',       label: `Sin clasificar (${transactions.filter(t => t.status === 'new').length})` },
          { key: 'explained', label: `Explicados (${transactions.filter(t => t.status === 'explained').length})` },
          { key: 'pending',   label: `Pendientes (${transactions.filter(t => ['pending_document','pending_invoice'].includes(t.status)).length})` },
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

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-2">✅</p>
          <p className="text-slate-500 font-medium">
            {tab === 'new' ? 'Todo clasificado' : tab === 'explained' ? 'Sin movimientos explicados' : 'Sin pendientes'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tab === 'new' ? (
            // Mostrar cards de clasificación para movimientos sin clasificar
            filtered.map(t => (
              <BankClassifyCard
                key={t.id}
                txn={t}
                onClassified={() => {
                  setTransactions(p => p.filter(x => x.id !== t.id));
                }}
              />
            ))
          ) : (
            // Mostrar lista simple para explicados y pendientes
            filtered.map(t => {
              const statusMeta: Record<string, { label: string; color: string }> = {
                explained:        { label: 'Explicado',        color: 'bg-emerald-100 text-emerald-700' },
                pending_document: { label: 'Falta comprobante', color: 'bg-amber-100 text-amber-700' },
                pending_invoice:  { label: 'Falta factura',    color: 'bg-amber-100 text-amber-700' },
                unidentified:     { label: 'Sin identificar',  color: 'bg-red-100 text-red-700' },
                personal:         { label: 'Personal',         color: 'bg-slate-100 text-slate-700' },
                ignored:          { label: 'Ignorado',         color: 'bg-gray-100 text-gray-700' },
              };
              const meta = statusMeta[t.status] ?? { label: t.status, color: 'bg-slate-100 text-slate-700' };
              const isDeposit = t.amount >= 0;
              return (
                <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{t.description}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {t.transaction_date} {t.reference && `· ${t.reference}`}
                    </p>
                    {t.category && (
                      <p className="text-xs text-slate-400 mt-1">
                        📂 {t.category === 'expense' ? 'Gasto' : t.category === 'collection' ? 'Cobranza' : t.category}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0 ml-4">
                    <p className={`text-base font-black ${isDeposit ? 'text-emerald-700' : 'text-red-700'}`}>
                      {isDeposit ? '+' : ''}{money(Math.abs(t.amount))}
                    </p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.color}`}>
                      {meta.label}
                    </span>
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
