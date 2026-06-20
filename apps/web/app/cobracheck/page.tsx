'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { DashboardConsolidado } from '@/components/DashboardConsolidado'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

function CobraCheckDashboard({ empresaId }: { empresaId: string }) {
  const [kpis, setKpis] = useState({ totalCartera: 0, vencidos: 0, enRiesgo: 0, avgScore: 0 })
  const [activeTab, setActiveTab] = useState<'clientes' | 'vencidas' | 'pagos'>('clientes')
  const [clientes, setClientes] = useState<any[]>([])
  const [facturas, setFacturas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewClient, setShowNewClient] = useState(false)
  const [showNewFactura, setShowNewFactura] = useState(false)
  const [showRegistrarPago, setShowRegistrarPago] = useState(false)
  const [newClientError, setNewClientError] = useState<string | null>(null)
  const [selectedFactura, setSelectedFactura] = useState<any>(null)

  useEffect(() => {
    loadData()
  }, [empresaId])

  const loadData = async () => {
    try {
      // Clientes
      const { data: clientsData } = await supabase
        .from('clientes')
        .select('*')
        .eq('empresa_id', empresaId)

      setClientes(clientsData || [])

      // Facturas
      const { data: facturasData } = await supabase
        .from('facturas')
        .select('*, movimientos_financieros(estado_pago)')
        .eq('empresa_id', empresaId)

      setFacturas(facturasData || [])

      // KPIs
      const totalCartera = (facturasData || [])
        .filter(f => f.movimientos_financieros?.[0]?.estado_pago !== 'PAGADO')
        .reduce((s, f) => s + f.monto, 0)

      const vencidos = (facturasData || []).filter(
        f => f.fecha_vencimiento && new Date(f.fecha_vencimiento) < new Date() && f.movimientos_financieros?.[0]?.estado_pago !== 'PAGADO'
      ).length

      const avgScore = 0 // Implementar risk scoring después

      setKpis({ totalCartera, vencidos, enRiesgo: 0, avgScore })
    } finally {
      setLoading(false)
    }
  }

  const handleAddClient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setNewClientError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('No autorizado')

      const { data: member } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', session.user.id)
        .single()

      if (!member) throw new Error('No se encontró empresa')

      const formData = new FormData(e.currentTarget)
      const name = formData.get('name') as string
      const rfc = (formData.get('rfc') as string)?.toUpperCase()
      const email = formData.get('email') as string

      if (!name || name.length < 3) throw new Error('Nombre requerido (min 3 caracteres)')
      if (!rfc || rfc.length !== 13) throw new Error('RFC debe ser exactamente 13 caracteres')
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email inválido')

      // Verificar RFC duplicado
      const { data: existing } = await supabase
        .from('cobra_clients')
        .select('id')
        .eq('rfc', rfc)
        .eq('company_id', member.company_id)
        .maybeSingle()

      if (existing) throw new Error('RFC ya existe en esta empresa')

      await supabase.from('cobra_clients').insert({
        name,
        rfc,
        email: email || null,
        company_id: member.company_id
      })
      setShowNewClient(false)
      loadData()
    } catch (err: any) {
      setNewClientError(err.message)
    }
  }

  return (
    <ErrorBoundary>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">CobraCheck Dashboard</h1>
          <button onClick={() => setShowNewClient(true)} className="px-4 py-2 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600">
            + Nuevo Cliente
          </button>
        </div>

        <Modal isOpen={showNewClient} title="Nuevo Cliente" onClose={() => setShowNewClient(false)} actions={<button type="submit" form="addClientForm" className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">Agregar</button>}>
          <form id="addClientForm" onSubmit={handleAddClient} className="space-y-3">
            <input name="name" placeholder="Nombre del cliente" required className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            <input name="rfc" placeholder="RFC (exacto 13 caracteres)" maxLength={13} required className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            <input name="email" placeholder="Email (opcional)" type="email" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            {newClientError && <p className="text-red-600 text-sm">{newClientError}</p>}
          </form>
        </Modal>

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
    </ErrorBoundary>
  )
}

export default function CobraCheckDashboardPage() {
  return <CobraCheckDashboard />
}
