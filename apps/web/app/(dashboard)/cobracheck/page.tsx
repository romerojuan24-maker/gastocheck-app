'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export default function CobraCheckPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [facturas, setFacturas] = useState<any[]>([])
  const [kpis, setKpis] = useState({ totalCartera: 0, vencidos: 0 })
  const [activeTab, setActiveTab] = useState<'clientes' | 'vencidas'>('clientes')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initializeData()
  }, [])

  const initializeData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('No autorizado')

      const { data: member } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', session.user.id)
        .single()

      if (!member?.company_id) throw new Error('No se encontró empresa')
      setCompanyId(member.company_id)
      await loadCobraData(member.company_id)
    } finally {
      setLoading(false)
    }
  }

  const loadCobraData = async (cid: string) => {
    const [clientsRes, invoicesRes] = await Promise.all([
      supabase.from('cobra_clients').select('*').eq('company_id', cid),
      supabase.from('cobra_invoices').select('*').eq('company_id', cid)
    ])

    const clients = (clientsRes.data || []) as any[]
    const invoices = (invoicesRes.data || []) as any[]

    setClientes(clients)
    setFacturas(invoices)

    const totalCartera = invoices
      .filter(f => f.status !== 'paid' && f.status !== 'cancelled')
      .reduce((s, f) => s + (f.amount || 0), 0)

    const vencidos = invoices.filter(f => f.status === 'overdue').length

    setKpis({ totalCartera, vencidos })
  }

  if (loading) return <div className="p-6 text-center">Cargando...</div>

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">🎯 CobraCheck</h1>
        <p className="text-slate-500 text-sm mt-1">Gestión de cobranza y clientes</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <a href="/cobracheck/facturas" className="px-3 py-1.5 bg-emerald-500 text-white text-sm font-semibold rounded-lg hover:bg-emerald-600">📑 Facturas y pagos</a>
          <a href="/clientes" className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50">👥 Clientes</a>
          <a href="/cobracheck/desempeno" className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50">📊 Desempeño</a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-xs text-slate-600 mb-2">Total por Cobrar</p>
          <p className="text-3xl font-black text-emerald-600">
            ${(kpis.totalCartera / 1000).toFixed(1)}k
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-xs text-slate-600 mb-2">Facturas Vencidas</p>
          <p className="text-3xl font-black text-red-600">{kpis.vencidos}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-200">
        {['clientes', 'vencidas'].map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t as any)}
            className={`px-4 py-3 font-bold text-sm ${
              activeTab === t
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-slate-500'
            }`}
          >
            {t === 'clientes' ? 'Clientes' : 'Vencidas'}
          </button>
        ))}
      </div>

      {activeTab === 'clientes' && (
        <div className="space-y-3">
          {clientes.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <p className="text-slate-500">Sin clientes</p>
            </div>
          ) : (
            clientes.map(c => (
              <div key={c.id} className="bg-white rounded-lg border border-slate-200 p-4 flex justify-between items-center">
                <div>
                  <p className="font-bold text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.rfc}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-600">
                    ${(c.current_balance || 0).toLocaleString('es-MX')}
                  </p>
                  <p className={`text-xs font-bold ${
                    (c.risk_score || 0) >= 80 ? 'text-red-600' :
                    (c.risk_score || 0) >= 60 ? 'text-orange-600' :
                    'text-green-600'
                  }`}>
                    Riesgo: {c.risk_score || 0}/100
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'vencidas' && (
        <div className="space-y-3">
          {facturas.filter(f => f.status === 'overdue').length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <p className="text-slate-500">Sin facturas vencidas</p>
            </div>
          ) : (
            facturas
              .filter(f => f.status === 'overdue')
              .map(f => (
                <div key={f.id} className="bg-white rounded-lg border border-slate-200 p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-900">Folio: {f.folio}</p>
                      <p className="text-sm text-slate-500">Vencido: {f.days_overdue || 0} días</p>
                    </div>
                    <p className="text-lg font-black text-red-600">
                      ${(f.amount || 0).toLocaleString('es-MX')}
                    </p>
                  </div>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  )
}
