'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function EmitirCfdiPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'emitir' | 'config'>('emitir')
  const [cfg, setCfg] = useState<any>({ provider: 'facturama', mode: 'sandbox', is_active: false })
  const [hasActive, setHasActive] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // formulario de emisión
  const [inv, setInv] = useState({ receptor_rfc: '', receptor_razon_social: '', receptor_uso_cfdi: 'G03', receptor_codigo_postal: '', descripcion: '', cantidad: 1, precio: 0 })

  useEffect(() => {
    (async () => {
      const u = await getSessionUser()
      if (u?.company_id) {
        setCompanyId(u.company_id)
        const { data } = await supabase.from('cfdi_provider_configs').select('*').eq('company_id', u.company_id).maybeSingle()
        if (data) { setCfg(data); setHasActive(!!data.is_active) }
      }
      setLoading(false)
    })()
  }, [])

  async function saveConfig() {
    if (!companyId) return
    setMsg(null)
    const payload = {
      company_id: companyId, provider: cfg.provider, rfc: cfg.rfc, razon_social: cfg.razon_social,
      regimen_fiscal: cfg.regimen_fiscal, codigo_postal_fiscal: cfg.codigo_postal_fiscal,
      pac_user_enc: cfg.pac_user_enc, pac_pass_enc: cfg.pac_pass_enc, mode: cfg.mode, is_active: cfg.is_active,
    }
    const { error } = await supabase.from('cfdi_provider_configs').upsert(payload, { onConflict: 'company_id,provider' })
    setMsg(error ? `❌ ${error.message}` : '✅ Configuración guardada')
    if (!error) setHasActive(!!cfg.is_active)
  }

  async function emitir() {
    if (!companyId) return
    setMsg(null)
    if (!inv.receptor_rfc || !inv.descripcion || !inv.precio) { setMsg('❌ RFC, descripción y precio son obligatorios'); return }
    const subtotal = Number(inv.cantidad) * Number(inv.precio)
    const iva = +(subtotal * 0.16).toFixed(2)
    const total = +(subtotal + iva).toFixed(2)
    const item = { descripcion: inv.descripcion, cantidad: Number(inv.cantidad), precio: Number(inv.precio), subtotal, iva, total, clave_prod: '01010101', clave_unidad: 'H87' }

    const { data: reqRow, error: e1 } = await supabase.from('cfdi_issue_requests').insert({
      company_id: companyId, cfdi_type: 'ingreso',
      receptor_rfc: inv.receptor_rfc, receptor_razon_social: inv.receptor_razon_social,
      receptor_uso_cfdi: inv.receptor_uso_cfdi, receptor_codigo_postal: inv.receptor_codigo_postal,
      items: [item], subtotal, iva, total, status: 'pending',
    }).select('id').single()
    if (e1) { setMsg(`❌ ${e1.message}`); return }

    setMsg('⏳ Timbrando…')
    const { data, error } = await supabase.functions.invoke('timbrar-cfdi', { body: { request_id: reqRow.id } })
    if (error || data?.error) setMsg(`❌ ${data?.error || error?.message}`)
    else setMsg(`✅ Timbrado. UUID: ${data.uuid}`)
  }

  if (loading) return <div className="flex items-center justify-center h-96 text-slate-600">Cargando…</div>

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900">📄 Emitir CFDI</h1>
        <p className="text-slate-500 mt-1">Timbrado multi-proveedor — Facturama o FacturAPI</p>
      </div>

      {!hasActive && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          ⚠ No hay un proveedor PAC activo. Configúralo en la pestaña <strong>Configuración</strong> para poder timbrar.
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200">
        {(['emitir', 'config'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors ${tab === t ? 'text-slate-900 border-b-2 border-emerald-500' : 'text-slate-500'}`}>
            {t === 'emitir' ? 'Emitir factura' : 'Configuración PAC'}
          </button>
        ))}
      </div>

      {tab === 'emitir' ? (
        <div className="space-y-3 bg-white border border-slate-200 rounded-xl p-6">
          <div className="grid grid-cols-2 gap-3">
            <F label="RFC receptor *"><input className="inp" value={inv.receptor_rfc} onChange={(e) => setInv({ ...inv, receptor_rfc: e.target.value.toUpperCase() })} /></F>
            <F label="Razón social"><input className="inp" value={inv.receptor_razon_social} onChange={(e) => setInv({ ...inv, receptor_razon_social: e.target.value })} /></F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Uso CFDI"><input className="inp" value={inv.receptor_uso_cfdi} onChange={(e) => setInv({ ...inv, receptor_uso_cfdi: e.target.value })} /></F>
            <F label="CP receptor"><input className="inp" value={inv.receptor_codigo_postal} onChange={(e) => setInv({ ...inv, receptor_codigo_postal: e.target.value })} /></F>
          </div>
          <F label="Descripción del concepto *"><input className="inp" value={inv.descripcion} onChange={(e) => setInv({ ...inv, descripcion: e.target.value })} /></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Cantidad"><input type="number" className="inp" value={inv.cantidad} onChange={(e) => setInv({ ...inv, cantidad: Number(e.target.value) })} /></F>
            <F label="Precio unitario *"><input type="number" step="0.01" className="inp" value={inv.precio} onChange={(e) => setInv({ ...inv, precio: Number(e.target.value) })} /></F>
          </div>
          <div className="text-sm text-slate-500">Subtotal ${(inv.cantidad * inv.precio).toLocaleString('es-MX')} · IVA 16% · Total ${(inv.cantidad * inv.precio * 1.16).toLocaleString('es-MX')}</div>
          <button onClick={emitir} disabled={!hasActive} className="w-full py-2.5 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 disabled:opacity-50">Timbrar CFDI</button>
        </div>
      ) : (
        <div className="space-y-3 bg-white border border-slate-200 rounded-xl p-6">
          <F label="Proveedor PAC">
            <select className="inp" value={cfg.provider} onChange={(e) => setCfg({ ...cfg, provider: e.target.value })}>
              <option value="facturama">Facturama</option>
              <option value="facturapia">FacturAPI / FacturaPía</option>
            </select>
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="RFC emisor"><input className="inp" value={cfg.rfc ?? ''} onChange={(e) => setCfg({ ...cfg, rfc: e.target.value.toUpperCase() })} /></F>
            <F label="Régimen fiscal"><input className="inp" value={cfg.regimen_fiscal ?? ''} onChange={(e) => setCfg({ ...cfg, regimen_fiscal: e.target.value })} /></F>
          </div>
          <F label="Razón social"><input className="inp" value={cfg.razon_social ?? ''} onChange={(e) => setCfg({ ...cfg, razon_social: e.target.value })} /></F>
          <F label="CP fiscal"><input className="inp" value={cfg.codigo_postal_fiscal ?? ''} onChange={(e) => setCfg({ ...cfg, codigo_postal_fiscal: e.target.value })} /></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Usuario PAC / API user"><input className="inp" value={cfg.pac_user_enc ?? ''} onChange={(e) => setCfg({ ...cfg, pac_user_enc: e.target.value })} /></F>
            <F label="Password / API key"><input type="password" className="inp" value={cfg.pac_pass_enc ?? ''} onChange={(e) => setCfg({ ...cfg, pac_pass_enc: e.target.value })} /></F>
          </div>
          <F label="Modo">
            <select className="inp" value={cfg.mode} onChange={(e) => setCfg({ ...cfg, mode: e.target.value })}>
              <option value="sandbox">Sandbox (pruebas)</option>
              <option value="production">Producción</option>
            </select>
          </F>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={!!cfg.is_active} onChange={(e) => setCfg({ ...cfg, is_active: e.target.checked })} /> Proveedor activo
          </label>
          <button onClick={saveConfig} className="w-full py-2.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800">Guardar configuración</button>
        </div>
      )}

      {msg && <div className={`p-3 rounded-lg text-sm ${msg.startsWith('✅') ? 'bg-emerald-50 text-emerald-800' : msg.startsWith('⏳') ? 'bg-blue-50 text-blue-800' : 'bg-red-50 text-red-700'}`}>{msg}</div>}

      <style jsx>{`.inp{width:100%;border:1px solid #e2e8f0;border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem}.inp:focus{outline:none;box-shadow:0 0 0 2px #34d399}`}</style>
    </div>
  )
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-semibold text-slate-600 block mb-1">{label}</span>{children}</label>
}
