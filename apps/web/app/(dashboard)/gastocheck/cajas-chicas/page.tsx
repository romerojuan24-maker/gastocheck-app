'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser, type UserRole } from '@/lib/supabase'
import { usePermissions } from '@/hooks/usePermissions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface SpenderBalance {
  user_id: string
  company_id: string
  total_advances: number
  total_spent: number
  balance: number
}

interface Profile {
  id: string
  full_name: string | null
  email?: string
}

interface Caja {
  userId: string
  name: string
  email: string
  anticipado: number
  gastado: number
  saldo: number
}

export default function CajasChicasPage() {
  const router = useRouter()
  const [cajas, setCajas] = useState<Caja[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<UserRole | null>(null)
  const { canI } = usePermissions(role)

  useEffect(() => {
    (async () => {
      const u = await getSessionUser()
      if (u?.role) setRole(u.role as UserRole)
      if (!u?.company_id) { setLoading(false); return }
      const cid = u.company_id

      const [{ data: balances }, { data: profiles }] = await Promise.all([
        supabase
          .from('v_spender_balance')
          .select('*')
          .eq('company_id', cid),
        supabase
          .from('profiles')
          .select('id, full_name'),
      ])

      // También intentar obtener emails desde company_members
      const { data: members } = await supabase
        .from('company_members')
        .select('user_id, profiles(full_name)')
        .eq('company_id', cid)
        .in('role', ['spender', 'comprador'])

      const nameMap: Record<string, string> = {}
      for (const p of (profiles ?? []) as Profile[]) {
        if (p.full_name) nameMap[p.id] = p.full_name
      }
      for (const m of (members ?? []) as any[]) {
        if (m.profiles?.full_name) nameMap[m.user_id] = m.profiles.full_name
      }

      const list: Caja[] = (balances ?? []).map((b: SpenderBalance) => ({
        userId:     b.user_id,
        name:       nameMap[b.user_id] || 'Comprador',
        email:      b.user_id,
        anticipado: Number(b.total_advances) || 0,
        gastado:    Number(b.total_spent)    || 0,
        saldo:      Number(b.balance)        || 0,
      }))
      list.sort((a, b) => b.anticipado - a.anticipado)

      setCajas(list)
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (!loading && role && !canI('cajas_chicas', 'view')) {
      router.replace('/gastocheck')
    }
  }, [loading, role, canI, router])

  if (loading) return <div className="flex items-center justify-center h-96 text-slate-600">Cargando…</div>

  const totAnt = cajas.reduce((s, c) => s + c.anticipado, 0)
  const totGas = cajas.reduce((s, c) => s + c.gastado, 0)
  const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900">🏦 Cajas Chicas</h1>
        <p className="text-slate-500 mt-1">Saldo por comprador: anticipos entregados menos gastos comprobados (capturados en app)</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Total anticipado"  value={fmt(totAnt)}          color="text-blue-600" />
        <Kpi label="Total comprobado"  value={fmt(totGas)}          color="text-slate-700" />
        <Kpi label="Saldo en cajas"    value={fmt(totAnt - totGas)} color="text-emerald-600" />
      </div>

      {cajas.length === 0 ? (
        <div className="p-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">
          No hay anticipos registrados. Los compradores deben recibir un anticipo en la app para aparecer aquí.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left p-3">Comprador</th>
                <th className="text-right p-3">Anticipado</th>
                <th className="text-right p-3">Comprobado</th>
                <th className="text-right p-3">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {cajas.map((c) => (
                <tr key={c.userId} className="border-t border-slate-100">
                  <td className="p-3 font-medium text-slate-900">{c.name}</td>
                  <td className="p-3 text-right text-slate-700">{fmt(c.anticipado)}</td>
                  <td className="p-3 text-right text-slate-700">{fmt(c.gastado)}</td>
                  <td className={`p-3 text-right font-bold ${c.saldo < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {fmt(c.saldo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-400">
        Saldo = anticipos entregados − gastos capturados (pago propio). Gastos con pago corporativo no descuentan.
        Saldo negativo = gastó más de lo anticipado (por reembolsar).
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
