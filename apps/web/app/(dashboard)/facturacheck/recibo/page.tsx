'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, getSessionUser } from '@/lib/supabase'

interface Cliente { id: string; name: string; rfc: string | null }
interface Recibo {
  id: string
  folio: string
  receipt_type: string
  client_id: string | null
  client_name: string
  client_rfc: string | null
  concept: string
  amount: number
  payment_method: string | null
  receipt_date: string
  notes: string | null
  status: string
}

const TYPE_LABEL: Record<string, string> = {
  recibo: 'Recibo de pago', nota_venta: 'Nota de venta', comprobante_pago: 'Comprobante de pago',
}
const METHODS = ['Efectivo', 'Transferencia', 'Cheque', 'Tarjeta', 'Otro']
const money = (n: number | null) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
const today = () => new Date().toISOString().slice(0, 10)

type Editable = Partial<Recibo>
const EMPTY: Editable = { receipt_type: 'recibo', client_name: '', concept: '', amount: 0, payment_method: 'Efectivo', receipt_date: today() }

export default function ReciboPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [rows, setRows] = useState<Recibo[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [missingTable, setMissingTable] = useState(false)
  const [editing, setEditing] = useState<Editable | null>(null)
  const [saving, setSaving] = useState(false)

  const nextFolio = useCallback((list: Recibo[]) => {
    const max = list.reduce((m, r) => {
      const n = parseInt((r.folio || '').replace(/\D/g, ''), 10)
      return Number.isFinite(n) && n > m ? n : m
    }, 0)
    return `REC-${String(max + 1).padStart(4, '0')}`
  }, [])

  const load = useCallback(async (cid: string) => {
    const [recRes, cliRes, compRes] = await Promise.all([
      supabase.from('payment_receipts').select('*').eq('company_id', cid).order('created_at', { ascending: false }).limit(200),
      supabase.from('cobra_clients').select('id, name, rfc').eq('company_id', cid).order('name'),
      supabase.from('companies').select('name').eq('id', cid).maybeSingle(),
    ])
    if (recRes.error && (recRes.error.code === '42P01' || /does not exist|relation/i.test(recRes.error.message))) {
      setMissingTable(true)
      return
    }
    setRows((recRes.data as Recibo[]) ?? [])
    setClientes((cliRes.data as Cliente[]) ?? [])
    setCompanyName((compRes.data as any)?.name ?? '')
  }, [])

  useEffect(() => {
    (async () => {
      const u = await getSessionUser()
      if (u?.company_id) { setCompanyId(u.company_id); setUserId(u.id); await load(u.company_id) }
      setLoading(false)
    })()
  }, [load])

  function openNew() {
    setEditing({ ...EMPTY, folio: nextFolio(rows) })
  }

  function pickClient(id: string) {
    const c = clientes.find((x) => x.id === id)
    setEditing((e) => ({ ...e, client_id: id || null, client_name: c?.name ?? e?.client_name ?? '', client_rfc: c?.rfc ?? e?.client_rfc ?? null }))
  }

  async function save() {
    if (!companyId || !userId || !editing) return
    if (!editing.client_name?.trim() || !editing.concept?.trim() || !editing.amount) {
      alert('Cliente, concepto y monto son obligatorios'); return
    }
    setSaving(true)
    const base = {
      folio: editing.folio?.trim() || nextFolio(rows),
      receipt_type: editing.receipt_type || 'recibo',
      client_id: editing.client_id || null,
      client_name: editing.client_name.trim(),
      client_rfc: editing.client_rfc?.trim() || null,
      concept: editing.concept.trim(),
      amount: Number(editing.amount),
      payment_method: editing.payment_method || null,
      receipt_date: editing.receipt_date || today(),
      notes: editing.notes?.trim() || null,
    }
    const res = editing.id
      ? await supabase.from('payment_receipts').update(base).eq('id', editing.id)
      : await supabase.from('payment_receipts').insert({ ...base, company_id: companyId, created_by: userId, status: 'issued' })
    setSaving(false)
    if (res.error) { alert('Error: ' + res.error.message); return }
    setEditing(null)
    await load(companyId)
  }

  async function remove(id: string) {
    if (!companyId || !confirm('¿Eliminar este recibo?')) return
    const { error } = await supabase.from('payment_receipts').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    await load(companyId)
  }

  function print(r: Recibo) {
    const w = window.open('', '_blank', 'width=600,height=700')
    if (!w) return
    w.document.write(`<!doctype html><html><head><title>${r.folio}</title>
      <style>
        body{font-family:system-ui,Arial,sans-serif;color:#0f172a;padding:40px;max-width:520px;margin:auto}
        h1{font-size:20px;margin:0}
        .muted{color:#64748b;font-size:12px}
        .box{border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-top:20px}
        .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
        .total{font-size:26px;font-weight:800;margin-top:16px}
        .tag{display:inline-block;background:#ecfdf5;color:#047857;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700}
        .foot{margin-top:28px;font-size:11px;color:#94a3b8;text-align:center}
      </style></head><body>
      <h1>${companyName || 'Comprobante'}</h1>
      <p class="muted">${TYPE_LABEL[r.receipt_type] ?? 'Recibo'} · Folio ${r.folio}</p>
      <span class="tag">DOCUMENTO NO FISCAL — sin valor ante el SAT</span>
      <div class="box">
        <div class="row"><span>Fecha</span><strong>${new Date(r.receipt_date).toLocaleDateString('es-MX')}</strong></div>
        <div class="row"><span>Cliente</span><strong>${r.client_name}${r.client_rfc ? ' · ' + r.client_rfc : ''}</strong></div>
        <div class="row"><span>Concepto</span><strong>${r.concept}</strong></div>
        <div class="row"><span>Método de pago</span><strong>${r.payment_method ?? '—'}</strong></div>
        ${r.notes ? `<div class="row"><span>Notas</span><strong>${r.notes}</strong></div>` : ''}
        <p class="total">${money(r.amount)}</p>
      </div>
      <p class="foot">Generado con CHECK SUITE · ${new Date().toLocaleString('es-MX')}</p>
      </body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }

  if (loading) return <div className="flex items-center justify-center h-96 text-slate-600">Cargando…</div>

  if (missingTable) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <a href="/facturacheck" className="text-xs font-semibold text-slate-400 hover:text-slate-600">← FacturaCheck</a>
        <h1 className="text-2xl font-black text-slate-900 mt-2">🧾 Recibos no fiscales</h1>
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900 space-y-2">
          <p className="font-bold">Falta aplicar una migración para activar este módulo.</p>
          <p>Ejecuta en Supabase (SQL Editor) el archivo <code className="bg-amber-100 px-1 rounded">supabase/migrations/20260625000000_payment_receipts.sql</code> y recarga la página.</p>
        </div>
      </div>
    )
  }

  const total = rows.filter((r) => r.status !== 'cancelled').reduce((s, r) => s + (Number(r.amount) || 0), 0)

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <a href="/facturacheck" className="text-xs font-semibold text-slate-400 hover:text-slate-600">← FacturaCheck</a>
          <h1 className="text-3xl font-black text-slate-900 mt-1">🧾 Recibos / comprobantes de pago</h1>
          <p className="text-slate-500 mt-1">Documentos NO fiscales (sin timbrado SAT)</p>
        </div>
        <button onClick={openNew}
          className="px-4 py-2 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 text-sm whitespace-nowrap">
          + Nuevo recibo
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Kpi label="Recibos emitidos" value={rows.filter((r) => r.status !== 'cancelled').length} color="text-slate-700" />
        <Kpi label="Monto total" value={money(total)} color="text-emerald-600" />
      </div>

      {rows.length === 0 ? (
        <div className="p-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">
          Aún no hay recibos. Crea el primero con “+ Nuevo recibo”.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left p-3">Folio / Cliente</th>
                <th className="text-left p-3">Concepto</th>
                <th className="text-right p-3">Monto</th>
                <th className="text-center p-3">Fecha</th>
                <th className="text-right p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-t border-slate-100 ${r.status === 'cancelled' ? 'opacity-50 line-through' : ''}`}>
                  <td className="p-3">
                    <div className="font-medium text-slate-900">{r.folio}</div>
                    <div className="text-xs text-slate-400">{r.client_name}</div>
                  </td>
                  <td className="p-3 text-slate-600">{r.concept}</td>
                  <td className="p-3 text-right font-semibold text-slate-900">{money(r.amount)}</td>
                  <td className="p-3 text-center text-slate-600">{new Date(r.receipt_date).toLocaleDateString('es-MX')}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button onClick={() => print(r)} className="text-slate-600 hover:text-slate-900 text-xs font-semibold mr-3">Imprimir</button>
                    <button onClick={() => setEditing(r)} className="text-blue-600 hover:text-blue-800 text-xs font-semibold mr-3">Editar</button>
                    <button onClick={() => remove(r.id)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Borrar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">{editing.id ? 'Editar' : 'Nuevo'} recibo</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Folio"><input className="inp" value={editing.folio ?? ''} onChange={(e) => setEditing({ ...editing, folio: e.target.value })} /></Field>
              <Field label="Tipo">
                <select className="inp" value={editing.receipt_type ?? 'recibo'} onChange={(e) => setEditing({ ...editing, receipt_type: e.target.value })}>
                  {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </div>
            {clientes.length > 0 && (
              <Field label="Cliente del directorio (opcional)">
                <select className="inp" value={editing.client_id ?? ''} onChange={(e) => pickClient(e.target.value)}>
                  <option value="">— Capturar manualmente —</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre cliente *"><input className="inp" value={editing.client_name ?? ''} onChange={(e) => setEditing({ ...editing, client_name: e.target.value })} /></Field>
              <Field label="RFC"><input className="inp" value={editing.client_rfc ?? ''} onChange={(e) => setEditing({ ...editing, client_rfc: e.target.value.toUpperCase() })} /></Field>
            </div>
            <Field label="Concepto *"><input className="inp" value={editing.concept ?? ''} onChange={(e) => setEditing({ ...editing, concept: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Monto *"><input type="number" step="0.01" className="inp" value={editing.amount ?? ''} onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })} /></Field>
              <Field label="Método">
                <select className="inp" value={editing.payment_method ?? 'Efectivo'} onChange={(e) => setEditing({ ...editing, payment_method: e.target.value })}>
                  {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Fecha"><input type="date" className="inp" value={editing.receipt_date ?? ''} onChange={(e) => setEditing({ ...editing, receipt_date: e.target.value })} /></Field>
            </div>
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
