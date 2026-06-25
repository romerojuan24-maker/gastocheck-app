'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase, getSessionUser } from '@/lib/supabase'
import { getStockStatus } from '@gastocheck/shared'
import type { InventoryProduct, InventoryAlert } from '@gastocheck/shared'

const UNITS = ['pza', 'kg', 'lt', 'caja', 'metro', 'paquete', 'servicio']
const money = (n: number | null) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

type Editable = Partial<InventoryProduct>
const EMPTY: Editable = { name: '', sku: '', category: '', unit: 'pza', cost: 0, price: 0, stock_current: 0, stock_minimum: 0 }

export default function InventarioCheckPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [products, setProducts] = useState<InventoryProduct[]>([])
  const [alerts, setAlerts] = useState<InventoryAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'stock' | 'alertas'>('stock')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Editable | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (cid: string) => {
    const [prodRes, alertRes] = await Promise.all([
      supabase.from('inventory_products').select('*').eq('company_id', cid).eq('is_active', true).order('name'),
      supabase.from('inventory_alerts').select('*').eq('company_id', cid).eq('is_read', false),
    ])
    setProducts((prodRes.data ?? []) as InventoryProduct[])
    setAlerts((alertRes.data ?? []) as InventoryAlert[])
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
    if (!editing.name?.trim()) { alert('El nombre del producto es obligatorio'); return }
    setSaving(true)
    const payload = {
      company_id: companyId,
      name: editing.name.trim(),
      sku: editing.sku?.trim() || null,
      barcode: editing.barcode?.trim() || null,
      category: editing.category?.trim() || null,
      unit: editing.unit || 'pza',
      cost: Number(editing.cost) || 0,
      price: Number(editing.price) || 0,
      stock_current: Number(editing.stock_current) || 0,
      stock_minimum: Number(editing.stock_minimum) || 0,
      notes: editing.notes?.trim() || null,
    }
    const res = editing.id
      ? await supabase.from('inventory_products').update(payload).eq('id', editing.id)
      : await supabase.from('inventory_products').insert(payload)
    setSaving(false)
    if (res.error) { alert('Error: ' + res.error.message); return }
    setEditing(null)
    await load(companyId)
  }

  async function remove(id: string) {
    if (!companyId || !confirm('¿Eliminar este producto del inventario?')) return
    const { error } = await supabase.from('inventory_products').update({ is_active: false }).eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    await load(companyId)
  }

  const agotados = products.filter((p) => p.stock_current <= 0).length
  const bajos = products.filter((p) => p.stock_current > 0 && p.stock_current <= p.stock_minimum).length
  const valorInventario = products.reduce((s, p) => s + (Number(p.cost) || 0) * (Number(p.stock_current) || 0), 0)

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => [p.name, p.sku, p.barcode, p.category].some((f) => f?.toLowerCase().includes(q)))
  }, [products, search])

  if (loading) return <div className="flex items-center justify-center h-96 text-slate-600">Cargando…</div>

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">📦 InventarioCheck</h1>
          <p className="text-slate-500 mt-1">Gestión de stock, costos y precios</p>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })}
          className="px-4 py-2 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 text-sm whitespace-nowrap">
          + Nuevo producto
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Productos" value={products.length} color="text-slate-700" />
        <Kpi label="Stock bajo" value={bajos} color="text-amber-600" />
        <Kpi label="Agotados" value={agotados} color="text-red-600" />
        <Kpi label="Valor inventario" value={money(valorInventario)} color="text-blue-600" />
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {(['stock', 'alertas'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${tab === t ? 'text-slate-900 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-900'}`}>
            {t === 'stock' ? 'Productos' : `Alertas (${alerts.length})`}
          </button>
        ))}
      </div>

      {tab === 'stock' ? (
        <>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, SKU, código o categoría…"
              className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          {visible.length === 0 ? (
            <div className="p-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">
              {products.length === 0 ? 'Aún no hay productos. Crea el primero con “+ Nuevo producto”.' : 'Ningún producto coincide con la búsqueda.'}
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="text-left p-3">Producto</th>
                    <th className="text-right p-3">Costo</th>
                    <th className="text-right p-3">Precio</th>
                    <th className="text-center p-3">Stock</th>
                    <th className="text-right p-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => {
                    const status = getStockStatus(p)
                    return (
                      <tr key={p.id} className="border-t border-slate-100">
                        <td className="p-3">
                          <div className="font-medium text-slate-900">{p.name}</div>
                          <div className="text-xs text-slate-400">{[p.sku && `SKU ${p.sku}`, p.category].filter(Boolean).join(' · ') || '—'}</div>
                        </td>
                        <td className="p-3 text-right text-slate-600">{money(p.cost)}</td>
                        <td className="p-3 text-right font-semibold text-slate-900">{money(p.price)}</td>
                        <td className="p-3 text-center">
                          <span style={{ color: status.color }} className="font-bold">{Number(p.stock_current).toFixed(1)}</span>
                          <span className="text-xs text-slate-400"> {p.unit}</span>
                          <div className="text-[10px]" style={{ color: status.color }}>{status.label}</div>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <button onClick={() => setEditing(p)} className="text-blue-600 hover:text-blue-800 text-xs font-semibold mr-3">Editar</button>
                          <button onClick={() => remove(p.id)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Borrar</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        alerts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">Sin alertas de stock.</div>
        ) : (
          <div className="space-y-3">
            {alerts.map((a) => (
              <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="font-semibold text-slate-900">{a.message}</p>
                <p className="text-xs text-slate-500 mt-1">{a.alert_type}</p>
              </div>
            ))}
          </div>
        )
      )}

      {/* Modal alta/edición */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">{editing.id ? 'Editar' : 'Nuevo'} producto</h2>
            <Field label="Nombre *"><input className="inp" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="SKU"><input className="inp" value={editing.sku ?? ''} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} /></Field>
              <Field label="Código de barras"><input className="inp" value={editing.barcode ?? ''} onChange={(e) => setEditing({ ...editing, barcode: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoría"><input className="inp" value={editing.category ?? ''} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></Field>
              <Field label="Unidad">
                <select className="inp" value={editing.unit ?? 'pza'} onChange={(e) => setEditing({ ...editing, unit: e.target.value })}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Costo"><input type="number" step="0.01" className="inp" value={editing.cost ?? ''} onChange={(e) => setEditing({ ...editing, cost: Number(e.target.value) })} /></Field>
              <Field label="Precio venta"><input type="number" step="0.01" className="inp" value={editing.price ?? ''} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Stock actual"><input type="number" step="0.001" className="inp" value={editing.stock_current ?? ''} onChange={(e) => setEditing({ ...editing, stock_current: Number(e.target.value) })} /></Field>
              <Field label="Stock mínimo"><input type="number" step="0.001" className="inp" value={editing.stock_minimum ?? ''} onChange={(e) => setEditing({ ...editing, stock_minimum: Number(e.target.value) })} /></Field>
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
