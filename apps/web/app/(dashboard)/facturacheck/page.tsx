'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSessionUser } from '../../../lib/supabase';
import type { CfdiDocument } from '@gastocheck/shared';

const money = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export default function FacturaCheckPage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<CfdiDocument[]>([]);
  const [tab, setTab] = useState<'received' | 'issued' | 'problems'>('received');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (cid: string) => {
    setLoading(true);
    try {
      const { data } = await supabase.from('cfdi_documents').select('*').eq('company_id', cid).order('fecha_emision', { ascending: false }).limit(100);
      setDocuments((data ?? []) as CfdiDocument[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getSessionUser().then(u => { if (u) { setCompanyId(u.company_id); load(u.company_id); } });
  }, [load]);

  const filtered = documents.filter(d => {
    if (tab === 'received') return d.direction === 'received';
    if (tab === 'issued') return d.direction === 'issued';
    return ['cancelado', 'not_found', 'duplicate'].includes(d.status);
  });

  const received = documents.filter(d => d.direction === 'received').length;
  const issued = documents.filter(d => d.direction === 'issued').length;
  const problems = documents.filter(d => ['cancelado', 'not_found', 'duplicate'].includes(d.status)).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6"><h1 className="text-2xl font-black text-slate-900">📄 FacturaCheck</h1><p className="text-slate-500 text-sm mt-1">Gestión de CFDI</p></div>
      <div className="grid grid-cols-3 gap-4 mb-6"><div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-600">Recibidas</p><p className="text-2xl font-black">{received}</p></div><div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-600">Emitidas</p><p className="text-2xl font-black">{issued}</p></div><div className="bg-red-50 rounded-xl border border-red-200 p-4"><p className="text-xs text-red-600">Problemas</p><p className="text-2xl font-black text-red-700">{problems}</p></div></div>
      <div className="flex gap-1 mb-6 border-b border-slate-200">{['received', 'issued', 'problems'].map(t => <button key={t} onClick={() => setTab(t as any)} className={`px-3 py-3 text-sm font-bold ${tab === t ? 'text-emerald-600 border-b-2 border-emerald-500' : 'text-slate-500'}`}>{t === 'received' ? 'Recibidas' : t === 'issued' ? 'Emitidas' : 'Problemas'}</button>)}</div>
      {loading ? <div className="text-center py-12">Cargando...</div> : filtered.length === 0 ? <div className="text-center py-12 bg-white rounded-xl">Sin facturas</div> : <div className="space-y-3">{filtered.map(d => <div key={d.id} onClick={() => router.push(`/facturacheck/${d.id}`)} className="bg-white rounded-xl border border-slate-200 p-4 cursor-pointer hover:shadow-md"><div className="flex justify-between"><div><p className="font-bold text-sm">{d.uuid_cfdi}</p><p className="text-xs text-slate-500">{d.rfc_emisor}</p></div><p className="font-black text-lg">{money(d.total ?? 0)}</p></div></div>)}</div>}
    </div>
  );
}
