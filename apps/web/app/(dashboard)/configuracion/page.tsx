'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser, type SessionUser } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ConfiguracionPage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [companyName, setCompanyName] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const u = await getSessionUser()
      setUser(u)
      if (u?.company_id) {
        const { data } = await supabase
          .from('companies')
          .select('name')
          .eq('id', u.company_id)
          .maybeSingle()
        setCompanyName(data?.name ?? '')
      }
      setLoading(false)
    })()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900">⚙️ Configuración</h1>
        <p className="text-slate-500 mt-1">Ajustes de cuenta y empresa</p>
      </div>

      {/* Perfil */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h2 className="font-bold text-slate-900">Tu cuenta</h2>
        <Row label="Nombre" value={user?.full_name ?? '—'} />
        <Row label="Correo" value={user?.email ?? '—'} />
        <Row label="Rol" value={user?.role ?? '—'} capitalize />
      </section>

      {/* Empresa */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h2 className="font-bold text-slate-900">Empresa</h2>
        <Row label="Nombre" value={companyName || '—'} />
        <Row label="ID" value={user?.company_id ?? '—'} mono />
      </section>

      {/* Catálogo de cuentas (bug: tiene errores, debe poder actualizarse) */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h2 className="font-bold text-slate-900">Contabilidad</h2>
        <p className="text-sm text-slate-500">
          Actualiza el catálogo de cuentas, clasifica gastos y exporta pólizas.
        </p>
        <Link
          href="/gastocheck/polizas"
          className="inline-block px-4 py-2 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 text-sm"
        >
          Abrir Plataforma del Contador →
        </Link>
      </section>
    </div>
  )
}

function Row({ label, value, mono, capitalize }: { label: string; value: string; mono?: boolean; capitalize?: boolean }) {
  return (
    <div className="flex justify-between items-center border-b border-slate-100 pb-2 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-medium text-slate-900 ${mono ? 'font-mono text-xs' : ''} ${capitalize ? 'capitalize' : ''}`}>
        {value}
      </span>
    </div>
  )
}
