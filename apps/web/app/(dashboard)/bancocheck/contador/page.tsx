'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, getSessionUser } from '../../../../lib/supabase';
import type { BankTransaction } from '@/lib/bancocheck-types';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

export default function ContadorBancoCheckPage() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [totalBalance, setTotalBalance] = useState(0);
  const [explained, setExplained] = useState<BankTransaction[]>([]);
  const [withoutCFDI, setWithoutCFDI] = useState<BankTransaction[]>([]);
  const [withoutInvoice, setWithoutInvoice] = useState<BankTransaction[]>([]);
  const [unidentified, setUnidentified] = useState<BankTransaction[]>([]);
  const [personal, setPersonal] = useState<BankTransaction[]>([]);

  const load = useCallback(async (cid: string) => {
    setLoading(true);
    try {
      // Saldo total
      const { data: accData } = await supabase
        .from('bank_accounts')
        .select('current_balance').eq('company_id', cid).eq('is_active', true);
      const balance = (accData ?? []).reduce((s, a) => s + (a.current_balance ?? 0), 0);
      setTotalBalance(balance);

      // Transacciones por estado — SOLO estados que el sistema realmente escribe:
      // 'new' (importado sin clasificar), 'matched' (conciliado auto), 'explained', 'personal'.
      // 'pending_document'/'pending_invoice'/'unidentified' no los produce nadie.
      const [expRes, noCFDIRes, noInvoiceRes, unidRes, perRes] = await Promise.all([
        supabase.from('bank_transactions')
          .select('*').eq('company_id', cid).eq('status', 'explained')
          .order('transaction_date', { ascending: false }).limit(50),

        supabase.from('bank_transactions')
          .select('*').eq('company_id', cid).eq('status', 'new')
          .order('transaction_date', { ascending: false }).limit(50),

        supabase.from('bank_transactions')
          .select('*').eq('company_id', cid).eq('status', 'matched')
          .order('transaction_date', { ascending: false }).limit(50),

        supabase.from('bank_transactions')
          .select('*').eq('company_id', cid).eq('status', 'personal')
          .order('transaction_date', { ascending: false }).limit(50),

        supabase.from('bank_transactions')
          .select('*').eq('company_id', cid).eq('is_personal', true)
          .order('transaction_date', { ascending: false }).limit(50),
      ]);

      setExplained((expRes.data ?? []) as BankTransaction[]);
      setWithoutCFDI((noCFDIRes.data ?? []) as BankTransaction[]);
      setWithoutInvoice((noInvoiceRes.data ?? []) as BankTransaction[]);
      setUnidentified((unidRes.data ?? []) as BankTransaction[]);
      setPersonal((perRes.data ?? []) as BankTransaction[]);
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

  const sections = [
    { title: 'Explicados',             count: explained.length,      data: explained,      color: 'emerald' },
    { title: 'Sin clasificar',         count: withoutCFDI.length,    data: withoutCFDI,    color: 'amber' },
    { title: 'Conciliados (auto)',     count: withoutInvoice.length, data: withoutInvoice, color: 'emerald' },
    { title: 'Marcados personales',    count: unidentified.length,   data: unidentified,   color: 'slate' },
    { title: 'Movimientos personales', count: personal.length,       data: personal,       color: 'slate' },
  ];

  async function exportToCSV() {
    const allTxns = [...explained, ...withoutCFDI, ...withoutInvoice, ...unidentified, ...personal];
    const csv = [
      ['Fecha', 'Descripción', 'Referencia', 'Monto', 'Saldo después', 'Estado', 'Categoría'].join(','),
      ...allTxns.map(t =>
        [
          t.transaction_date,
          `"${t.description}"`,
          t.reference ?? '',
          t.amount,
          t.balance_after ?? '',
          t.status,
          t.category ?? '',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `bancocheck-${new Date().toISOString().slice(0, 10)}.csv`);
    link.click();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">🧮 Vista Contador</h1>
        <p className="text-slate-500 text-sm mt-1">Conciliación bancaria para auditoría</p>
      </div>

      {/* KPI */}
      <div className="bg-white rounded-2xl p-6 mb-6 border border-slate-200">
        <p className="text-xs font-semibold text-slate-600 mb-1">SALDO TOTAL CONCILIADO</p>
        <p className="text-4xl font-black text-slate-900 mb-3">{money(totalBalance)}</p>
        <button
          onClick={exportToCSV}
          className="text-sm font-bold text-blue-600 hover:underline"
        >
          📥 Exportar CSV completo
        </button>
      </div>

      {/* Sections */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map(sec => {
            const colorMap = {
              emerald: 'border-l-emerald-500 bg-emerald-50',
              amber:   'border-l-amber-500 bg-amber-50',
              red:     'border-l-red-500 bg-red-50',
              slate:   'border-l-slate-300 bg-white',
            };
            const textMap = {
              emerald: 'text-emerald-700',
              amber:   'text-amber-700',
              red:     'text-red-700',
              slate:   'text-slate-600',
            };
            return (
              <div key={sec.title}>
                <div className={`rounded-xl border-l-4 p-4 ${colorMap[sec.color as keyof typeof colorMap]}`}>
                  <h2 className={`text-sm font-bold ${textMap[sec.color as keyof typeof textMap]} mb-3`}>
                    {sec.title} ({sec.count})
                  </h2>
                  {sec.count === 0 ? (
                    <p className="text-xs text-slate-400">Sin registros</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {sec.data.map(t => {
                        const isDeposit = t.amount >= 0;
                        return (
                          <div key={t.id} className="flex items-center justify-between text-sm bg-white rounded-lg p-2 border border-slate-100">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{t.description}</p>
                              <p className="text-xs text-slate-500">{t.transaction_date}</p>
                            </div>
                            <p className={`font-bold shrink-0 ml-2 ${isDeposit ? 'text-emerald-700' : 'text-red-700'}`}>
                              {isDeposit ? '+' : ''}{money(Math.abs(t.amount))}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
