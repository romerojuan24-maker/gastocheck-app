'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSessionUser, type UserRole } from '../../../lib/supabase';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

interface MyAdvance {
  id: string; folio: string; amount: number; status: string; concept: string;
}
interface MyReceipt {
  id: string; folio: string; amount: number; status: string; vendor_name: string;
}
interface CollectorTask {
  id: string; client_name: string; amount: number; days_overdue: number; promise_date: string | null;
}

const ADVANCE_STATUS: Record<string, { label: string; color: string }> = {
  requested: { label: 'En revisión', color: 'text-amber-600 bg-amber-50' },
  approved:  { label: 'Aprobado',    color: 'text-emerald-700 bg-emerald-50' },
  rejected:  { label: 'Rechazado',   color: 'text-red-700 bg-red-50' },
  delivered: { label: 'Recibido',    color: 'text-blue-700 bg-blue-50' },
  checked:   { label: 'Comprobado',  color: 'text-slate-600 bg-slate-100' },
  closed:    { label: 'Cerrado',     color: 'text-slate-400 bg-slate-50' },
};

export default function MisTareasPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [myAdvances, setMyAdvances] = useState<MyAdvance[]>([]);
  const [myReceipts, setMyReceipts] = useState<MyReceipt[]>([]);
  const [myBalance, setMyBalance] = useState(0);
  const [collectorTasks, setCollectorTasks] = useState<CollectorTask[]>([]);

  const load = useCallback(async (uid: string, cid: string, r: UserRole) => {
    setLoading(true);
    try {
      if (r === 'buyer' || r === 'spender') {
        const [advRes, recRes] = await Promise.all([
          supabase.from('advances')
            .select('id, folio, amount, status, concept')
            .eq('company_id', cid).eq('user_id', uid)
            .order('created_at', { ascending: false }).limit(20),
          supabase.from('receipts')
            .select('id, folio, amount, status, vendor_name')
            .eq('company_id', cid).eq('user_id', uid)
            .order('created_at', { ascending: false }).limit(20),
        ]);
        const advs = (advRes.data ?? []) as MyAdvance[];
        setMyAdvances(advs);
        setMyReceipts((recRes.data ?? []) as MyReceipt[]);
        // Balance = suma de aprobados - suma de comprobados
        const approved = advs.filter(a => ['approved','delivered'].includes(a.status)).reduce((s,a)=>s+a.amount,0);
        setMyBalance(approved);
      }

      if (r === 'collector') {
        const { data } = await supabase
          .from('cobra_invoices')
          .select('id, amount, days_overdue, promise_date, cobra_clients:client_id(name)')
          .eq('company_id', cid)
          .in('status', ['overdue','pending'])
          .order('days_overdue', { ascending: false })
          .limit(30);
        setCollectorTasks((data ?? []).map((d: any) => ({
          id: d.id,
          client_name: d.cobra_clients?.name ?? '—',
          amount: d.amount,
          days_overdue: d.days_overdue ?? 0,
          promise_date: d.promise_date ?? null,
        })));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getSessionUser().then(u => {
      if (!u) return;
      setRole(u.role);
      setUserId(u.id);
      setCompanyId(u.company_id);
      load(u.id, u.company_id, u.role);
    });
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // ── Collector ─────────────────────────────────────────────────────────────────
  if (role === 'collector') {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-black text-slate-900 mb-1">Mis tareas de cobranza</h1>
        <p className="text-slate-500 text-sm mb-6">{collectorTasks.length} clientes a contactar</p>

        <div className="space-y-3">
          {collectorTasks.length === 0 && (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">🎉</p>
              <p className="text-slate-500 font-medium">Sin tareas pendientes</p>
            </div>
          )}
          {collectorTasks.map(t => (
            <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{t.client_name}</p>
                  {t.days_overdue > 0 && (
                    <p className="text-xs text-red-600">{t.days_overdue} días vencido</p>
                  )}
                  {t.promise_date && (
                    <p className="text-xs text-amber-600">Promesa: {t.promise_date}</p>
                  )}
                </div>
                <p className="text-base font-black text-slate-900 shrink-0">{money(t.amount)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/cobracheck/clientes`)}
                  className="flex-1 py-2 bg-emerald-500 text-white text-xs font-bold rounded-lg"
                >
                  💰 Registrar pago
                </button>
                <button
                  onClick={() => router.push(`/cobracheck/clientes`)}
                  className="flex-1 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg"
                >
                  📅 Anotar promesa
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Employee / Operator ───────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-black text-slate-900 mb-1">Mis tareas</h1>
      <p className="text-slate-500 text-sm mb-6">Tus anticipos y comprobantes</p>

      {/* Mi saldo */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 mb-6">
        <p className="text-xs text-slate-400 mb-1">Mi saldo pendiente</p>
        <p className="text-3xl font-black">{money(myBalance)}</p>
        <p className="text-xs text-slate-400 mt-1">Anticipos aprobados sin comprobar</p>
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => router.push('/gastocheck/solicitar-anticipo')}
          className="py-4 bg-emerald-500 text-white font-bold text-sm rounded-xl hover:bg-emerald-600"
        >
          + Solicitar anticipo
        </button>
        <button
          onClick={() => router.push('/gastocheck/capturar')}
          className="py-4 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700"
        >
          📸 Subir comprobante
        </button>
      </div>

      {/* Mis anticipos recientes */}
      <h2 className="text-sm font-bold text-slate-700 mb-3">Mis anticipos</h2>
      <div className="space-y-2 mb-6">
        {myAdvances.length === 0 && (
          <p className="text-sm text-slate-400 py-4 text-center">Sin anticipos</p>
        )}
        {myAdvances.map(a => {
          const meta = ADVANCE_STATUS[a.status] ?? ADVANCE_STATUS.requested;
          return (
            <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900">{a.folio}</p>
                <p className="text-xs text-slate-500 truncate">{a.concept}</p>
              </div>
              <p className="text-sm font-black text-slate-900 shrink-0">{money(a.amount)}</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${meta.color}`}>
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mis comprobantes recientes */}
      <h2 className="text-sm font-bold text-slate-700 mb-3">Mis comprobantes</h2>
      <div className="space-y-2">
        {myReceipts.length === 0 && (
          <p className="text-sm text-slate-400 py-4 text-center">Sin comprobantes</p>
        )}
        {myReceipts.slice(0, 10).map(r => (
          <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900">{r.folio}</p>
              <p className="text-xs text-slate-500 truncate">{r.vendor_name || '—'}</p>
            </div>
            <p className="text-sm font-black text-slate-900 shrink-0">{money(r.amount)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
