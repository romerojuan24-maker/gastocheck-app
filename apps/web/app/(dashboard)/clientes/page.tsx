'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase, getSessionUser } from '@/lib/supabase'

interface Cliente {
  id: string
  name: string
  rfc: string | null
  email: string | null
  phone: string | null
  contact_name: string | null
  credit_limit: number | null
  current_balance: number | null
  risk_score: number | null
  status: string
  last_payment_date: string | null
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Activo', inactive: 'Inactivo', blacklist: 'Bloqueado',
}
const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  inactive: 'bg-slate-200 text-slate-600',
  blacklist: 'bg-red-100 text-red-700',
}

const EMPTY: Partial<Cliente> = {
  name: '', rfc: '', email: '', phone: '', contact_name: '',
  credit_limit: 0, status: 'active',
}

const money = (n: number | null) =>
  `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

export default function ClientesPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [rows, setRows] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'active' | 'inactive' | 'blacklist'>('todos')
  const [editing, setEditing] = useState<Partial<Cliente> | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (cid: string) => {
    const { data } = await supabase
      .from('cobra_clients')
      .select('*')
      .eq('company_id', cid)
      .order('name', { ascending: true })
    setRows((data as Cliente[]) ?? [])
  }, [])

  useEffect(() => {
    (async () => {
      const u = await getSessionUser()
      if (u?.company_id) { setCompanyId(u.company_id); await load(u.company_id) }
      setLoading(false)
    })()
  }, [load])

  async function save() {
    if (!companyId || !editing) return
    if (!editing.name?.trim()) { alert('El nombre del cliente es obligatorio'); return }
    setSaving(true)
    const payload = {
      company_id: companyId,
      name: editing.name.trim(),
      rfc: editing.rfc?.trim() || null,
      email: editing.email?.trim() || null,
      phone: editing.phone?.trim() || null,
      contact_name: editing.contact_name?.trim() || null,
      credit_limit: editing.credit_limit != null ? Number(editing.credit_limit) : null,
      status: editing.status || 'active',
    }
    const res = editing.id
      ? await supabase.from('cobra_clients').update(payload).eq('id', editing.id)
      : await supabase.from('cobra_clients').insert(payload)
    setSaving(false)
    if (res.error) { alert('Error: ' + res.error.message); return }
    setEditing(null)
    await load(companyId)
  }

  async function remove(id: string) {
    if (!companyId || !confirm('¿Eliminar este cliente? Se borrarán también sus facturas asociadas.')) return
    const { error } = await supabase.from('cobra_clients').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    await load(companyId)
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusFilter !== 'todos' && r.status !== statusFilter) return false
      if (!q) return true
      return [r.name, r.rfc, r.email, r.phone, r.contact_name]
        .some((f) => f?.toLowerCase().includes(q))
    })
  }, [rows, search, statusFilter])

  const totalCartera = rows.reduce((s, r) => s + (Number(r.current_balance) || 0), 0)
  const activos = rows.filter((r) => r.status === 'active').length

  if (loading) return <div className="flex items-center justify-center h-96 text-slate-600">Cargando…</div>

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">👥 Clientes</h1>
          <p className="text-slate-500 mt-1">Directorio de clientes — cobranza y facturación</p>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })}
          className="px-4 py-2 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 text-sm whitespace-nowrap">
          + Nuevo cliente
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Total clientes" value={rows.length} color="text-slate-700" />
        <Kpi label="Activos" value={activos} color="text-emerald-600" />
        <Kpi label="Cartera total" value={money(totalCartera)} color="text-blue-600" />
      </div>

      {/* Búsqueda + filtro */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, RFC, email o teléfono…"
            className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
          className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400">
          <option value="todos">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="blacklist">Bloqueados</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="p-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">
          {rows.length === 0 ? 'Aún no hay clientes. Crea el primero con “+ Nuevo cliente”.' : 'Ningún cliente coincide con la búsqueda.'}
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left p-3">Cliente</th>
                <th className="text-left p-3">Contacto</th>
                <th className="text-right p-3">Saldo</th>
                <th className="text-center p-3">Riesgo</th>
                <th className="text-center p-3">Estado</th>
                <th className="text-right p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="p-3">
                    <div className="font-medium text-slate-900">{r.name}</div>
                    {r.rfc && <div className="text-xs text-slate-400">{r.rfc}</div>}
                  </td>
                  <td className="p-3 text-slate-600">
                    {r.contact_name && <div>{r.contact_name}</div>}
                    <div className="text-xs text-slate-400">
                      {[r.phone, r.email].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </td>
                  <td className="p-3 text-right font-semibold text-slate-900">{money(r.current_balance)}</td>
                  <td className="p-3 text-center">
                    <span className={`font-semibold ${
                      (r.risk_score || 0) >= 80 ? 'text-red-600' :
                      (r.risk_score || 0) >= 60 ? 'text-orange-600' : 'text-emerald-600'
                    }`}>{r.risk_score || 0}</span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[r.status] ?? 'bg-slate-100 text-slate-700'}`}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button onClick={() => setEditing(r)} className="text-blue-600 hover:text-blue-800 text-xs font-semibold mr-3">Editar</button>
                    <button onClick={() => remove(r.id)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Borrar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal alta/edición */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">{editing.id ? 'Editar' : 'Nuevo'} cliente</h2>
            <Field label="Nombre / Razón social *"><input className="inp" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="RFC"><input className="inp" value={editing.rfc ?? ''} onChange={(e) => setEditing({ ...editing, rfc: e.target.value.toUpperCase() })} /></Field>
              <Field label="Contacto"><input className="inp" value={editing.contact_name ?? ''} onChange={(e) => setEditing({ ...editing, contact_name: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Teléfono"><input className="inp" value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></Field>
              <Field label="Email"><input type="email" className="inp" value={editing.email ?? ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Límite de crédito"><input type="number" step="0.01" className="inp" value={editing.credit_limit ?? ''} onChange={(e) => setEditing({ ...editing, credit_limit: Number(e.target.value) })} /></Field>
              <Field label="Estado">
                <select className="inp" value={editing.status ?? 'active'} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </div>
            {editing.id && (
              <p className="text-xs text-slate-400">
                Saldo actual {money(editing.current_balance ?? null)} · Último pago {editing.last_payment_date ? new Date(editing.last_payment_date).toLocaleDateString('es-MX') : '—'} (se actualizan con facturas y pagos)
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
              <button onClick={() => setEditing(null)} className="px-4 py-2.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`.inp{width:100%;border:1px solid #e2e8f0;border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem}.inp:focus{outline:none;box-shadow:0 0 0 2px #34d399}`}</style>
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs font-semibold text-slate-500 uppercase">{label}</p>
      <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-semibold text-slate-600 block mb-1">{label}</span>{children}</label>
}
