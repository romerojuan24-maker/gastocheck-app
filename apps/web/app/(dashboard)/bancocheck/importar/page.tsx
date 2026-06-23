'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSessionUser } from '../../../../lib/supabase';
import { parseBankCSVRow } from '@gastocheck/shared';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

interface ParsedRow {
  transaction_date: string;
  description:      string;
  amount:           number;
  reference?:       string;
  balance_after?:   number;
}

export default function BancoCheckImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = useCallback(async (cid: string) => {
    const { data } = await supabase
      .from('bank_accounts')
      .select('id, name')
      .eq('company_id', cid)
      .eq('is_active', true);
    setAccounts(data ?? []);
    if (data?.length) setSelectedAccount(data[0].id);
  }, []);

  useEffect(() => {
    getSessionUser().then(u => {
      if (!u) return;
      setCompanyId(u.company_id);
      loadAccounts(u.company_id);
    });
  }, [loadAccounts]);

  function parseCSV(text: string): ParsedRow[] {
    const lines = text.trim().split('\n');
    if (lines.length < 2) throw new Error('CSV vacío o sin encabezados');

    const headerLine = lines[0];
    const headers = headerLine.split(',').map(h => h.trim().toLowerCase());

    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cells = line.split(',').map(c => c.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = cells[idx] ?? ''; });

      const parsed = parseBankCSVRow(row);
      if (parsed.transaction_date && parsed.amount !== 0) {
        rows.push({
          transaction_date: parsed.transaction_date,
          description:      parsed.description ?? 'Sin descripción',
          amount:           parsed.amount ?? 0,
          reference:        parsed.reference ?? undefined,
          balance_after:    parsed.balance_after ?? undefined,
        });
      }
    }
    return rows;
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setLoading(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) throw new Error('No se encontraron transacciones válidas');
      setParsed(rows);
    } catch (err: any) {
      setError(err.message ?? 'Error al parsear CSV');
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!selectedAccount || parsed.length === 0) return;
    setLoading(true);
    try {
      const batchId = crypto.randomUUID();
      const rows = parsed.map(p => ({
        company_id:      companyId,
        bank_account_id: selectedAccount,
        transaction_date: p.transaction_date,
        description:     p.description,
        reference:       p.reference,
        amount:          p.amount,
        balance_after:   p.balance_after,
        status:          'new' as const,
        imported_from:   'csv' as const,
        import_batch_id: batchId,
      }));

      const { error: err } = await supabase
        .from('bank_transactions')
        .insert(rows);

      if (err) throw err;

      setParsed([]);
      if (fileRef.current) fileRef.current.value = '';

      router.push('/bancocheck?imported=true');
    } catch (err: any) {
      setError(err.message ?? 'Error al importar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">📥 Importar movimientos</h1>
        <p className="text-slate-500 text-sm mt-1">Carga un CSV desde tu banco</p>
      </div>

      {/* Upload */}
      <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center mb-6">
        <p className="text-3xl mb-2">📄</p>
        <p className="text-sm font-semibold text-slate-900 mb-1">Arrastra tu CSV aquí</p>
        <p className="text-xs text-slate-500 mb-4">o haz clic para seleccionar</p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="px-4 py-2 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600"
        >
          Seleccionar archivo
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-bold text-red-700">{error}</p>
        </div>
      )}

      {/* Seleccionar cuenta */}
      {parsed.length > 0 && (
        <div className="mb-6">
          <label className="text-xs font-semibold text-slate-600 block mb-2">Cuenta destino</label>
          <select
            value={selectedAccount}
            onChange={e => setSelectedAccount(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Preview */}
      {parsed.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-slate-900 mb-3">
            Preview — {parsed.length} transacciones
          </h2>
          <div className="max-h-72 overflow-y-auto space-y-2 bg-slate-50 rounded-xl p-4">
            {parsed.map((row, i) => {
              const isDeposit = row.amount >= 0;
              return (
                <div key={i} className="flex items-center justify-between text-sm bg-white rounded-lg p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 truncate">{row.description}</p>
                    <p className="text-xs text-slate-500">{row.transaction_date}</p>
                  </div>
                  <p className={`font-bold shrink-0 ml-2 ${isDeposit ? 'text-emerald-700' : 'text-red-700'}`}>
                    {isDeposit ? '+' : ''}{money(Math.abs(row.amount))}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-3">
        <button
          onClick={() => router.back()}
          className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200"
        >
          Cancelar
        </button>
        {parsed.length > 0 && (
          <button
            onClick={handleImport}
            disabled={loading || !selectedAccount}
            className="flex-1 py-3 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 disabled:opacity-50"
          >
            {loading ? 'Importando...' : `Importar ${parsed.length}`}
          </button>
        )}
      </div>
    </div>
  );
}
