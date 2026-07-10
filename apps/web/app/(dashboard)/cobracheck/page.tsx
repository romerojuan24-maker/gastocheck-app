'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function CobraCheckPage() {
  const router = useRouter()
  const [userRole, setUserRole] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [rutas, setRutas] = useState<any[]>([])
  const [movimientos, setMovimientos] = useState<any[]>([])
  const [reportes, setReportes] = useState<any[]>([])
  const [kpis, setKpis] = useState({
    totalCartera: 0,
    vencidos: 0,
    cobradoHoy: 0,
    promesasHoy: 0,
    clientesVisitados: 0,
  })
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clientes' | 'rutas' | 'movimientos'>('dashboard')
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)

  useEffect(() => {
    checkAuthAndLoad()
  }, [])

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setUnauthorized(true)
        return
      }

      // Obtener rol del usuario
      const { data: member } = await supabase
        .from('company_members')
        .select('company_id, role')
        .eq('user_id', session.user.id)
        .single()

      if (!member?.company_id) {
        setUnauthorized(true)
        return
      }

      // Admin, owner, superadmin y accountant pueden ver CobraCheck
      if (member.role !== 'admin' && member.role !== 'owner' && member.role !== 'superadmin' && member.role !== 'accountant') {
        setUnauthorized(true)
        return
      }

      setUserRole(member.role)
      setCompanyId(member.company_id)
      await loadCobraData(member.company_id)
    } catch (err) {
      console.error('Error:', err)
      setUnauthorized(true)
    } finally {
      setLoading(false)
    }
  }

  const loadCobraData = async (cid: string) => {
    try {
      const today = new Date().toISOString().split('T')[0]

      const [clientsRes, invoicesRes, routesRes, movementsRes, reportsRes] = await Promise.all([
        supabase.from('cobra_clients').select('*').eq('company_id', cid),
        supabase.from('cobra_invoices').select('*').eq('company_id', cid),
        supabase.from('cobra_routes').select('*').eq('company_id', cid).order('assigned_date', { ascending: false }),
        supabase.from('cobra_movements').select('*').eq('company_id', cid).order('movement_date', { ascending: false }),
        supabase.from('cobra_daily_reports').select('*').eq('company_id', cid).order('report_date', { ascending: false })
      ])

      const clients = (clientsRes.data || []) as any[]
      const invoices = (invoicesRes.data || []) as any[]
      const routes = (routesRes.data || []) as any[]
      const movements = (movementsRes.data || []) as any[]
      const reports = (reportsRes.data || []) as any[]

      setClientes(clients)
      setRutas(routes)
      setMovimientos(movements)
      setReportes(reports)

      // KPIs
      const totalCartera = invoices
        .filter(f => f.status !== 'paid' && f.status !== 'cancelled')
        .reduce((s, f) => s + (f.amount || 0), 0)

      const vencidos = invoices.filter(f => f.status === 'overdue').length

      const todayMovements = movements.filter(m => m.movement_date === today && m.status === 'paid')
      const cobradoHoy = todayMovements.reduce((s, m) => s + (m.amount || 0), 0)

      const promesasHoy = movements.filter(m => m.movement_date === today && m.status === 'promise').length

      const todayRoute = routes.find(r => r.assigned_date === today)
      const clientesVisitados = todayRoute?.clients_visited || 0

      setKpis({ totalCartera, vencidos, cobradoHoy, promesasHoy, clientesVisitados })
    } catch (err) {
      console.error('Error loading data:', err)
    }
  }

  if (loading) return <div className="p-6 text-center">Cargando...</div>

  if (unauthorized) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 font-bold">🔒 Acceso denegado</p>
          <p className="text-red-600 text-sm mt-2">Solo administradores pueden acceder a CobraCheck</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-black text-slate-900">🎯 CobraCheck</h1>
        <p className="text-slate-500 text-sm mt-1">Gestión de cobranza, rutas y desempeño de cobradores</p>
      </div>

      {/* KPIs Dashboard */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
          <p className="text-xs text-slate-600 font-semibold mb-1">Cartera Vigente</p>
          <p className="text-2xl font-black text-orange-600">${(kpis.totalCartera / 1000).toFixed(1)}k</p>
          <p className="text-xs text-slate-500 mt-2">{clientes.length} clientes</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
          <p className="text-xs text-slate-600 font-semibold mb-1">Vencidas</p>
          <p className="text-2xl font-black text-red-600">{kpis.vencidos}</p>
          <p className="text-xs text-slate-500 mt-2">facturas</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
          <p className="text-xs text-slate-600 font-semibold mb-1">Cobrado Hoy</p>
          <p className="text-2xl font-black text-emerald-600">${(kpis.cobradoHoy / 1000).toFixed(1)}k</p>
          <p className="text-xs text-slate-500 mt-2">{kpis.clientesVisitados} clientes</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
          <p className="text-xs text-slate-600 font-semibold mb-1">Promesas</p>
          <p className="text-2xl font-black text-blue-600">{kpis.promesasHoy}</p>
          <p className="text-xs text-slate-500 mt-2">hoy</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
          <p className="text-xs text-slate-600 font-semibold mb-1">Rutas Activas</p>
          <p className="text-2xl font-black text-purple-600">{rutas.filter(r => r.status === 'in_progress').length}</p>
          <p className="text-xs text-slate-500 mt-2">en progreso</p>
        </div>
      </div>

      {/* 4 Botones Principales */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <button
          onClick={() => setActiveTab('dashboard')}
          className="bg-green-50 border-2 border-green-600 rounded-lg p-6 text-center hover:bg-green-100 transition"
        >
          <div className="text-4xl mb-2">💰</div>
          <p className="font-bold text-sm text-slate-900">CARTERA TOTAL</p>
          <p className="text-2xl font-black text-green-600 mt-2">${(kpis.totalCartera / 1000).toFixed(1)}k</p>
          <p className="text-xs text-slate-600 mt-1">{clientes.length} clientes</p>
        </button>

        <button
          onClick={() => setActiveTab('clientes')}
          className="bg-red-50 border-2 border-red-600 rounded-lg p-6 text-center hover:bg-red-100 transition"
        >
          <div className="text-4xl mb-2">📄</div>
          <p className="font-bold text-sm text-slate-900">COMPROBANTES</p>
          <p className="text-2xl font-black text-red-600 mt-2">{kpis.vencidos}</p>
          <p className="text-xs text-slate-600 mt-1">facturas vencidas</p>
        </button>

        <button
          onClick={() => setActiveTab('rutas')}
          className="bg-blue-50 border-2 border-blue-600 rounded-lg p-6 text-center hover:bg-blue-100 transition"
        >
          <div className="text-4xl mb-2">📋</div>
          <p className="font-bold text-sm text-slate-900">TAREAS DE HOY</p>
          <p className="text-2xl font-black text-blue-600 mt-2">Mi Ruta</p>
          <p className="text-xs text-slate-600 mt-1">cobranza de hoy</p>
        </button>

        <button
          onClick={() => setActiveTab('movimientos')}
          className="bg-pink-50 border-2 border-pink-600 rounded-lg p-6 text-center hover:bg-pink-100 transition"
        >
          <div className="text-4xl mb-2">💳</div>
          <p className="font-bold text-sm text-slate-900">PAGOS</p>
          <p className="text-2xl font-black text-pink-600 mt-2">Registrar</p>
          <p className="text-xs text-slate-600 mt-1">movimientos</p>
        </button>
      </div>

      {/* Tabs (hidden, but keep for tab switching) */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 hidden">
        {(['dashboard', 'clientes', 'rutas', 'movimientos'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-5 py-3 font-bold text-sm transition ${
              activeTab === t
                ? 'text-orange-600 border-b-2 border-orange-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'dashboard' ? '📊 Dashboard' : t === 'clientes' ? '👥 Clientes' : t === 'rutas' ? '🗺️ Rutas' : '✓ Movimientos'}
          </button>
        ))}
      </div>

      {/* Dashboard */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Clientes en Riesgo */}
          {clientes.filter(c => c.risk_score >= 70).length > 0 && (
            <div className="bg-red-50 border-l-4 border-red-600 rounded-lg p-6">
              <h2 className="text-lg font-bold text-red-900 mb-3">
                🔴 {clientes.filter(c => c.risk_score >= 70).length} Clientes en Riesgo Alto
              </h2>
              <div className="space-y-2">
                {clientes
                  .filter(c => c.risk_score >= 70)
                  .sort((a, b) => b.risk_score - a.risk_score)
                  .slice(0, 5)
                  .map(c => (
                    <div key={c.id} className="bg-white rounded-lg border border-red-200 p-4 flex justify-between items-center hover:border-red-300 transition">
                      <div>
                        <p className="font-bold text-slate-900">{c.name}</p>
                        <p className="text-sm text-red-600 font-bold">Riesgo: {c.risk_score}%</p>
                      </div>
                      <p className="font-black text-red-600">${(c.total_overdue || 0).toLocaleString('es-MX')}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">Reportes Recientes</h2>
            <div className="space-y-2">
              {reportes.slice(0, 3).map(r => (
                <div key={r.id} className="bg-white rounded-lg border border-slate-200 p-4 flex justify-between items-center hover:border-slate-300 transition">
                  <div>
                    <p className="font-semibold text-slate-900">{new Date(r.report_date).toLocaleDateString('es-MX')}</p>
                    <p className="text-sm text-slate-500">{r.clients_visited} clientes visitados</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-emerald-600">${r.total_collected?.toLocaleString('es-MX')}</p>
                    <p className="text-xs text-slate-500">{r.total_promised?.toLocaleString('es-MX')} promesas</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Integración con Contador y Flujo Check */}
          <div className="bg-green-50 border-l-4 border-green-600 rounded-lg p-6">
            <p className="text-green-900 font-bold">📊 Integración activa</p>
            <p className="text-sm text-green-800 mt-2">Todos los movimientos se reflejan automáticamente en Contador y Flujo Check</p>
          </div>
        </div>
      )}

      {/* Clientes */}
      {activeTab === 'clientes' && (
        <div className="space-y-3">
          {clientes.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <p className="text-slate-500">Sin datos de clientes</p>
            </div>
          ) : (
            clientes.map(c => (
              <div key={c.id} className="bg-white rounded-lg border border-slate-200 p-4 flex justify-between items-center hover:border-slate-300 transition">
                <div>
                  <p className="font-bold text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.phone} • {c.address?.split(',')[0]}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-orange-600">${(c.total_overdue || 0).toLocaleString('es-MX')}</p>
                  <p className={`text-xs font-bold mt-1 ${
                    (c.risk_score || 0) >= 90 ? 'text-red-600' :
                    (c.risk_score || 0) >= 70 ? 'text-orange-600' :
                    'text-green-600'
                  }`}>
                    Riesgo: {c.risk_score || 0}%
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Rutas */}
      {activeTab === 'rutas' && (
        <div className="space-y-3">
          {rutas.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <p className="text-slate-500">Sin rutas</p>
            </div>
          ) : (
            rutas.map(r => (
              <div key={r.id} className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-slate-900">{new Date(r.assigned_date).toLocaleDateString('es-MX')}</p>
                    <p className="text-xs text-slate-500">
                      {r.status === 'completed' && '✓ Completada'}
                      {r.status === 'in_progress' && '🔄 En progreso'}
                      {r.status === 'planned' && '📋 Planeada'}
                    </p>
                  </div>
                  <p className={`px-2 py-1 rounded text-xs font-bold ${
                    r.route_priority === 'crítica' ? 'bg-red-100 text-red-700' :
                    r.route_priority === 'alta' ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {r.route_priority}
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div><p className="text-slate-500">Clientes</p><p className="font-bold">{r.clients_visited || 0}</p></div>
                  <div><p className="text-slate-500">Cobrado</p><p className="font-bold text-emerald-600">${(r.payments_collected || 0).toLocaleString('es-MX')}</p></div>
                  <div><p className="text-slate-500">Promesas</p><p className="font-bold text-blue-600">{r.promises_made || 0}</p></div>
                  <div><p className="text-slate-500">Km</p><p className="font-bold">{r.total_distance_km || 0}</p></div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Movimientos */}
      {activeTab === 'movimientos' && (
        <div className="space-y-3">
          {movimientos.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <p className="text-slate-500">Sin movimientos</p>
            </div>
          ) : (
            movimientos.slice(0, 20).map(m => (
              <div key={m.id} className="bg-white rounded-lg border border-slate-200 p-3 text-sm hover:border-slate-300 transition">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-900">
                      {m.status === 'paid' && '✓'}
                      {m.status === 'promise' && '🤝'}
                      {m.status === 'unpaid' && '✕'} {m.amount?.toLocaleString('es-MX')}
                    </p>
                    <p className="text-xs text-slate-500">{new Date(m.movement_date).toLocaleDateString('es-MX')} • {m.method || 'N/A'}</p>
                  </div>
                  <p className={`font-bold text-xs ${
                    m.status === 'paid' ? 'text-emerald-600' :
                    m.status === 'promise' ? 'text-blue-600' :
                    'text-red-600'
                  }`}>
                    {m.status === 'paid' ? 'Pagado' : m.status === 'promise' ? 'Promesa' : 'No pagó'}
                  </p>
                </div>
                {m.notes && <p className="text-xs text-slate-500 mt-2 italic">{m.notes}</p>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
