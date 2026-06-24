'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Suggestion {
  txId: string
  txDesc: string
  txDate: string
  txAmount: number
  kind: 'cobro' | 'pago'
  candidate: string
  confidence: number
  reason: string
}

export default function AnalisisBancoPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, asignados: 0, sinAsignar: 0, montoSinAsignar: 0 })
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])

  useEffect(() => {
    (async () => {
      const u = await getSessionUser()
      if (!u?.company_id) { setLoading(false); return }
      const cid = u.company_id

      const [{ data: txs }, { data: invoices }, { data: expenses }, { data: payables }] = await Promise.all([
        supabase.from('bank_transactions').select('id, description, transaction_date, amount, status, related_receipt_id, related_invoice_id, related_advance_id').eq('company_id', cid).order('transaction_date', { ascending: false }),
        supabase.from('cobra_invoices').select('id, folio, amount, status').eq('company_id', cid).neq('status', 'paid'),
        supabase.from('expenses').select('id, provider_name, total').eq('company_id', cid),
        supabase.from('accounts_payable').select('id, supplier_name, amount, status').eq('company_id', cid).neq('status', 'paid'),
      ])

      const transactions = (txs ?? []) as any[]
      const asignados = transactions.filter((t) => t.status === 'matched' || t.related_invoice_id || t.related_receipt_id || t.related_advance_id).length
      const sinAsignarTx = transactions.filter((t) => !['matched'].includes(t.status) && !t.related_invoice_id && !t.related_receipt_id && !t.related_advance_id)

      // Heurística de convergencia: cruza monto (±2%) y signo
      const sugg: Suggestion[] = []
      const near = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1)
      for (const t of sinAsignarTx) {
        const amt = Number(t.amount) || 0
        if (amt > 0) {
          for (const inv of (invoices ?? []) as any[]) {
            const d = near(amt, Number(inv.amount))
            if (d <= 0.02) sugg.push({ txId: t.id, txDesc: t.description, txDate: t.transaction_date, txAmount: amt, kind: 'cobro', candidate: `Factura ${inv.folio} ($${Number(inv.amount).toLocaleString('es-MX')})`, confidence: Math.round((1 - d) * 100), reason: d === 0 ? 'Monto exacto' : 'Monto muy cercano' })
          }
        } else {
          const abs = Math.abs(amt)
          for (const e of (expenses ?? []) as any[]) {
            const d = near(abs, Number(e.total))
            if (d <= 0.05) sugg.push({ txId: t.id, txDesc: t.description, txDate: t.transaction_date, txAmount: amt, kind: 'pago', candidate: `Gasto ${e.provider_name} ($${Number(e.total).toLocaleString('es-MX')})`, confidence: Math.round((1 - d) * 100), reason: 'Coincide con gasto registrado' })
          }
          for (const ap of (payables ?? []) as any[]) {
            const d = near(abs, Number(ap.amount))
            if (d <= 0.05) sugg.push({ txId: t.id, txDesc: t.description, txDate: t.transaction_date, txAmount: amt, kind: 'pago', candidate: `Cuenta x pagar: ${ap.supplier_name} ($${Number(ap.amount).toLocaleString('es-MX')})`, confidence: Math.round((1 - d) * 100), reason: 'Coincide con cuenta por pagar' })
          }
        }
      }
      sugg.sort((a, b) => b.confidence - a.confidence)

      setStats({
        total: transactions.length,
        asignados,
        sinAsignar: sinAsignarTx.length,
        montoSinAsignar: sinAsignarTx.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0),
      })
      setSuggestions(sugg)
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-96 text-slate-600">Analizando movimientos…</div>
  const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900">🤖 Análisis IA — BancoCheck</h1>
        <p className="text-slate-500 mt-1">Convergencias entre movimientos bancarios e ingresos/egresos registrados</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Movimientos" value={String(stats.total)} color="text-slate-700" />
        <Kpi label="Conciliados" value={String(stats.asignados)} color="text-emerald-600" />
        <Kpi label="Sin asignar" value={String(stats.sinAsignar)} color="text-amber-600" />
        <Kpi label="Monto sin asignar" value={fmt(stats.montoSinAsignar)} color="text-red-600" />
      </div>

      <div>
        <h2 className="font-bold text-slate-900 mb-1">Convergencias sugeridas</h2>
        <p className="text-sm text-slate-500 mb-3">Coincidencias por monto entre movimientos sin asignar y facturas/gastos/cuentas por pagar.</p>
        {suggestions.length === 0 ? (
          <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">
            No se encontraron convergencias claras. Los movimientos sin asignar no coinciden con facturas ni gastos registrados.
          </div>
        ) : (
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="border border-slate-200 bg-white rounded-lg p-4 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.kind === 'cobro' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                      {s.kind === 'cobro' ? '↓ Cobro' : '↑ Pago'}
                    </span>
                    <span className="font-medium text-slate-900">{s.txDesc}</span>
                    <span className="text-sm text-slate-400">{new Date(s.txDate).toLocaleDateString('es-MX')}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">≈ {s.candidate} — <span className="text-slate-400">{s.reason}</span></p>
                </div>
                <div className="text-right whitespace-nowrap">
                  <p className="font-bold text-slate-900">{fmt(Math.abs(s.txAmount))}</p>
                  <span className={`text-xs font-semibold ${s.confidence >= 98 ? 'text-emerald-600' : 'text-amber-600'}`}>{s.confidence}% match</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-slate-400">
        Heurística local (monto ±2% ingresos, ±5% egresos). Para análisis profundo (descripción, recurrencia, NLP) se usa la Edge Function <code>bancocheck-auto-match</code>.
      </p>
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs font-semibold text-slate-500 uppercase">{label}</p>
      <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
    </div>
  )
}
