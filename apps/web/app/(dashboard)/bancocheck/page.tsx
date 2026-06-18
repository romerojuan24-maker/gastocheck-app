'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSessionUser } from '../../../lib/supabase';
import { BANK_TRANSACTION_STATUS_META } from '@gastocheck/shared';
import type { BankAccount, BankTransaction } from '@gastocheck/shared';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export default function BancoCheckPage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [tab, setTab] = useState<'new' | 'explained' | 'pending'>('new');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (cid: string) => {
    setLoading(true);
    try {
      const [accRes, txnRes] = await Promise.all([
        supabase.from('bank_accounts').select('*').eq('company_id', cid).eq('is_active', true),
        supabase.from('bank_transactions').select('*').eq('company_id', cid).order('transaction_date', { ascending: false }).limit(100),
      ]);
      const accounts_list = (accRes.data ?? []) as BankAccount[];
      setAccounts(accounts_list);
      if (accounts_list.length > 0 && !selectedAccountId) setSelectedAccountId(accounts_list[0].id);
      setTransactions((txnRes.data ?? []) as BankTransaction[]);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    getSessionUser().then(u => { if (u) { setCompanyId(u.company_id); load(u.company_id); } });
  }, [load]);

  const filtered = transactions.filter(t => {
    if (selectedAccountId && t.bank_account_id !== selectedAccountId) return false;
    if (tab === 'new') return t.status === 'new';
    if (tab === 'explained') return t.status === 'explained';
    if (tab === 'pending') return t.status === 'pending';
    return true;
  });

  const totalBalance = accounts.reduce((s, a) => s + (a.current_balance ?? 0), 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">🏦 BancoCheck</h1>
        <p className="text-slate-500 text-sm mt-1">Reconciliación bancaria inteligente</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-600 mb-1">Saldo total</p>
          <p className="text-2xl font-black text-slate-900">{money(totalBalance)}</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
          <p className="text-xs text-blue-600 mb-1">Sin clasificar</p>
          <p className="text-2xl font-black text-blue-700">{filtered.filter(t => t.status === 'new').length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-600 mb-1">Total importadas</p>
          <p className="text-2xl font-black text-slate-900">{transactions.length}</p>
        </div>
      </div>

      <div className="mb-6 flex gap-2 flex-wrap">
        {accounts.map(acc => (
          <button key={acc.id} onClick={() => setSelectedAccountId(acc.id)}
            className={`px-4 py-2 rounded-lg font-bold text-sm ${selectedAccountId === acc.id ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200'}`}>
            {acc.name}
          </button>
        ))}
      </div>

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {['new', 'explained', 'pending'].map(t => (
          <button key={t} onClick={() => setTab(t as any)}
            className={`px-3 py-3 text-sm font-bold ${tab === t ? 'text-emerald-600 border-b-2 border-emerald-500' : 'text-slate-500'}`}>
            {t === 'new' ? 'Sin clasificar' : t === 'explained' ? 'Clasificadas' : 'Pendientes'}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-16">Cargando...</div> : filtered.length === 0 ? <div className="text-center py-12 bg-white rounded-xl">Sin transacciones</div> : (
        <div className="space-y-3">
          {filtered.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4 flex justify-between">
              <div><p className="font-bold">{t.description || 'Sin descripción'}</p><p className="text-xs text-slate-500">{new Date(t.transaction_date).toLocaleDateString('es-MX')}</p></div>
              <p className={`font-black ${(t.amount ?? 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>{money(Math.abs(t.amount ?? 0))}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
