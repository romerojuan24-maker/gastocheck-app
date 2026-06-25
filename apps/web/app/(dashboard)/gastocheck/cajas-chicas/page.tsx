'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Caja {
  holderId: string
  holder: string
  anticipado: number
  gastado: number
  saldo: number
  polizas: number
}

export default function CajasChicasPage() {
  const [cajas, setCajas] = useState<Caja[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const u = await getSessionUser()
      if (!u?.company_id) { setLoading(false); return }
      const cid = u.company_id

      const [{ data: advances }, { data: expenses }, { data: profiles }] = await Promise.all([
        supabase.from('advances').select('amount, policy_id, policies(holder_id)').eq('company_id', cid),
        supabase.from('expenses').select('total, policy_id, policies(holder_id)').eq('company_id', cid),
        supabase.from('profiles').select('id, full_name'),
      ])

      const nameOf = (id: string) => (profiles ?? []).find((p: any) => p.id === id)?.full_name || 'Sin nombre'
      const map: Record<string, Caja> = {}
      const ensure = (hid: string) => (map[hid] ??= { holderId: hid, holder: nameOf(hid), anticipado: 0, gastado: 0, saldo: 0, polizas: 0 })
      const polSet: Record<string, Set<string>> = {}

      for (const a of (advances ?? []) as any[]) {
        const hid = a.policies?.holder_id; if (!hid) continue
        ensure(hid).anticipado += Number(a.amount) || 0
        ;(polSet[hid] ??= new Set()).add(a.policy_id)
      }
      for (const e of (expenses ?? []) as any[]) {
        const hid = e.policies?.holder_id; if (!hid) continue
        ensure(hid).gastado += Number(e.total) || 0
        ;(polSet[hid] ??= new Set()).add(e.policy_id)
      }
      const list = Object.values(map).map((c) => ({ ...c, saldo: c.anticipado - c.gastado, polizas: polSet[c.holderId]?.size ?? 0 }))
      list.sort((a, b) => b.anticipado - a.anticipado)
      setCajas(list)
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-96 text-slate-600">Cargando…</div>

  const totAnt = cajas.reduce((s, c) => s + c.anticipado, 0)
  const totGas = cajas.reduce((s, c) => s + c.gastado, 0)
  const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900">🏦 Cajas Chicas</h1>
        <p className="text-slate-500 mt-1">Saldo por responsable: anticipos entregados menos gastos comprobados</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Total anticipado" value={fmt(totAnt)} color="text-blue-600" />
        <Kpi label="Total comprobado" value={fmt(totGas)} color="text-slate-700" />
        <Kpi label="Saldo en cajas" value={fmt(totAnt - totGas)} color="text-emerald-600" />
      </div>

      {cajas.length === 0 ? (
        <div className="p-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">
          No hay anticipos registrados.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left p-3">Responsable</th>
                <th className="text-center p-3">Pólizas</th>
                <th className="text-right p-3">Anticipado</th>
                <th className="text-right p-3">Comprobado</th>
                <th className="text-right p-3">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {cajas.map((c) => (
                <tr key={c.holderId} className="border-t border-slate-100">
                  <td className="p-3 font-medium text-slate-900">{c.holder}</td>
                  <td className="p-3 text-center text-slate-600">{c.polizas}</td>
                  <td className="p-3 text-right text-slate-700">{fmt(c.anticipado)}</td>
                  <td className="p-3 text-right text-slate-700">{fmt(c.gastado)}</td>
                  <td className={`p-3 text-right font-bold ${c.saldo < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmt(c.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-400">
        Saldo = anticipos entregados − gastos comprobados. Saldo negativo (rojo) = gastó más de lo anticipado (por reembolsar).
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
