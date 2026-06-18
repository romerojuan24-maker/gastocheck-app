'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import KpiCard from '../../../components/KpiCard';
import RiskBadge from '../../../components/RiskBadge';
import { supabase, getSessionUser } from '../../../lib/supabase';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

interface HoyData {
  // BancoCheck
  bank_balance:         number;
  bank_unmatched:       number;
  // CobraCheck
  receivable_total:     number;
  receivable_overdue:   number;
  // GastoCheck
  pending_advances:     number;
  pending_receipts:     number;
  // FlujoCheck
  projected_7d:         number;
  cash_risk:            'green' | 'yellow' | 'red';
  // FacturaCheck
  cfdi_problems:        number;
  // InventarioCheck
  stock_alerts:         number;
  // Advisor
  critical_insights:    { id: string; title: string; body: string; action_url: string | null }[];
}

export default function HoyPage() {
  const router = useRouter();
  const [data, setData] = useState<HoyData | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('Buenos días');

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches');
  }, []);

  const load = useCallback(async (cid: string) => {
    setLoading(true);
    try {
      const [
        advancesRes, receiptsRes,
        cobrasRes, cobrasOverdueRes,
        bankRes, bankUnmatchedRes,
        cfdiRes, stockAlertsRes,
        insightsRes,
      ] = await Promise.all([
        // GastoCheck: anticipos pendientes de aprobación
        supabase.from('advances').select('id', { count: 'exact', head: true })
          .eq('company_id', cid).eq('status', 'requested'),
        // GastoCheck: comprobantes por revisar
        supabase.from('receipts').select('id', { count: 'exact', head: true })
          .eq('company_id', cid).eq('status', 'submitted'),
        // CobraCheck: total por cobrar vigente
        supabase.from('cobra_invoices').select('amount')
          .eq('company_id', cid).in('status', ['pending','partial']),
        // CobraCheck: vencidas
        supabase.from('cobra_invoices').select('amount')
          .eq('company_id', cid).eq('status', 'overdue'),
        // BancoCheck: saldo cuentas activas
        supabase.from('bank_accounts').select('current_balance')
          .eq('company_id', cid).eq('is_active', true),
        // BancoCheck: sin clasificar
        supabase.from('bank_transactions').select('id', { count: 'exact', head: true })
          .eq('company_id', cid).in('status', ['new', 'unidentified']),
        // FacturaCheck: CFDI con problema
        supabase.from('cfdi_documents').select('id', { count: 'exact', head: true })
          .eq('company_id', cid).in('status', ['cancelado','not_found']),
        // InventarioCheck: alertas sin leer
        supabase.from('inventory_alerts').select('id', { count: 'exact', head: true })
          .eq('company_id', cid).eq('is_read', false),
        // Advisor: insights críticos
        supabase.from('advisor_insights').select('id, title, body, action_url')
          .eq('company_id', cid).eq('severity', 'critical').eq('is_dismissed', false)
          .order('created_at', { ascending: false }).limit(3),
      ]);

      const bankBalance = (bankRes.data ?? []).reduce((s, r) => s + (r.current_balance ?? 0), 0);
      const cobraTotal  = (cobrasRes.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
      const cobraOverdue = (cobrasOverdueRes.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);

      // Proyección simple 7 días: saldo banco + cobras vigentes - pagos estimados
      const projected7d = bankBalance + cobraTotal * 0.3;
      const cashRisk: 'green' | 'yellow' | 'red' =
        projected7d < 0        ? 'red'
        : projected7d < 10000  ? 'yellow'
        : 'green';

      setData({
        bank_balance:      bankBalance,
        bank_unmatched:    bankUnmatchedRes.count ?? 0,
        receivable_total:  cobraTotal,
        receivable_overdue: cobraOverdue,
        pending_advances:  advancesRes.count ?? 0,
        pending_receipts:  receiptsRes.count ?? 0,
        projected_7d:      projected7d,
        cash_risk:         cashRisk,
        cfdi_problems:     cfdiRes.count ?? 0,
        stock_alerts:      stockAlertsRes.count ?? 0,
        critical_insights: insightsRes.data ?? [],
      });
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

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const totalPending = data.pending_advances + data.pending_receipts;
  const hasProblems  = data.cfdi_problems > 0 || data.bank_unmatched > 5 || data.stock_alerts > 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">{greeting} 👋</h1>
        <p className="text-slate-500 text-sm mt-1">
          Aquí está lo más importante de tu negocio hoy
        </p>
      </div>

      {/* Insights críticos */}
      {data.critical_insights.length > 0 && (
        <div className="mb-6 space-y-2">
          {data.critical_insights.map(i => (
            <div
              key={i.id}
              className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 cursor-pointer hover:bg-red-100 transition-colors"
              onClick={() => i.action_url && router.push(i.action_url)}
            >
              <span className="text-red-500 text-lg mt-0.5">🔴</span>
              <div>
                <p className="text-sm font-bold text-red-800">{i.title}</p>
                <p className="text-xs text-red-600 mt-0.5">{i.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KPIs principales — fila 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <KpiCard
          icon="🏦"
          label="Dinero disponible"
          value={data.bank_balance}
          isMoney
          semaforo={data.bank_balance > 0 ? 'green' : 'red'}
          hint={`${data.bank_unmatched} movimientos sin clasificar`}
          action={{ label: 'Ver banco', onClick: () => router.push('/bancocheck') }}
        />
        <KpiCard
          icon="💰"
          label="Me deben"
          value={data.receivable_total}
          isMoney
          semaforo={data.receivable_overdue > 0 ? 'yellow' : 'green'}
          hint={data.receivable_overdue > 0 ? `${money(data.receivable_overdue)} vencido` : 'Todo al corriente'}
          action={{ label: 'Ver cobranza', onClick: () => router.push('/cobracheck') }}
        />
        <KpiCard
          icon="📈"
          label="Flujo 7 días"
          value={data.projected_7d}
          isMoney
          semaforo={data.cash_risk}
          hint={data.cash_risk === 'red' ? '⚠ No te va a alcanzar' : data.cash_risk === 'yellow' ? 'Flujo ajustado' : 'Te alcanza'}
          action={{ label: 'Ver flujo', onClick: () => router.push('/flujocheck') }}
        />
      </div>

      {/* KPIs — fila 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon="⏳"
          label="Por aprobar"
          value={totalPending}
          semaforo={totalPending > 0 ? 'yellow' : 'gray'}
          hint={`${data.pending_advances} anticipos · ${data.pending_receipts} comprobantes`}
          action={{ label: 'Aprobar', onClick: () => router.push('/pendientes') }}
        />
        <KpiCard
          icon="🏦"
          label="Sin clasificar"
          value={data.bank_unmatched}
          semaforo={data.bank_unmatched > 10 ? 'red' : data.bank_unmatched > 0 ? 'yellow' : 'gray'}
          hint="Movimientos bancarios"
          action={{ label: 'Clasificar', onClick: () => router.push('/bancocheck') }}
        />
        <KpiCard
          icon="📄"
          label="CFDI problema"
          value={data.cfdi_problems}
          semaforo={data.cfdi_problems > 0 ? 'red' : 'gray'}
          hint="Cancelados o no encontrados"
          action={{ label: 'Ver CFDI', onClick: () => router.push('/facturacheck') }}
        />
        <KpiCard
          icon="📦"
          label="Alertas stock"
          value={data.stock_alerts}
          semaforo={data.stock_alerts > 0 ? 'yellow' : 'gray'}
          hint="Productos bajos o agotados"
          action={{ label: 'Ver inventario', onClick: () => router.push('/inventariocheck') }}
        />
      </div>

      {/* Acciones rápidas */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-bold text-slate-700 mb-3">Acciones rápidas</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Aprobar anticipos',  icon: '✅', href: '/pendientes' },
            { label: 'Ver flujo',          icon: '📈', href: '/flujocheck' },
            { label: 'Conciliar banco',    icon: '🏦', href: '/bancocheck' },
            { label: 'Preguntar al IA',    icon: '🤖', href: '/advisor' },
          ].map(a => (
            <button
              key={a.href}
              onClick={() => router.push(a.href)}
              className="flex flex-col items-center gap-1 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <span className="text-2xl">{a.icon}</span>
              <span className="text-xs font-semibold text-slate-600 text-center">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
