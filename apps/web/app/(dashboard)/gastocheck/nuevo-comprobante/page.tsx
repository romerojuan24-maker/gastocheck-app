'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getSessionUser, type UserRole } from '@/lib/supabase'
import { usePermissions } from '@/hooks/usePermissions'

interface Receipt {
  id: string
  provider_name: string | null
  provider_rfc: string | null
  receipt_date: string | null
  total_amount: number | null
  subtotal_amount: number | null
  tax_amount: number | null
  payment_method: string | null
  internal_folio: string | null
  notes: string | null
  status: string
  created_at: string
}

const PAYMENT_METHODS = ['Efectivo', 'Transferencia', 'Tarjeta', 'Cheque', 'Otro']
const money = (n: number | null) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
const today = () => new Date().toISOString().slice(0, 10)

type Editable = Partial<Receipt>
const EMPTY: Editable = { provider_name: '', receipt_date: today(), total_amount: 0, payment_method: 'Efectivo' }

export default function NuevoComprobantePage() {
  const router = useRouter()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const { canI } = usePermissions(role)
  const [rows, setRows] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Editable | null>({ ...EMPTY })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (cid: string) => {
    const { data } = await supabase
      .from('receipts')
      .select('id, provider_name, provider_rfc, receipt_date, total_amount, subtotal_amount, tax_amount, payment_method, internal_folio, notes, status, created_at')
      .eq('company_id', cid)
      .eq('source_type', 'manual')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(100)
    setRows((data as Receipt[]) ?? [])
  }, [])

  useEffect(() => {
    (async () => {
      const u = await getSessionUser()
      if (u?.role) setRole(u.role as UserRole)
      if (u?.company_id) { setCompanyId(u.company_id); setUserId(u.id); await load(u.company_id) }
      setLoading(false)
    })()
  }, [load])

  async function save() {
    if (!companyId || !userId || !editing) return
    if (!editing.provider_name?.trim() || !editing.total_amount) {
      alert('Proveedor y monto total son obligatorios'); return
    }
    setSaving(true)
    const base = {
      provider_name: editing.provider_name.trim(),
      provider_rfc: editing.provider_rfc?.trim() || null,
      receipt_date: editing.receipt_date || null,
      total_amount: Number(editing.total_amount),
      subtotal_amount: editing.subtotal_amount != null ? Number(editing.subtotal_amount) : null,
      tax_amount: editing.tax_amount != null ? Number(editing.tax_amount) : null,
      payment_method: editing.payment_method || null,
      internal_folio: editing.internal_folio?.trim() || null,
      notes: editing.notes?.trim() || null,
    }
    const res = editing.id
      ? await supabase.from('receipts').update(base).eq('id', editing.id)
      : await supabase.from('receipts').insert({
          ...base,
          company_id: companyId,
          uploaded_by: userId,
          employee_id: userId,
          source_type: 'manual',
          status: 'captured',
        })
    setSaving(false)
    if (res.error) { alert('Error: ' + res.error.message); return }
    setEditing({ ...EMPTY })
    await load(companyId)
  }

  async function cancel(id: string) {
    if (!companyId || !confirm('¿Cancelar este comprobante? Dejará de aparecer en la lista.')) return
    const { error } = await supabase.from('receipts').update({ status: 'cancelled' }).eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    await load(companyId)
  }

  if (loading) return <div className="flex items-center justify-center h-96 text-slate-600">Cargando…</div>

  const total = rows.reduce((s, r) => s + (Number(r.total_amount) || 0), 0)
  const isEdit = !!editing?.id

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <a href="/gastocheck/comprobantes" className="text-xs font-semibold text-slate-400 hover:text-slate-600">← Comprobantes</a>
        <h1 className="text-3xl font-black text-slate-900 mt-1">🧾 Nuevo comprobante</h1>
        <p className="text-slate-500 mt-1">Captura manual de respaldo administrativo (web)</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Formulario */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 sticky top-6">
            <h2 className="font-bold text-slate-900">{isEdit ? 'Editar comprobante' : 'Datos del comprobante'}</h2>
            <Field label="Proveedor *"><input className="inp" value={editing?.provider_name ?? ''} onChange={(e) => setEditing({ ...editing, provider_name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="RFC"><input className="inp" value={editing?.provider_rfc ?? ''} onChange={(e) => setEditing({ ...editing, provider_rfc: e.target.value.toUpperCase() })} /></Field>
              <Field label="Folio interno"><input className="inp" value={editing?.internal_folio ?? ''} onChange={(e) => setEditing({ ...editing, internal_folio: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Subtotal"><input type="number" step="0.01" className="inp" value={editing?.subtotal_amount ?? ''} onChange={(e) => setEditing({ ...editing, subtotal_amount: Number(e.target.value) })} /></Field>
              <Field label="IVA"><input type="number" step="0.01" className="inp" value={editing?.tax_amount ?? ''} onChange={(e) => setEditing({ ...editing, tax_amount: Number(e.target.value) })} /></Field>
              <Field label="Total *"><input type="number" step="0.01" className="inp" value={editing?.total_amount ?? ''} onChange={(e) => setEditing({ ...editing, total_amount: Number(e.target.value) })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fecha"><input type="date" className="inp" value={editing?.receipt_date ?? ''} onChange={(e) => setEditing({ ...editing, receipt_date: e.target.value })} /></Field>
              <Field label="Método de pago">
                <select className="inp" value={editing?.payment_method ?? 'Efectivo'} onChange={(e) => setEditing({ ...editing, payment_method: e.target.value })}>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Notas"><textarea className="inp" rows={2} value={editing?.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></Field>
            <div className="flex gap-2 pt-1">
              <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 disabled:opacity-50">{saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Guardar comprobante'}</button>
              {isEdit && <button onClick={() => setEditing({ ...EMPTY })} className="px-4 py-2.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Nuevo</button>}
            </div>
          </div>
        </div>

        {/* Lista */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Capturados ({rows.length})</h2>
            <p className="text-sm text-slate-500">Total {money(total)}</p>
          </div>
          {rows.length === 0 ? (
            <div className="p-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">Aún no hay comprobantes capturados manualmente.</div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{r.provider_name || 'Sin proveedor'}</p>
                    <p className="text-xs text-slate-500">
                      {r.receipt_date ? new Date(r.receipt_date).toLocaleDateString('es-MX') : 'Sin fecha'}
                      {r.internal_folio && <> · {r.internal_folio}</>}
                      {r.payment_method && <> · {r.payment_method}</>}
                    </p>
                    {r.notes && <p className="text-xs text-slate-400 mt-1 truncate">{r.notes}</p>}
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <p className="font-bold text-slate-900">{money(r.total_amount)}</p>
                    <div className="mt-1">
                      {canI('nuevo_comprobante', 'edit') && (
                        <button onClick={() => setEditing(r)} className="text-blue-600 hover:text-blue-800 text-xs font-semibold mr-2">Editar</button>
                      )}
                      {canI('nuevo_comprobante', 'cancel') && (
                        <button onClick={() => cancel(r.id)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Cancelar</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`.inp{width:100%;border:1px solid #e2e8f0;border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem}.inp:focus{outline:none;box-shadow:0 0 0 2px #34d399}`}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-semibold text-slate-600 block mb-1">{label}</span>{children}</label>
}
