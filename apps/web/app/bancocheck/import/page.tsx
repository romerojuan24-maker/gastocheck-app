'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ImportCSV() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [bankAccountId, setBankAccountId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);

  // Load accounts on mount
  useState(() => {
    fetchAccounts();
  });

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/bancocheck/accounts');
      if (res.ok) setAccounts(await res.json());
    } catch (err) {
      console.error('Error loading accounts:', err);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !bankAccountId) {
      alert('Selecciona archivo y cuenta');
      return;
    }

    setLoading(true);
    try {
      const text = await file.text();
      const res = await fetch('/api/bancocheck/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          bankAccountId,
          csvData: text,
          tenantId: localStorage.getItem('tenantId') || '',
        }),
      });

      if (res.ok) {
        setResult(await res.json());
      } else {
        alert('Error al importar');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold">Importar Movimientos</h1>

      {!result ? (
        <form onSubmit={handleImport} className="space-y-4">
          {/* Cuenta */}
          <div>
            <label className="block text-sm font-medium mb-2">Cuenta Bancaria</label>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              required
            >
              <option value="">-- Selecciona --</option>
              {accounts.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.bankName})
                </option>
              ))}
            </select>
          </div>

          {/* File */}
          <div>
            <label className="block text-sm font-medium mb-2">Archivo CSV</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Esperado: fecha, descripción, débito, crédito, referencia
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Importando...' : 'Importar'}
          </button>
        </form>
      ) : (
        <div className="bg-green-50 p-4 rounded space-y-2">
          <h2 className="font-bold text-green-900">✓ Importación completada</h2>
          <p className="text-sm">Total: {result.totalRows}</p>
          <p className="text-sm">Importados: {result.importedRows}</p>
          <p className="text-sm">Duplicados: {result.duplicateRows}</p>
          <p className="text-sm">Errores: {result.errorRows}</p>

          <button
            onClick={() => router.push('/bancocheck')}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded mt-4"
          >
            Ir al Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
