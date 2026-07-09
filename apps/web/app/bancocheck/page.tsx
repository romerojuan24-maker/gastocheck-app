'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BancocheckDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/bancocheck/dashboard');
      if (res.ok) setStats(await res.json());
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Cargando...</div>;

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">BancoCheck</h1>
        <button
          onClick={() => router.push('/bancocheck/import')}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          📤 Importar CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Total" value={stats?.totalTransactions || 0} />
        <Card title="Sin explicar" value={stats?.unexplainedCount || 0} highlight />
        <Card title="Explicados" value={`${stats?.explainedPercentage || 0}%`} />
        <Card title="Personales" value={stats?.personalCount || 0} />
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Button label="Ver todos" onClick={() => router.push('/bancocheck/transactions')} />
        <Button label="Sin explicar" onClick={() => router.push('/bancocheck/transactions?status=NEW')} />
        <Button label="Falta factura" onClick={() => router.push('/bancocheck/transactions?status=NEEDS_INVOICE')} />
        <Button label="Personales" onClick={() => router.push('/bancocheck/transactions?status=PERSONAL')} />
      </div>

      {/* Últimos movimientos */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-bold mb-4">Últimos movimientos</h2>
        <div className="space-y-2">
          {stats?.recentTransactions?.slice(0, 5).map((t: any) => (
            <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div className="flex-1">
                <p className="font-medium">{t.description}</p>
                <p className="text-sm text-gray-500">{new Date(t.date).toLocaleDateString('es-MX')}</p>
              </div>
              <div className="text-right">
                <p className={`font-bold ${t.credit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {t.credit > 0 ? '+' : '-'}${Math.max(t.debit, t.credit)}
                </p>
                <p className={`text-xs ${t.status === 'EXPLAINED' ? 'text-green-600' : 'text-amber-600'}`}>
                  {t.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Card({ title, value, highlight }: any) {
  return (
    <div className={`p-4 rounded-lg border ${highlight ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
      <p className="text-sm text-gray-600">{title}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-red-600' : ''}`}>{value}</p>
    </div>
  );
}

function Button({ label, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-blue-100 text-blue-700 px-3 py-2 rounded text-sm font-medium hover:bg-blue-200"
    >
      {label}
    </button>
  );
}
