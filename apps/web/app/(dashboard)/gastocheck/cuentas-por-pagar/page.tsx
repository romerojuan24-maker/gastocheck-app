'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface AP {
  id: string
  supplier_name: string
  supplier_rfc: string | null
  concept: string
  invoice_folio: string | null
  amount: number
  paid_amount: number
  issue_date: string | null
  due_date: string
  status: string
  accounting_account_code: string | null
  notes: string | null
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', scheduled: 'Programada', partial: 'Parcial', paid: 'Pagada', cancelled: 'Cancelada',
}
const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800', scheduled: 'bg-blue-100 text-blue-800',
  partial: 'bg-indigo-100 text-indigo-800', paid: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-200 text-slate-600',
}

const EMPTY: Partial<AP> = { supplier_name: '', concept: '', amount: 0, due_date: '', status: 'pending' }

export default function CuentasPorPagarPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [rows, setRows] = useState<AP[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pendientes' | 'pagadas' | 'todas'>('pendientes')
  const [editing, setEditing] = useState<Partial<AP> | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (cid: string) => {
    const { data } = await supabase
      .from('accounts_payable')
      .select('*')
      .eq('company_id', cid)
      .order('due_date', { ascending: true })
    setRows((data as AP[]) ?? [])
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
    if (!editing.supplier_name || !editing.concept || !editing.due_date || !editing.amount) {
      alert('Proveedor, concepto, monto y fecha de vencimiento son obligatorios'); return
    }
    setSaving(true)
    const payload = {
      company_id: companyId,
      supplier_name: editing.supplier_name,
      supplier_rfc: editing.supplier_rfc || null,
      concept: editing.concept,
      invoice_folio: editing.invoice_folio || null,
      amount: Number(editing.amount),
      paid_amount: Number(editing.paid_amount) || 0,
      issue_date: editing.issue_date || null,
      due_date: editing.due_date,
      status: editing.status || 'pending',
      accounting_account_code: editing.accounting_account_code || null,
      notes: editing.notes || null,
    }
    const res = editing.id
      ? await supabase.from('accounts_payable').update(payload).eq('id', editing.id)
      : await supabase.from('accounts_payable').insert(payload)
    setSaving(false)
    if (res.error) { alert('Error: ' + res.error.message); return }
    setEditing(null)
    await load(companyId)
  }

  async function remove(id: string) {
    if (!companyId || !confirm('¿Eliminar esta cuenta por pagar?')) return
    const { error } = await supabase.from('accounts_payable').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    await load(companyId)
  }

  async function markPaid(row: AP) {
    if (!companyId) return
    const { error } = await supabase.from('accounts_payable')
      .update({ status: 'paid', paid_amount: row.amount, payment_date: new Date().toISOString().slice(0, 10) })
      .eq('id', row.id)
    if (error) { alert('Error: ' + error.message); return }
    await load(companyId)
  }

  const today = new Date().toISOString().slice(0, 10)
  const visible = rows.filter((r) =>
    filter === 'todas' ? true : filter === 'pagadas' ? r.status === 'paid' : !['paid', 'cancelled'].includes(r.status)
  )
  const totalPendiente = rows.filter((r) => !['paid', 'cancelled'].includes(r.status))
    .reduce((s, r) => s + (r.amount - r.paid_amount), 0)
  const vencidas = rows.filter((r) => !['paid', 'cancelled'].includes(r.status) && r.due_date < today).length

  if (loading) return <div className="flex items-center justify-center h-96 text-slate-600">Cargando…</div>

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">💳 Cuentas por Pagar</h1>
          <p className="text-slate-500 mt-1">Control de pendientes a proveedores</p>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })}
          className="px-4 py-2 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 text-sm whitespace-nowrap">
          + Nueva cuenta
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Saldo pendiente" value={`$${totalPendiente.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`} color="text-amber-600" />
        <Kpi label="Vencidas" value={vencidas} color="text-red-600" />
        <Kpi label="Total registros" value={rows.length} color="text-slate-700" />
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
        <div className="p-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">
          No hay cuentas por pagar {filter !== 'todas' && filter}.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left p-3">Proveedor</th>
                <th className="text-left p-3">Concepto</th>
                <th className="text-right p-3">Monto</th>
                <th className="text-center p-3">Vence</th>
                <th className="text-center p-3">Estado</th>
                <th className="text-right p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const overdue = !['paid', 'cancelled'].includes(r.status) && r.due_date < today
                return (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="p-3">
                      <div className="font-medium text-slate-900">{r.supplier_name}</div>
                      {r.supplier_rfc && <div className="text-xs text-slate-400">{r.supplier_rfc}</div>}
                    </td>
                    <td className="p-3 text-slate-600">{r.concept}{r.invoice_folio && <span className="text-slate-400"> · {r.invoice_folio}</span>}</td>
                    <td className="p-3 text-right font-semibold text-slate-900">${r.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                    <td className={`p-3 text-center ${overdue ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                      {new Date(r.due_date).toLocaleDateString('es-MX')}{overdue && ' ⚠'}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {r.status !== 'paid' && (
                        <button onClick={() => markPaid(r)} className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold mr-3">Pagar</button>
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

      {/* Modal alta/edición */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">{editing.id ? 'Editar' : 'Nueva'} cuenta por pagar</h2>
            <Field label="Proveedor *"><input className="inp" value={editing.supplier_name ?? ''} onChange={(e) => setEditing({ ...editing, supplier_name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="RFC"><input className="inp" value={editing.supplier_rfc ?? ''} onChange={(e) => setEditing({ ...editing, supplier_rfc: e.target.value })} /></Field>
              <Field label="Folio factura"><input className="inp" value={editing.invoice_folio ?? ''} onChange={(e) => setEditing({ ...editing, invoice_folio: e.target.value })} /></Field>
            </div>
            <Field label="Concepto *"><input className="inp" value={editing.concept ?? ''} onChange={(e) => setEditing({ ...editing, concept: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monto *"><input type="number" step="0.01" className="inp" value={editing.amount ?? ''} onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })} /></Field>
              <Field label="Cuenta contable"><input className="inp" value={editing.accounting_account_code ?? ''} onChange={(e) => setEditing({ ...editing, accounting_account_code: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fecha emisión"><input type="date" className="inp" value={editing.issue_date ?? ''} onChange={(e) => setEditing({ ...editing, issue_date: e.target.value })} /></Field>
              <Field label="Vencimiento *"><input type="date" className="inp" value={editing.due_date ?? ''} onChange={(e) => setEditing({ ...editing, due_date: e.target.value })} /></Field>
            </div>
            <Field label="Estado">
              <select className="inp" value={editing.status ?? 'pending'} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Notas"><textarea className="inp" rows={2} value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></Field>
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
