'use client'

import { useEffect, useState } from 'react'
import { supabase, getSessionUser } from '@/lib/supabase'

interface Collector { id: string; name: string; pagos: number; cobrado: number; clientes: number }

export default function DesempenoPage() {
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState({ facturado: 0, cobrado: 0, porCobrar: 0, vencidoMonto: 0, vencidoCount: 0, recuperacion: 0 })
  const [collectors, setCollectors] = useState<Collector[]>([])

  useEffect(() => {
    (async () => {
      const u = await getSessionUser()
      if (!u?.company_id) { setLoading(false); return }
      const cid = u.company_id

      const [{ data: invoices }, { data: payments }, { data: profiles }] = await Promise.all([
        supabase.from('cobra_invoices').select('amount, status, due_date').eq('company_id', cid),
        supabase.from('cobra_payments').select('amount, created_by, client_id').eq('company_id', cid),
        supabase.from('profiles').select('id, full_name'),
      ])

      const inv = (invoices ?? []) as any[]
      const pay = (payments ?? []) as any[]
      const facturado = inv.reduce((s, i) => s + (Number(i.amount) || 0), 0)
      const cobrado = pay.reduce((s, p) => s + (Number(p.amount) || 0), 0)
      const vencidas = inv.filter((i) => i.status === 'overdue')
      const vencidoMonto = vencidas.reduce((s, i) => s + (Number(i.amount) || 0), 0)
      setKpis({
        facturado, cobrado,
        porCobrar: facturado - cobrado,
        vencidoMonto, vencidoCount: vencidas.length,
        recuperacion: facturado > 0 ? (cobrado / facturado) * 100 : 0,
      })

      const nameOf = (id: string) => (profiles ?? []).find((p: any) => p.id === id)?.full_name || 'Sin asignar'
      const map: Record<string, Collector> = {}
      const clientsByCol: Record<string, Set<string>> = {}
      for (const p of pay) {
        const cb = p.created_by || 'none'
        map[cb] ??= { id: cb, name: cb === 'none' ? 'Sin asignar' : nameOf(cb), pagos: 0, cobrado: 0, clientes: 0 }
        map[cb].pagos++
        map[cb].cobrado += Number(p.amount) || 0
        ;(clientsByCol[cb] ??= new Set()).add(p.client_id)
      }
      const list = Object.values(map).map((c) => ({ ...c, clientes: clientsByCol[c.id]?.size ?? 0 }))
      list.sort((a, b) => b.cobrado - a.cobrado)
      setCollectors(list)
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-96 text-slate-600">Cargando…</div>
  const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900">📊 Desempeño de Cobranza</h1>
        <p className="text-slate-500 mt-1">Indicadores generales y por cobrador</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Kpi label="Facturado" value={fmt(kpis.facturado)} color="text-slate-700" />
        <Kpi label="Cobrado" value={fmt(kpis.cobrado)} color="text-emerald-600" />
        <Kpi label="Por cobrar" value={fmt(kpis.porCobrar)} color="text-amber-600" />
        <Kpi label="% Recuperación" value={`${kpis.recuperacion.toFixed(1)}%`} color="text-blue-600" />
        <Kpi label="Vencido" value={fmt(kpis.vencidoMonto)} color="text-red-600" />
        <Kpi label="Facturas vencidas" value={String(kpis.vencidoCount)} color="text-red-600" />
      </div>

      <div>
        <h2 className="font-bold text-slate-900 mb-3">Por cobrador</h2>
        {collectors.length === 0 ? (
          <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">Sin pagos registrados.</div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left p-3">Cobrador</th>
                  <th className="text-center p-3">Pagos</th>
                  <th className="text-center p-3">Clientes</th>
                  <th className="text-right p-3">Cobrado</th>
                </tr>
              </thead>
              <tbody>
                {collectors.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="p-3 font-medium text-slate-900">{c.name}</td>
                    <td className="p-3 text-center text-slate-600">{c.pagos}</td>
                    <td className="p-3 text-center text-slate-600">{c.clientes}</td>
                    <td className="p-3 text-right font-bold text-emerald-600">{fmt(c.cobrado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
