'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser, type SessionUser } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ROLES = [
  { value: 'accountant', label: 'Contador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'buyer', label: 'Comprador' },
  { value: 'collector', label: 'Cobrador' },
  { value: 'viewer', label: 'Visor' },
]

type Member = { user_id: string; role: string; status: string; profiles: { full_name: string; email: string } | { full_name: string; email: string }[] | null }

export default function ConfiguracionPage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(true)

  // cambio de contraseña
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pwLoading, setPwLoading] = useState(false)

  // equipo
  const [members, setMembers] = useState<Member[]>([])
  const [invEmail, setInvEmail] = useState('')
  const [invRole, setInvRole] = useState('buyer')
  const [invLoading, setInvLoading] = useState(false)
  const [invMsg, setInvMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const canManage = user?.role === 'owner' || user?.role === 'admin'

  useEffect(() => {
    ;(async () => {
      const u = await getSessionUser()
      setUser(u)
      if (u?.company_id) {
        const [compRes, memRes] = await Promise.all([
          supabase.from('companies').select('name').eq('id', u.company_id).maybeSingle(),
          supabase
            .from('company_members')
            .select('user_id, role, status, profiles(full_name, email)')
            .eq('company_id', u.company_id),
        ])
        setCompanyName(compRes.data?.name ?? '')
        setMembers((memRes.data ?? []) as unknown as Member[])
      }
      setLoading(false)
    })()
  }, [])

  async function changePassword() {
    if (!pwNew || pwNew.length < 8) { setPwMsg({ ok: false, text: 'Mínimo 8 caracteres.' }); return }
    if (pwNew !== pwConfirm) { setPwMsg({ ok: false, text: 'Las contraseñas no coinciden.' }); return }
    setPwLoading(true); setPwMsg(null)
    const { error } = await supabase.auth.updateUser({ password: pwNew })
    setPwLoading(false)
    if (error) setPwMsg({ ok: false, text: error.message })
    else { setPwMsg({ ok: true, text: '✅ Contraseña actualizada.' }); setPwNew(''); setPwConfirm('') }
  }

  async function inviteUser() {
    if (!invEmail.includes('@')) { setInvMsg({ ok: false, text: 'Correo inválido.' }); return }
    setInvLoading(true); setInvMsg(null)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ email: invEmail, role: invRole, company_id: user?.company_id }),
    })
    const json = await res.json()
    setInvLoading(false)
    if (!res.ok) { setInvMsg({ ok: false, text: json.error ?? 'Error al invitar.' }); return }
    setInvMsg({ ok: true, text: `✅ Invitación enviada a ${invEmail}.` })
    setInvEmail('')
    // refrescar lista
    const { data } = await supabase
      .from('company_members')
      .select('user_id, role, status, profiles(full_name, email)')
      .eq('company_id', user!.company_id)
    setMembers((data ?? []) as Member[])
  }

  async function removeMember(uid: string) {
    if (!confirm('¿Eliminar este miembro?')) return
    await supabase.from('company_members').delete().eq('user_id', uid).eq('company_id', user!.company_id)
    setMembers(m => m.filter(x => x.user_id !== uid))
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" /></div>

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900">⚙️ Configuración</h1>
        <p className="text-slate-500 mt-1">Ajustes de cuenta y empresa</p>
      </div>

      {/* Perfil */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h2 className="font-bold text-slate-900">Tu cuenta</h2>
        <Row label="Nombre" value={user?.full_name ?? '—'} />
        <Row label="Correo" value={user?.email ?? '—'} />
        <Row label="Rol" value={user?.role ?? '—'} capitalize />
      </section>

      {/* Cambiar contraseña */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-slate-900">Cambiar contraseña</h2>
        <div className="grid gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Nueva contraseña</label>
            <input
              type="password"
              value={pwNew}
              onChange={e => setPwNew(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Confirmar contraseña</label>
            <input
              type="password"
              value={pwConfirm}
              onChange={e => setPwConfirm(e.target.value)}
              placeholder="Repite la contraseña"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          {pwMsg && <p className={`text-sm font-medium ${pwMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{pwMsg.text}</p>}
          <button
            onClick={changePassword}
            disabled={pwLoading}
            className="px-4 py-2 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 text-sm disabled:opacity-50 w-fit"
          >
            {pwLoading ? 'Guardando...' : 'Actualizar contraseña'}
          </button>
        </div>
      </section>

      {/* Empresa */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h2 className="font-bold text-slate-900">Empresa</h2>
        <Row label="Nombre" value={companyName || '—'} />
        <Row label="ID" value={user?.company_id ?? '—'} mono />
      </section>

      {/* Equipo — solo owner/admin */}
      {canManage && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <h2 className="font-bold text-slate-900">Equipo</h2>

          {/* Lista de miembros */}
          <div className="space-y-2">
            {members.length === 0 && <p className="text-sm text-slate-400">Sin miembros aún.</p>}
            {members.map(m => {
              const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
              return (
              <div key={m.user_id} className="flex items-center justify-between border border-slate-100 rounded-lg px-4 py-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{p?.full_name ?? p?.email ?? m.user_id}</p>
                  <p className="text-xs text-slate-500">{p?.email} · <span className="capitalize">{m.role}</span> · <span className={m.status === 'active' ? 'text-emerald-600' : 'text-amber-500'}>{m.status}</span></p>
                </div>
                {m.user_id !== user?.id && (
                  <button onClick={() => removeMember(m.user_id)} className="text-xs text-red-500 hover:text-red-700 font-semibold px-2">Eliminar</button>
                )}
              </div>
              )
            })}
          </div>

          {/* Invitar usuario */}
          <div className="border-t border-slate-100 pt-5">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Invitar usuario</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <input
                type="email"
                value={invEmail}
                onChange={e => setInvEmail(e.target.value)}
                placeholder="correo@empresa.com"
                className="sm:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <select
                value={invRole}
                onChange={e => setInvRole(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {invMsg && <p className={`text-sm mt-2 font-medium ${invMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{invMsg.text}</p>}
            <button
              onClick={inviteUser}
              disabled={invLoading}
              className="mt-3 px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-700 text-sm disabled:opacity-50"
            >
              {invLoading ? 'Enviando...' : 'Enviar invitación'}
            </button>
          </div>
        </section>
      )}

      {/* Contabilidad */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h2 className="font-bold text-slate-900">Contabilidad</h2>
        <p className="text-sm text-slate-500">Actualiza el catálogo de cuentas, clasifica gastos y exporta pólizas.</p>
        <Link href="/gastocheck/polizas" className="inline-block px-4 py-2 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 text-sm">
          Abrir Plataforma del Contador →
        </Link>
      </section>
    </div>
  )
}

function Row({ label, value, mono, capitalize }: { label: string; value: string; mono?: boolean; capitalize?: boolean }) {
  return (
    <div className="flex justify-between items-center border-b border-slate-100 pb-2 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-medium text-slate-900 ${mono ? 'font-mono text-xs' : ''} ${capitalize ? 'capitalize' : ''}`}>{value}</span>
    </div>
  )
}
