'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const money = (n: number | null | undefined) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n ?? 0)

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

interface Stats {
  totalComprobantes: number
  totalMontoCob: number
  rebPendientes: number
  rebMontoP: number
  polizasCerradas: number
  polizasMonto: number
  viaticosActivos: number
  viaticosEnviados: number
}

interface BuyerRow {
  employee_id: string
  employee_email: string
  count: number
  total: number
  captured: number
}

interface RebRow {
  id: string
  employee_email: string
  name: string | null
  total: number
  status: string
  created_at: string
}

type Tab = 'resumen' | 'reembolsos' | 'compradores'

export default function ContadorGeneralPanel() {
  const router = useRouter()
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState<Tab>('resumen')
  const [stats, setStats]         = useState<Stats | null>(null)
  const [buyers, setBuyers]       = useState<BuyerRow[]>([])
  const [reembolsos, setReb]      = useState<RebRow[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        console.log('📊 Iniciando carga de contador-general...')
        const u = await getSessionUser()
        if (!u) { router.push('/login'); return }
        if (!['owner', 'admin', 'accountant', 'contador_general'].includes(u.role ?? '')) {
          console.warn('⚠️ Rol insuficiente:', u.role)
          router.replace('/gastocheck')
          return
        }
        const cid = u.company_id
        console.log('✅ Usuario autenticado, company_id:', cid)

        // Comprobantes capturados
        console.log('📥 Cargando comprobantes...')
        const { data: cobData } = await supabase
          .from('receipts')
          .select('id, total_amount, status, employee_id, uploaded_by')
          .eq('company_id', cid)
          .neq('status', 'deleted')

        const cobs = cobData ?? []
        console.log('✅ Comprobantes cargados:', cobs.length)
        const totalMontoCob = cobs.reduce((s: number, r: any) => s + (r.total_amount ?? 0), 0)
        const captured = cobs.filter((r: any) => r.status === 'captured').length

        // Reembolsos (con timeout de 5s para evitar bloqueos)
        console.log('📋 Cargando reembolsos...')
        let rebAll: any[] | null = null
        let rebError: any = null
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 5000)

          const result = await supabase
            .from('reembolsos')
            .select('id, employee_id, employee_email, name, total, status, created_at')
            .eq('company_id', cid)

          clearTimeout(timeout)
          rebAll = result.data
          rebError = result.error
        } catch (e) {
          console.warn('⚠️ Timeout o error en reembolsos, usando fallback')
          rebAll = []
          rebError = e
        }

        if (rebError) {
          console.error('❌ Error cargando reembolsos:', rebError?.message, rebError?.code)
        }
        console.log('✅ Reembolsos cargados:', rebAll?.length ?? 0)

        const rebs = (rebAll ?? []) as any[]
        const rebPendientes = rebs.filter((r: any) => r.status === 'pending_auth')
        const rebMontoP = rebPendientes.reduce((s: number, r: any) => s + (r.total ?? 0), 0)

        // Pólizas cerradas
        console.log('📒 Cargando pólizas...')
        const { data: polData } = await supabase
          .from('policies')
          .select('id, opening_balance')
          .eq('company_id', cid)
          .eq('status', 'closed')

        const pols = polData ?? []
        console.log('✅ Pólizas cargadas:', pols.length)
        const polizasMonto = pols.reduce((s: number, p: any) => s + (p.opening_balance ?? 0), 0)

        // Viáticos
        console.log('✈️ Cargando viáticos...')
        const { data: viatData } = await supabase
          .from('viaticos')
          .select('id, status')
          .eq('company_id', cid)

        const viats = viatData ?? []
        console.log('✅ Viáticos cargados:', viats.length)

        setStats({
          totalComprobantes: cobs.length,
          totalMontoCob,
          rebPendientes: rebPendientes.length,
          rebMontoP,
          polizasCerradas: pols.length,
          polizasMonto,
          viaticosActivos: viats.filter((v: any) => v.status === 'draft').length,
          viaticosEnviados: viats.filter((v: any) => v.status === 'submitted').length,
        })

        // Reembolsos para tab
        setReb(rebs as RebRow[])

        // Compradores (agrupar comprobantes por employee_id)
        console.log('👥 Procesando compradores...')
        const buyerMap: Record<string, BuyerRow> = {}
        for (const r of cobs as any[]) {
          const eid = r.employee_id ?? r.uploaded_by ?? 'unknown'
          if (!buyerMap[eid]) buyerMap[eid] = { employee_id: eid, employee_email: '', count: 0, total: 0, captured: 0 }
          buyerMap[eid].count++
          buyerMap[eid].total += r.total_amount ?? 0
          if (r.status === 'captured') buyerMap[eid].captured++
        }

        // Enriquecer con email
        if (Object.keys(buyerMap).length > 0) {
          const { data: members } = await supabase
            .from('company_members')
            .select('user_id, profiles(email)')
            .eq('company_id', cid)
            .in('user_id', Object.keys(buyerMap))

          for (const m of (members ?? []) as any[]) {
            if (buyerMap[m.user_id]) {
              buyerMap[m.user_id].employee_email = m.profiles?.email ?? m.user_id.slice(0, 8)
            }
          }
        }

        setBuyers(
          Object.values(buyerMap)
            .sort((a, b) => b.total - a.total)
            .slice(0, 20)
        )

        console.log('🎉 Contador-general cargado exitosamente')
        setLoading(false)
      } catch (err) {
        console.error('💥 Error fatal en contador-general:', err)
        setLoading(false)
      }
    }
    load()
  }, [router])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-slate-400">Cargando panel...</p>
    </div>
  )

  const TABS: { key: Tab; label: string }[] = [
    { key: 'resumen',     label: '📊 Resumen' },
    { key: 'reembolsos',  label: `📋 Reembolsos${stats?.rebPendientes ? ` (${stats.rebPendientes} pendientes)` : ''}` },
    { key: 'compradores', label: '👥 Por comprador' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Panel Contador General</h1>
        <p className="text-slate-500 mt-1">Vista ejecutiva de gastos, reembolsos y pólizas</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2
              ${tab === t.key
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Resumen ─────────────────────────────────────────────────────── */}
      {tab === 'resumen' && stats && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Comprobantes</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{stats.totalComprobantes}</p>
              <p className="text-sm text-slate-500 mt-1">{money(stats.totalMontoCob)}</p>
            </div>
            <div className={`bg-white rounded-xl border p-5 ${stats.rebPendientes > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Reembolsos pendientes</p>
              <p className={`text-3xl font-bold mt-1 ${stats.rebPendientes > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                {stats.rebPendientes}
              </p>
              <p className="text-sm text-slate-500 mt-1">{money(stats.rebMontoP)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pólizas cerradas</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{stats.polizasCerradas}</p>
              <p className="text-sm text-slate-500 mt-1">{money(stats.polizasMonto)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Viáticos</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{stats.viaticosActivos + stats.viaticosEnviados}</p>
              <p className="text-sm text-slate-500 mt-1">
                {stats.viaticosActivos} activos · {stats.viaticosEnviados} enviados
              </p>
            </div>
          </div>

          {/* Accesos rápidos */}
          {stats.rebPendientes > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="font-semibold text-amber-900">
                  ⏳ {stats.rebPendientes} reembolso(s) esperando tu revisión
                </p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Total pendiente: {money(stats.rebMontoP)}
                </p>
              </div>
              <button
                onClick={() => setTab('reembolsos')}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition"
              >
                Revisar →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Reembolsos ──────────────────────────────────────────────────── */}
      {tab === 'reembolsos' && (
        <div className="space-y-3">
          {reembolsos.length === 0 ? (
            <div className="text-center py-20 text-slate-400">Sin reembolsos registrados</div>
          ) : reembolsos.map(r => {
            const statusColor: Record<string, string> = {
              draft:        'bg-slate-100 text-slate-600',
              pending_auth: 'bg-amber-100 text-amber-800',
              closed:       'bg-green-100 text-green-800',
              rejected:     'bg-red-100 text-red-800',
            }
            const statusLabel: Record<string, string> = {
              draft:        '✏️ Borrador',
              pending_auth: '⏳ Pendiente',
              closed:       '✅ Cerrado',
              rejected:     '❌ Rechazado',
            }
            return (
              <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">
                      {r.name ?? r.employee_email}
                    </p>
                    <p className="text-sm text-slate-500 mt-0.5">{r.employee_email}</p>
                    <p className="text-xs text-slate-400 mt-1">{fmtDate(r.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="text-xl font-bold text-slate-900">{money(r.total)}</p>
                    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[r.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {statusLabel[r.status] ?? r.status}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Tab: Compradores ─────────────────────────────────────────────────── */}
      {tab === 'compradores' && (
        buyers.length === 0 ? (
          <div className="text-center py-20 text-slate-400">Sin comprobantes registrados</div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Comprador</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Comprobantes</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Monto total</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Sin procesar</th>
                </tr>
              </thead>
              <tbody>
                {buyers.map(b => (
                  <tr key={b.employee_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900 truncate max-w-xs">
                      {b.employee_email || b.employee_id.slice(0, 8) + '...'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{b.count}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{money(b.total)}</td>
                    <td className="px-4 py-3 text-right">
                      {b.captured > 0
                        ? <span className="text-amber-600 font-semibold">{b.captured}</span>
                        : <span className="text-green-600">✓</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
