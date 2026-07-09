'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function TransactionsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const status = searchParams.get('status');

  useEffect(() => {
    fetchTransactions();
  }, [status]);

  const fetchTransactions = async () => {
    try {
      const url = new URL('/api/bancocheck/transactions', window.location.origin);
      if (status) url.searchParams.set('status', status);
      const res = await fetch(url);
      if (res.ok) setTransactions(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const handleClassify = (id: string) => {
    router.push(`/bancocheck/transactions/${id}`);
  };

  if (loading) return <div className="p-8">Cargando transacciones...</div>;

  return (
    <div className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transacciones {status ? `(${status})` : ''}</h1>
        <button onClick={() => router.back()} className="text-blue-600">← Volver</button>
      </div>

      {transactions.length === 0 ? (
        <p className="text-gray-500">Sin transacciones</p>
      ) : (
        <div className="space-y-2">
          {transactions.map((t: any) => (
            <div
              key={t.id}
              onClick={() => handleClassify(t.id)}
              className="p-4 bg-white border rounded-lg cursor-pointer hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium">{t.description}</p>
                  <p className="text-sm text-gray-500">{new Date(t.date).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${t.credit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {t.credit > 0 ? '+' : '-'}${Math.max(parseFloat(t.debit), parseFloat(t.credit))}
                  </p>
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded">{t.status}</span>
                </div>
              </div>
              {t.matchedEntityType && (
                <p className="text-sm text-green-600 mt-2">✓ Relacionado con {t.matchedEntityType}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
