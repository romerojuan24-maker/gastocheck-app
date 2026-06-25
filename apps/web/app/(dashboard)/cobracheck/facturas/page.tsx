'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase, getSessionUser } from '@/lib/supabase'

interface Cliente { id: string; name: string }
interface Factura {
  id: string
  client_id: string
  folio: string
  uuid_sat: string | null
  amount: number
  subtotal: number | null
  tax: number | null
  issue_date: string
  due_date: string
  payment_date: string | null
  status: string
  days_overdue: number | null
}
interface Pago {
  id: string
  invoice_id: string
  amount: number
  payment_date: string
  method: string | null
  reference: string | null
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', partial: 'Parcial', paid: 'Pagada', overdue: 'Vencida', cancelled: 'Cancelada',
}
const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800', partial: 'bg-indigo-100 text-indigo-800',
  paid: 'bg-emerald-100 text-emerald-800', overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-200 text-slate-600',
}
const METHOD_LABEL: Record<string, string> = {
  cash: 'Efectivo', transfer: 'Transferencia', check: 'Cheque', credit_card: 'Tarjeta', other: 'Otro',
}

const money = (n: number | null) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
const today = () => new Date().toISOString().slice(0, 10)

const EMPTY: Partial<Factura> = { folio: '', amount: 0, issue_date: today(), due_date: today(), status: 'pending' }

export default function CobraFacturasPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [rows, setRows] = useState<Factura[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pendientes' | 'pagadas' | 'todas'>('pendientes')
  const [editing, setEditing] = useState<Partial<Factura> | null>(null)
  const [paying, setPaying] = useState<Factura | null>(null)
  const [payForm, setPayForm] = useState<{ amount: number; method: string; reference: string; payment_date: string }>({ amount: 0, method: 'transfer', reference: '', payment_date: today() })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (cid: string) => {
    const [invRes, cliRes, payRes] = await Promise.all([
      supabase.from('cobra_invoices').select('*').eq('company_id', cid).order('due_date', { ascending: true }),
      supabase.from('cobra_clients').select('id, name').eq('company_id', cid).order('name'),
      supabase.from('cobra_payments').select('*').eq('company_id', cid),
    ])
    setRows((invRes.data as Factura[]) ?? [])
    setClientes((cliRes.data as Cliente[]) ?? [])
    setPagos((payRes.data as Pago[]) ?? [])
  }, [])

  useEffect(() => {
    (async () => {
      const u = await getSessionUser()
      if (u?.company_id) { setCompanyId(u.company_id); await load(u.company_id) }
      setLoading(false)
    })()
  }, [load])

  const clientName = useCallback((id: string) => clientes.find((c) => c.id === id)?.name ?? '—', [clientes])
  const paidFor = useCallback((invId: string) => pagos.filter((p) => p.invoice_id === invId).reduce((s, p) => s + Number(p.amount), 0), [pagos])

  async function save() {
    if (!companyId || !editing) return
    if (!editing.client_id) { alert('Selecciona un cliente'); return }
    if (!editing.folio?.trim() || !editing.amount || !editing.due_date) { alert('Folio, monto y vencimiento son obligatorios'); return }
    setSaving(true)
    const payload = {
      company_id: companyId,
      client_id: editing.client_id,
      folio: editing.folio.trim(),
      uuid_sat: editing.uuid_sat?.trim() || null,
      amount: Number(editing.amount),
      subtotal: editing.subtotal != null ? Number(editing.subtotal) : null,
      tax: editing.tax != null ? Number(editing.tax) : null,
      issue_date: editing.issue_date || today(),
      due_date: editing.due_date,
      status: editing.status || 'pending',
    }
    const res = editing.id
      ? await supabase.from('cobra_invoices').update(payload).eq('id', editing.id)
      : await supabase.from('cobra_invoices').insert(payload)
    setSaving(false)
    if (res.error) { alert('Error: ' + res.error.message); return }
    setEditing(null)
    await load(companyId)
  }

  async function remove(id: string) {
    if (!companyId || !confirm('¿Eliminar esta factura y sus pagos?')) return
    const { error } = await supabase.from('cobra_invoices').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    await load(companyId)
  }

  function openPay(f: Factura) {
    const pending = Number(f.amount) - paidFor(f.id)
    setPayForm({ amount: pending > 0 ? pending : 0, method: 'transfer', reference: '', payment_date: today() })
    setPaying(f)
  }

  async function registerPayment() {
    if (!companyId || !paying) return
    if (!payForm.amount || payForm.amount <= 0) { alert('El monto del pago debe ser mayor a cero'); return }
    setSaving(true)
    const { error: payErr } = await supabase.from('cobra_payments').insert({
      company_id: companyId,
      invoice_id: paying.id,
      client_id: paying.client_id,
      amount: Number(payForm.amount),
      payment_date: payForm.payment_date,
      method: payForm.method,
      reference: payForm.reference || null,
    })
    if (payErr) { setSaving(false); alert('Error: ' + payErr.message); return }

    // Actualiza estado de la factura según total cobrado
    const newPaid = paidFor(paying.id) + Number(payForm.amount)
    const newStatus = newPaid >= Number(paying.amount) ? 'paid' : 'partial'
    await supabase.from('cobra_invoices').update({
      status: newStatus,
      payment_date: newStatus === 'paid' ? payForm.payment_date : null,
    }).eq('id', paying.id)

    setSaving(false)
    setPaying(null)
    await load(companyId)
  }

  const visible = useMemo(() => rows.filter((r) =>
    filter === 'todas' ? true : filter === 'pagadas' ? r.status === 'paid' : !['paid', 'cancelled'].includes(r.status)
  ), [rows, filter])

  const totalPorCobrar = rows.filter((r) => !['paid', 'cancelled'].includes(r.status)).reduce((s, r) => s + (Number(r.amount) - paidFor(r.id)), 0)
  const vencidas = rows.filter((r) => !['paid', 'cancelled'].includes(r.status) && r.due_date < today()).length

  if (loading) return <div className="flex items-center justify-center h-96 text-slate-600">Cargando…</div>

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <a href="/cobracheck" className="text-xs font-semibold text-slate-400 hover:text-slate-600">← CobraCheck</a>
          <h1 className="text-3xl font-black text-slate-900 mt-1">📑 Facturas por cobrar</h1>
          <p className="text-slate-500 mt-1">Emite, edita y registra pagos de tus facturas</p>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })} disabled={clientes.length === 0}
          className="px-4 py-2 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 text-sm whitespace-nowrap disabled:opacity-50">
          + Nueva factura
        </button>
      </div>

      {clientes.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Necesitas al menos un cliente para emitir facturas. <a href="/clientes" className="font-semibold underline">Crear cliente →</a>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Total por cobrar" value={money(totalPorCobrar)} color="text-emerald-600" />
        <Kpi label="Vencidas" value={vencidas} color="text-red-600" />
        <Kpi label="Total facturas" value={rows.length} color="text-slate-700" />
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {(['pendientes', 'pagadas', 'todas'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors ${filter === f ? 'text-slate-900 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-900'}`}>
            {f}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="p-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">No hay facturas {filter !== 'todas' && filter}.</div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left p-3">Folio / Cliente</th>
                <th className="text-right p-3">Monto</th>
                <th className="text-right p-3">Cobrado</th>
                <th className="text-center p-3">Vence</th>
                <th className="text-center p-3">Estado</th>
                <th className="text-right p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const paid = paidFor(r.id)
                const overdue = !['paid', 'cancelled'].includes(r.status) && r.due_date < today()
                return (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="p-3">
                      <div className="font-medium text-slate-900">{r.folio}</div>
                      <div className="text-xs text-slate-400">{clientName(r.client_id)}</div>
                    </td>
                    <td className="p-3 text-right font-semibold text-slate-900">{money(r.amount)}</td>
                    <td className="p-3 text-right text-slate-600">{money(paid)}</td>
                    <td className={`p-3 text-center ${overdue ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                      {new Date(r.due_date).toLocaleDateString('es-MX')}{overdue && ' ⚠'}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {r.status !== 'paid' && r.status !== 'cancelled' && (
                        <button onClick={() => openPay(r)} className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold mr-3">Cobrar</button>
                      )}
                      <button onClick={() => setEditing(r)} className="text-blue-600 hover:text-blue-800 text-xs font-semibold mr-3">Editar</button>
                      <button onClick={() => remove(r.id)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Borrar</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal factura */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">{editing.id ? 'Editar' : 'Nueva'} factura</h2>
            <Field label="Cliente *">
              <select className="inp" value={editing.client_id ?? ''} onChange={(e) => setEditing({ ...editing, client_id: e.target.value })}>
                <option value="">— Selecciona —</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Folio *"><input className="inp" value={editing.folio ?? ''} onChange={(e) => setEditing({ ...editing, folio: e.target.value })} /></Field>
              <Field label="UUID SAT (opcional)"><input className="inp" value={editing.uuid_sat ?? ''} onChange={(e) => setEditing({ ...editing, uuid_sat: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Subtotal"><input type="number" step="0.01" className="inp" value={editing.subtotal ?? ''} onChange={(e) => setEditing({ ...editing, subtotal: Number(e.target.value) })} /></Field>
              <Field label="IVA"><input type="number" step="0.01" className="inp" value={editing.tax ?? ''} onChange={(e) => setEditing({ ...editing, tax: Number(e.target.value) })} /></Field>
              <Field label="Total *"><input type="number" step="0.01" className="inp" value={editing.amount ?? ''} onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Emisión"><input type="date" className="inp" value={editing.issue_date ?? ''} onChange={(e) => setEditing({ ...editing, issue_date: e.target.value })} /></Field>
              <Field label="Vencimiento *"><input type="date" className="inp" value={editing.due_date ?? ''} onChange={(e) => setEditing({ ...editing, due_date: e.target.value })} /></Field>
            </div>
            <Field label="Estado">
              <select className="inp" value={editing.status ?? 'pending'} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <div className="flex gap-2 pt-2">
              <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
              <button onClick={() => setEditing(null)} className="px-4 py-2.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pago */}
      {paying && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setPaying(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">Registrar pago</h2>
            <p className="text-sm text-slate-500">{paying.folio} · {clientName(paying.client_id)}</p>
            <p className="text-xs text-slate-400">Saldo pendiente: {money(Number(paying.amount) - paidFor(paying.id))}</p>
            <Field label="Monto *"><input type="number" step="0.01" className="inp" value={payForm.amount || ''} onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Método">
                <select className="inp" value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
                  {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Fecha"><input type="date" className="inp" value={payForm.payment_date} onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })} /></Field>
            </div>
            <Field label="Referencia"><input className="inp" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} /></Field>
            <div className="flex gap-2 pt-2">
              <button onClick={registerPayment} disabled={saving} className="flex-1 py-2.5 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 disabled:opacity-50">{saving ? 'Guardando…' : 'Registrar pago'}</button>
              <button onClick={() => setPaying(null)} className="px-4 py-2.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancelar</button>
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
