'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@gastocheck/shared'
import { CobraClient, CobraInvoice, CobraPayment } from '@gastocheck/shared/types/cobracheck'

export default function CobraCheckDashboard() {
  const [kpis, setKpis] = useState({ totalCartera: 0, vencidos: 0, enRiesgo: 0, avgScore: 0 })
  const [activeTab, setActiveTab] = useState<'clientes' | 'vencidas' | 'actividad'>('clientes')
  const [clientes, setClientes] = useState<CobraClient[]>([])
  const [invoices, setInvoices] = useState<CobraInvoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data: member } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('auth_id', session.user.id)
        .single()

      if (!member) return

      // Clientes
      const { data: clientsData } = await supabase
        .from('cobra_clients')
        .select('*')
        .eq('company_id', member.company_id)
        .order('risk_score', { ascending: false })

      setClientes(clientsData || [])

      // Invoices vencidas
      const { data: invoicesData } = await supabase
        .from('cobra_invoices')
        .select('*')
        .eq('company_id', member.company_id)
        .in('status', ['pending', 'partial', 'overdue'])
        .order('due_date', { ascending: true })

      setInvoices(invoicesData || [])

      // KPIs
      const totalCartera = (clientsData || []).reduce((s, c) => s + c.current_balance, 0)
      const vencidos = (invoicesData || []).filter(i => i.status === 'overdue').length
      const enRiesgo = (clientsData || []).filter(c => c.risk_score >= 70).length
      const avgScore = (clientsData || []).length > 0
        ? Math.round((clientsData || []).reduce((s, c) => s + c.risk_score, 0) / (clientsData || []).length)
        : 0

      setKpis({ totalCartera, vencidos, enRiesgo, avgScore })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">CobraCheck Dashboard</h1>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Total por Cobrar</div>
          <div className="text-2xl font-bold text-blue-600">${(kpis.totalCartera / 1000).toFixed(1)}k</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Vencidas</div>
          <div className="text-2xl font-bold text-red-600">{kpis.vencidos}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">En Riesgo</div>
          <div className="text-2xl font-bold text-orange-600">{kpis.enRiesgo}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Score Promedio</div>
          <div className="text-2xl font-bold text-gray-800">{kpis.avgScore}/100</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['clientes', 'vencidas', 'actividad'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded font-semibold ${
              activeTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
            }`}
          >
            {tab === 'clientes' ? 'Clientes' : tab === 'vencidas' ? 'Facturas Vencidas' : 'Actividad'}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'clientes' && (
        <div className="grid gap-4">
          {clientes.map(c => (
            <div key={c.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
              <div>
                <div className="font-semibold">{c.name}</div>
                <div className="text-sm text-gray-600">{c.rfc}</div>
              </div>
              <div className="text-right">
                <div className="font-bold">${c.current_balance.toLocaleString('es-MX')}</div>
                <div className={`text-sm font-semibold ${
                  c.risk_score >= 80 ? 'text-red-600' : c.risk_score >= 60 ? 'text-orange-600' : 'text-green-600'
                }`}>
                  Score: {c.risk_score}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'vencidas' && (
        <div className="grid gap-4">
          {invoices.filter(i => i.status === 'overdue').map(i => (
            <div key={i.id} className="bg-white p-4 rounded-lg shadow">
              <div className="flex justify-between">
                <div>
                  <div className="font-semibold">Folio: {i.folio}</div>
                  <div className="text-sm text-gray-600">${i.amount.toLocaleString('es-MX')}</div>
                </div>
                <div className="text-right">
                  <div className="text-red-600 font-bold">{i.days_overdue} días vencido</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'actividad' && (
        <div className="bg-white p-4 rounded-lg shadow text-center text-gray-600">
          Actividad en desarrollo
        </div>
      )}
    </div>
  )
}
