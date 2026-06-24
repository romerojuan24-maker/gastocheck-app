'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Kpis {
  vigentes: number
  historicos: number
  sinAsignar: number
  montoVigente: number
}

export default function GastoCheckHome() {
  const [kpis, setKpis] = useState<Kpis>({ vigentes: 0, historicos: 0, sinAsignar: 0, montoVigente: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return
        const { data: member } = await supabase
          .from('company_members')
          .select('company_id')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle()
        if (!member?.company_id) return

        const { data: rows } = await supabase
          .from('expenses')
          .select('total, policy_id, policies(status)')
          .eq('company_id', member.company_id)

        const list = (rows ?? []) as any[]
        const isOpen = (r: any) => r.policies?.status === 'open'
        const isClosed = (r: any) => r.policies?.status === 'closed'
        setKpis({
          vigentes: list.filter(isOpen).length,
          historicos: list.filter(isClosed).length,
          sinAsignar: list.filter((r) => !r.policy_id || !r.policies).length,
          montoVigente: list.filter(isOpen).reduce((s, r) => s + (Number(r.total) || 0), 0),
        })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const cards = [
    { href: '/gastocheck/comprobantes', icon: '🧾', title: 'Comprobantes', desc: 'Vigentes, en revisión e históricos con trazabilidad a póliza' },
    { href: '/gastocheck/polizas', icon: '📒', title: 'Plataforma del Contador', desc: 'Catálogo, clasificación, validación SAT y exportación de pólizas' },
    { href: '/gastocheck/cuentas-por-pagar', icon: '💳', title: 'Cuentas por Pagar', desc: 'Control de pendientes a proveedores: agregar, editar, pagar' },
    { href: '/gastocheck/cajas-chicas', icon: '🪙', title: 'Cajas Chicas', desc: 'Saldos por responsable: anticipos menos gastos comprobados' },
    { href: '/gastocheck/escanear', icon: '📷', title: 'Escanear Comprobante', desc: 'IA lee el ticket/factura y extrae monto, fecha, proveedor, RFC' },
  ]

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900">🧾 GastoCheck</h1>
        <p className="text-slate-500 mt-1">Control de gastos, comprobantes y contabilización</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Vigentes', value: loading ? '—' : kpis.vigentes, color: 'text-emerald-600' },
          { label: 'Históricos', value: loading ? '—' : kpis.historicos, color: 'text-slate-600' },
          { label: 'Sin asignar', value: loading ? '—' : kpis.sinAsignar, color: 'text-amber-600' },
          { label: 'Monto vigente', value: loading ? '—' : `$${kpis.montoVigente.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, color: 'text-blue-600' },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase">{k.label}</p>
            <p className={`text-2xl font-black mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Accesos */}
      <div className="grid md:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="bg-white border border-slate-200 rounded-xl p-6 hover:border-emerald-400 hover:shadow-sm transition group"
          >
            <div className="text-3xl mb-3">{c.icon}</div>
            <h3 className="font-bold text-slate-900 group-hover:text-emerald-600">{c.title}</h3>
            <p className="text-sm text-slate-500 mt-1">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
