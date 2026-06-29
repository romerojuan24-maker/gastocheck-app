'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser, type UserRole } from '@/lib/supabase'
import { usePermissions } from '@/hooks/usePermissions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Poliza { id: string; name: string | null; status: string; closed_at: string | null }
interface Expense {
  id: string
  provider_name: string | null
  total: number | null
  expense_date: string | null
  status: string
  policy_id: string | null
  accounting_account_code: string | null
  is_viatico: boolean | null
  policies: Poliza | null
}

export default function ComprobantesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'vigentes' | 'revision' | 'historicos' | 'sinasignar'>('vigentes')
  const [role, setRole] = useState<UserRole | null>(null)
  const { canI } = usePermissions(role)

  useEffect(() => {
    (async () => {
      const u = await getSessionUser()
      if (!u?.company_id) { setLoading(false); return }
      if (u.role) setRole(u.role as UserRole)

      // Tablas base + embed de la póliza (estado real). Sin dependencia de vistas.
      const { data, error } = await supabase
        .from('expenses')
        .select('id, provider_name, total, expense_date, status, policy_id, accounting_account_code, is_viatico, policies(id, name, status, closed_at)')
        .eq('company_id', u.company_id)
        .order('expense_date', { ascending: false })

      if (error) console.error('Error cargando gastos:', error.message)
      else setExpenses((data as any) ?? [])
      setLoading(false)
    })()
  }, [])

  // Agrupación por ESTADO DE LA PÓLIZA (modelo correcto):
  const vigentes    = expenses.filter((e) => e.policies?.status === 'open')
  const historicos  = expenses.filter((e) => e.policies?.status === 'closed')
  const sinAsignar  = expenses.filter((e) => !e.policy_id || !e.policies)
  const enRevision  = expenses.filter((e) => e.status === 'pending_auth')

  const statusLabel: Record<string, string> = {
    captured: 'Capturado',
    pending_auth: 'En revisión',
    authorized: 'Autorizado',
    invoice_applied: 'Facturado',
    closed_in_policy: 'Cerrado',
    rejected: 'Rechazado',
  }
  const statusBadge: Record<string, string> = {
    pending_auth: 'bg-amber-100 text-amber-800',
    authorized: 'bg-emerald-100 text-emerald-800',
    invoice_applied: 'bg-green-100 text-green-800',
    closed_in_policy: 'bg-slate-200 text-slate-700',
    rejected: 'bg-red-100 text-red-700',
    captured: 'bg-blue-100 text-blue-800',
  }

  const List = ({ items, empty }: { items: Expense[]; empty: string }) => {
    if (items.length === 0) {
      return (
        <div className="p-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">
          {empty}
        </div>
      )
    }
    return (
      <div className="space-y-3">
        {items.map((e) => (
          <div key={e.id} className="border border-slate-200 bg-white rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">{e.provider_name || 'Sin proveedor'}</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {e.expense_date ? new Date(e.expense_date).toLocaleDateString('es-MX') : 'Sin fecha'}
                  {e.accounting_account_code && <> · Cuenta {e.accounting_account_code}</>}
                  {e.is_viatico && <> · 🧳 Viático</>}
                </p>
                {e.policies ? (
                  <p className="text-sm text-slate-700 mt-1">
                    📋 {e.policies.name || 'Póliza'}{' '}
                    <span className={`text-xs ${e.policies.status === 'closed' ? 'text-slate-500' : 'text-emerald-600'}`}>
                      ({e.policies.status === 'closed' ? 'cerrada' : 'abierta'})
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-amber-600 mt-1">⚠ Sin póliza asignada</p>
                )}
              </div>
              <div className="text-right whitespace-nowrap">
                <p className="text-lg font-bold text-slate-900">
                  ${(Number(e.total) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
                <span className={`inline-block mt-2 px-2.5 py-1 text-xs font-semibold rounded-full ${statusBadge[e.status] ?? 'bg-slate-100 text-slate-700'}`}>
                  {statusLabel[e.status] ?? e.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96 text-slate-600">Cargando comprobantes...</div>
  }

  const tabs = [
    { id: 'vigentes' as const, label: 'Vigentes', icon: '⏱️', count: vigentes.length, items: vigentes, empty: 'No hay comprobantes en pólizas abiertas.' },
    { id: 'revision' as const, label: 'En revisión', icon: '⚠️', count: enRevision.length, items: enRevision, empty: 'No hay comprobantes pendientes de autorización.' },
    { id: 'historicos' as const, label: 'Históricos', icon: '✓', count: historicos.length, items: historicos, empty: 'No hay comprobantes en pólizas cerradas.' },
    { id: 'sinasignar' as const, label: 'Sin asignar', icon: '🔌', count: sinAsignar.length, items: sinAsignar, empty: 'Todos los comprobantes están asignados a una póliza.' },
  ]
  const current = tabs.find((t) => t.id === activeTab)!

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Comprobantes</h1>
          <p className="text-slate-500 mt-1">Vigentes, en revisión, históricos y sin asignar — por estado de póliza</p>
        </div>
        {canI('comprobantes', 'create') && (
          <a href="/gastocheck/nuevo-comprobante"
            className="px-4 py-2 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 text-sm whitespace-nowrap">
            + Nuevo comprobante
          </a>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3">
        {tabs.map((t) => (
          <div key={t.id} className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs font-medium text-slate-500 uppercase">{t.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{t.count}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex gap-1 border-b border-slate-200 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-3 font-medium text-sm transition-colors ${
                activeTab === t.id ? 'text-slate-900 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {t.icon} {t.label} ({t.count})
            </button>
          ))}
        </div>
        <div className="mt-6">
          <List items={current.items} empty={current.empty} />
        </div>
      </div>
    </div>
  )
}
