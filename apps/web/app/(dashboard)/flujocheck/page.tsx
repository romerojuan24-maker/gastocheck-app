'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, getSessionUser } from '@/lib/supabase'
import { CASH_FLOW_RISK_META, projectCashFlow } from '@gastocheck/shared'
import type { CashFlowItem } from '@gastocheck/shared'

const money = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
const today = () => new Date().toISOString().slice(0, 10)

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', paid: 'Pagado', collected: 'Cobrado', at_risk: 'En riesgo', overdue: 'Vencido', cancelled: 'Cancelado',
}
const SOURCE_LABEL: Record<string, string> = {
  manual: 'Manual', cobracheck: 'CobraCheck', gastocheck: 'GastoCheck', bancocheck: 'BancoCheck', inventariocheck: 'Inventario',
}

type Editable = Partial<CashFlowItem>
const EMPTY: Editable = { description: '', amount: 0, direction: 'in', expected_date: today(), status: 'pending', item_type: 'income' }

export default function FlujoCheckPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [currentBalance, setCurrentBalance] = useState(0)
  const [items, setItems] = useState<CashFlowItem[]>([])
  const [risk, setRisk] = useState<'green' | 'yellow' | 'red'>('green')
  const [projected, setProjected] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Editable | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (cid: string) => {
    const [accData, itemsRes] = await Promise.all([
      supabase.from('bank_accounts').select('current_balance').eq('company_id', cid).eq('is_active', true),
      supabase.from('cash_flow_items').select('*').eq('company_id', cid).eq('is_scenario', false).order('expected_date', { ascending: true }).limit(100),
    ])
    const bal = (accData.data ?? []).reduce((s, a) => s + (a.current_balance ?? 0), 0)
    setCurrentBalance(bal)
    const its = (itemsRes.data ?? []) as CashFlowItem[]
    setItems(its)
    const { balance, risk: r } = projectCashFlow(bal, its, 7)
    setProjected(balance)
    setRisk(r)
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
    if (!editing.description?.trim() || !editing.amount || !editing.expected_date) {
      alert('Descripción, monto y fecha esperada son obligatorios'); return
    }
    setSaving(true)
    const direction = editing.direction || 'in'
    const payload = {
      company_id: companyId,
      description: editing.description.trim(),
      amount: Math.abs(Number(editing.amount)),
      direction,
      item_type: direction === 'in' ? 'income' : 'expense',
      expected_date: editing.expected_date,
      status: editing.status || 'pending',
      source: 'manual',
      notes: editing.notes?.trim() || null,
    }
    const res = editing.id
      ? await supabase.from('cash_flow_items').update(payload).eq('id', editing.id)
      : await supabase.from('cash_flow_items').insert(payload)
    setSaving(false)
    if (res.error) { alert('Error: ' + res.error.message); return }
    setEditing(null)
    await load(companyId)
  }

  async function remove(id: string) {
    if (!companyId || !confirm('¿Eliminar este movimiento proyectado?')) return
    const { error } = await supabase.from('cash_flow_items').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    await load(companyId)
  }

  const riskMeta = CASH_FLOW_RISK_META[risk]
  const income = items.filter((i) => i.direction === 'in').reduce((s, i) => s + i.amount, 0)
  const expense = items.filter((i) => i.direction === 'out').reduce((s, i) => s + i.amount, 0)

  if (loading) return <div className="flex items-center justify-center h-96 text-slate-600">Cargando…</div>

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">📈 FlujoCheck</h1>
          <p className="text-slate-500 mt-1">Proyección de flujo de caja</p>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })}
          className="px-4 py-2 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 text-sm whitespace-nowrap">
          + Nuevo movimiento
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Saldo hoy" value={money(currentBalance)} color="text-slate-900" />
        <Kpi label="Ingresos proyectados" value={`+${money(income)}`} color="text-emerald-600" />
        <Kpi label="Egresos proyectados" value={`-${money(expense)}`} color="text-red-600" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <p className="text-sm font-bold text-slate-600 mb-2">PROYECCIÓN 7 DÍAS</p>
        <div className="flex items-baseline gap-4">
          <p className="text-4xl font-black">{money(projected)}</p>
          <p style={{ color: riskMeta.color }} className="text-sm font-bold">{riskMeta.label}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="p-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">
          Aún no hay movimientos proyectados. Agrega ingresos o egresos esperados con “+ Nuevo movimiento”.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((i) => (
            <div key={i.id} className={`rounded-xl p-4 flex items-center justify-between gap-4 border ${i.direction === 'in' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">{i.description}</p>
                <p className="text-xs text-slate-500">
                  {new Date(i.expected_date).toLocaleDateString('es-MX')} · {STATUS_LABEL[i.status] ?? i.status}
                  {i.source !== 'manual' && <> · {SOURCE_LABEL[i.source] ?? i.source}</>}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <p className={`font-black ${i.direction === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {i.direction === 'in' ? '+' : '-'}{money(Math.abs(i.amount))}
                </p>
                {i.source === 'manual' && (
                  <div className="whitespace-nowrap">
                    <button onClick={() => setEditing(i)} className="text-blue-600 hover:text-blue-800 text-xs font-semibold mr-2">Editar</button>
                    <button onClick={() => remove(i.id)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Borrar</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal alta/edición */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">{editing.id ? 'Editar' : 'Nuevo'} movimiento</h2>
            <Field label="Tipo">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setEditing({ ...editing, direction: 'in' })}
                  className={`py-2 rounded-lg text-sm font-semibold border ${editing.direction === 'in' ? 'bg-emerald-500 text-white border-emerald-500' : 'border-slate-200 text-slate-600'}`}>Ingreso</button>
                <button type="button" onClick={() => setEditing({ ...editing, direction: 'out' })}
                  className={`py-2 rounded-lg text-sm font-semibold border ${editing.direction === 'out' ? 'bg-red-500 text-white border-red-500' : 'border-slate-200 text-slate-600'}`}>Egreso</button>
              </div>
            </Field>
            <Field label="Descripción *"><input className="inp" value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monto *"><input type="number" step="0.01" className="inp" value={editing.amount ?? ''} onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })} /></Field>
              <Field label="Fecha esperada *"><input type="date" className="inp" value={editing.expected_date ?? ''} onChange={(e) => setEditing({ ...editing, expected_date: e.target.value })} /></Field>
            </div>
            <Field label="Estado">
              <select className="inp" value={editing.status ?? 'pending'} onChange={(e) => setEditing({ ...editing, status: e.target.value as CashFlowItem['status'] })}>
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
