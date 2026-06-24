'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ComprobantesPage() {
  const [comprobantes, setComprobantes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('vigentes')

  useEffect(() => {
    const fetchComprobantes = async () => {
      const { data, error } = await supabase
        .from('v_expenses_with_traceability')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) console.error('Error:', error)
      else setComprobantes(data || [])
      setLoading(false)
    }

    fetchComprobantes()
  }, [])

  // FIX: Filtrar por policy_status (no expense_status)
  // Vigentes = en póliza abierta
  // Históricos = en póliza cerrada
  const vigentes = comprobantes.filter((c) => c.policy_status === 'open')
  const enRevision = comprobantes.filter((c) => c.policy_status === 'open' && c.comprobante_status === 'pending_auth')
  const historicos = comprobantes.filter((c) => c.policy_status === 'closed')

  const statusColor = (status: string) => {
    switch (status) {
      case 'captured':
        return 'bg-blue-50 border-blue-200'
      case 'pending_auth':
        return 'bg-yellow-50 border-yellow-200'
      case 'invoice_applied':
        return 'bg-green-50 border-green-200'
      case 'closed_in_policy':
        return 'bg-gray-50 border-gray-200'
      default:
        return 'bg-slate-50 border-slate-200'
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'captured':
        return 'Capturado'
      case 'pending_auth':
        return 'En revisión'
      case 'invoice_applied':
        return 'Facturado'
      case 'closed_in_policy':
        return 'Cerrado'
      default:
        return status
    }
  }

  const ComprobantesCard = ({ items, empty }: { items: any[]; empty: string }) => {
    if (items.length === 0) {
      return (
        <div className="p-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">
          <p className="text-lg">{empty}</p>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {items.map((item) => (
          <Link
            key={item.comprobante_id}
            href={`/gastocheck/comprobantes/${item.comprobante_id}`}
          >
            <div className={`border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow ${statusColor(item.comprobante_status)}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">
                    {item.provider_name || 'Sin proveedor'}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Fecha: {new Date(item.fecha_gasto || Date.now()).toLocaleDateString('es-MX')}
                  </p>
                  {item.poliza_name && (
                    <p className="text-sm text-slate-700 mt-1">
                      📋 Póliza: <span className="font-medium">{item.poliza_name}</span>
                    </p>
                  )}
                  {!item.poliza_name && (
                    <p className="text-sm text-orange-600 mt-1">
                      ⚠ Sin póliza asignada
                    </p>
                  )}
                  {item.cfdi_uuid && (
                    <p className="text-sm text-green-700 mt-1">
                      ✓ Con CFDI ({item.cfdi_uuid.slice(0, 8)}...)
                    </p>
                  )}
                  {!item.cfdi_uuid && (
                    <p className="text-sm text-orange-600 mt-1">
                      ⚠ Sin CFDI timbrado
                    </p>
                  )}
                </div>

                <div className="text-right whitespace-nowrap">
                  <p className="text-lg font-bold text-slate-900">
                    ${item.monto?.toLocaleString('es-MX', { maximumFractionDigits: 2 }) || '0.00'}
                  </p>
                  <span className="inline-block mt-2 px-3 py-1 text-xs font-semibold rounded-full bg-white border">
                    {statusLabel(item.comprobante_status)}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-600">Cargando comprobantes...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Mis Comprobantes</h1>
        <p className="text-slate-600 mt-2">
          Visualiza, gestiona y da seguimiento a tus gastos y comprobantes
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-sm font-medium text-slate-600">Vigentes</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{vigentes.length}</p>
          <p className="text-xs text-slate-500 mt-1">Capturados y sin autorizar</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-sm font-medium text-slate-600">En revisión</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">{enRevision.length}</p>
          <p className="text-xs text-slate-500 mt-1">Pendiente de autorización</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-sm font-medium text-slate-600">Históricos</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{historicos.length}</p>
          <p className="text-xs text-slate-500 mt-1">Facturados o cerrados</p>
        </div>
      </div>

      <div>
        <div className="flex gap-2 border-b border-slate-200">
          {[
            { id: 'vigentes', label: `Vigentes (${vigentes.length})`, icon: '⏱️' },
            { id: 'revision', label: `En revisión (${enRevision.length})`, icon: '⚠️' },
            { id: 'historicos', label: `Históricos (${historicos.length})`, icon: '✓' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-slate-900 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {activeTab === 'vigentes' && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Comprobantes Vigentes</h2>
              <ComprobantesCard
                items={vigentes}
                empty="No hay comprobantes vigentes. ¡Captura uno nuevo!"
              />
            </div>
          )}

          {activeTab === 'revision' && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">En Revisión</h2>
              <ComprobantesCard
                items={enRevision}
                empty="No hay comprobantes en revisión"
              />
            </div>
          )}

          {activeTab === 'historicos' && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Históricos</h2>
              <ComprobantesCard
                items={historicos}
                empty="No hay comprobantes históricos"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
