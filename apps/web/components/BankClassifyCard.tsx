'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { BankTransaction } from '@gastocheck/shared';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

interface Props {
  txn:         BankTransaction;
  onClassified: () => void;
}

const CATEGORY_OPTIONS = [
  { value: 'expense',    label: '💸 Gasto',       color: 'bg-red-50 border-red-200' },
  { value: 'collection', label: '💰 Cobranza',    color: 'bg-emerald-50 border-emerald-200' },
  { value: 'advance',    label: '🎁 Anticipo',    color: 'bg-blue-50 border-blue-200' },
  { value: 'supplier',   label: '🤝 Proveedor',   color: 'bg-purple-50 border-purple-200' },
  { value: 'client',     label: '👤 Cliente',     color: 'bg-orange-50 border-orange-200' },
  { value: 'transfer',   label: '↔️ Transferencia', color: 'bg-slate-50 border-slate-200' },
  { value: 'personal',   label: '🚗 Personal',    color: 'bg-amber-50 border-amber-200' },
  { value: 'ignore',     label: '🗑 Ignorar',     color: 'bg-gray-50 border-gray-200' },
];

export default function BankClassifyCard({ txn, onClassified }: Props) {
  const [classifying, setClassifying] = useState(false);

  async function classify(category: string) {
    setClassifying(true);
    try {
      await supabase
        .from('bank_transactions')
        .update({ status: 'explained', category })
        .eq('id', txn.id);
      onClassified();
    } finally {
      setClassifying(false);
    }
  }

  const isDeposit = txn.amount >= 0;
  const amountColor = isDeposit ? 'text-emerald-700' : 'text-red-700';

  return (
    <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 mb-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900">{txn.description}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {txn.transaction_date} {txn.reference && `· ${txn.reference}`}
          </p>
        </div>
        <p className={`text-lg font-black shrink-0 ${amountColor}`}>
          {isDeposit ? '+' : ''}{money(Math.abs(txn.amount))}
        </p>
      </div>

      {/* Categorías */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {CATEGORY_OPTIONS.map(cat => (
          <button
            key={cat.value}
            onClick={() => classify(cat.value)}
            disabled={classifying}
            className={`py-3 px-2 rounded-xl border-2 text-xs font-bold text-center transition-all hover:shadow-md disabled:opacity-50 ${cat.color}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Sugerencias de matching (futuro) */}
      {txn.amount > 100 && isDeposit && (
        <p className="text-xs text-slate-400 mt-3">💡 Parece depósito — probablemente cobranza o anticipo</p>
      )}
    </div>
  );
}
