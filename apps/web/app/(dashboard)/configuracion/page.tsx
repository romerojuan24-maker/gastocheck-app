'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, getSessionUser, type SessionUser, type UserRole } from '@/lib/supabase'

// ─── Definición de roles ────────────────────────────────────────────────────

type RoleDef = {
  label:       string
  description: string
  badge:       string   // clases Tailwind para el badge
  avatar:      string   // clases Tailwind para el avatar
  modules:     { icon: string; name: string }[]
}

const ROLES_DEF: Record<string, RoleDef> = {
  owner: {
    label: 'Dueño',
    description: 'Acceso completo al sistema, incluida configuración avanzada',
    badge:  'bg-violet-100 text-violet-700 border border-violet-200',
    avatar: 'bg-violet-500',
    modules: [
      { icon: '🧾', name: 'GastoCheck' },
      { icon: '💰', name: 'CobraCheck' },
      { icon: '🏦', name: 'BancoCheck' },
      { icon: '📈', name: 'FlujoCheck' },
      { icon: '📄', name: 'FacturaCheck' },
      { icon: '📦', name: 'Inventario' },
      { icon: '🤖', name: 'Advisor IA' },
    ],
  },
  admin: {
    label: 'Administrador',
    description: 'Todos los módulos operativos sin restricciones',
    badge:  'bg-blue-100 text-blue-700 border border-blue-200',
    avatar: 'bg-blue-500',
    modules: [
      { icon: '🧾', name: 'GastoCheck' },
      { icon: '💰', name: 'CobraCheck' },
      { icon: '🏦', name: 'BancoCheck' },
      { icon: '📈', name: 'FlujoCheck' },
      { icon: '📄', name: 'FacturaCheck' },
      { icon: '📦', name: 'Inventario' },
      { icon: '🤖', name: 'Advisor IA' },
    ],
  },
  accountant: {
    label: 'Contador',
    description: 'Gastos, banco, flujo de caja y facturación electrónica',
    badge:  'bg-emerald-100 text-emerald-700 border border-emerald-200',
    avatar: 'bg-emerald-500',
    modules: [
      { icon: '🧾', name: 'GastoCheck' },
      { icon: '🏦', name: 'BancoCheck' },
      { icon: '📈', name: 'FlujoCheck' },
      { icon: '📄', name: 'FacturaCheck' },
      { icon: '🤖', name: 'Advisor IA' },
    ],
  },
  supervisor: {
    label: 'Supervisor',
    description: 'Aprueba anticipos y gastos, supervisa cobranza',
    badge:  'bg-amber-100 text-amber-700 border border-amber-200',
    avatar: 'bg-amber-500',
    modules: [
      { icon: '🧾', name: 'GastoCheck' },
      { icon: '💰', name: 'CobraCheck' },
      { icon: '📦', name: 'Inventario' },
    ],
  },
  buyer: {
    label: 'Comprador',
    description: 'Registra gastos, sube comprobantes y solicita anticipos',
    badge:  'bg-orange-100 text-orange-700 border border-orange-200',
    avatar: 'bg-orange-500',
    modules: [
      { icon: '🧾', name: 'GastoCheck' },
    ],
  },
  spender: {
    label: 'Comprador',
    description: 'Registra gastos, sube comprobantes y solicita anticipos',
    badge:  'bg-orange-100 text-orange-700 border border-orange-200',
    avatar: 'bg-orange-500',
    modules: [
      { icon: '🧾', name: 'GastoCheck' },
    ],
  },
  collector: {
    label: 'Cobrador',
    description: 'Gestiona rutas de cobranza y registra pagos de clientes',
    badge:  'bg-teal-100 text-teal-700 border border-teal-200',
    avatar: 'bg-teal-500',
    modules: [
      { icon: '💰', name: 'CobraCheck' },
    ],
  },
  viewer: {
    label: 'Visor',
    description: 'Solo lectura: puede ver gastos y cobranza sin modificar',
    badge:  'bg-slate-100 text-slate-600 border border-slate-200',
    avatar: 'bg-slate-400',
    modules: [
      { icon: '🧾', name: 'GastoCheck' },
      { icon: '💰', name: 'CobraCheck' },
    ],
  },
}

// Roles que se pueden asignar al invitar (owner no se puede invitar)
const INVITABLE_ROLES = ['admin', 'accountant', 'supervisor', 'spender', 'collector', 'viewer']

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Member = {
  user_id:  string
  role:     string
  status:   string
  profiles: { full_name: string | null } | null
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function Avatar({ name, role, size = 'md' }: { name: string; role: string; size?: 'sm' | 'md' }) {
  const def   = ROLES_DEF[role]
  const color = def?.avatar ?? 'bg-slate-400'
  const sz    = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center text-white font-bold shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  const def = ROLES_DEF[role]
  if (!def) return <span className="text-xs text-slate-400 capitalize">{role}</span>
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${def.badge}`}>
      {def.label}
    </span>
  )
}

function RolePicker({
  selected,
  onSelect,
  roles = INVITABLE_ROLES,
}: {
  selected: string
  onSelect: (r: string) => void
  roles?: string[]
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {roles.map(r => {
        const def     = ROLES_DEF[r]
        const isActive = r === selected
        if (!def) return null
        return (
          <button
            key={r}
            type="button"
            onClick={() => onSelect(r)}
            className={`text-left p-3 rounded-xl border-2 transition-all ${
              isActive
                ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <p className={`text-xs font-bold mb-0.5 ${isActive ? 'text-emerald-700' : 'text-slate-900'}`}>
              {def.label}
            </p>
            <p className="text-xs text-slate-500 mb-2 leading-tight line-clamp-2">{def.description}</p>
            <div className="flex flex-wrap gap-0.5">
              {def.modules.map(m => (
                <span key={m.name} className="text-xs bg-slate-100 text-slate-600 rounded px-1 py-0.5">
                  {m.icon}
                </span>
              ))}
            </div>
          </button>
        )
      })}
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

// ─── Página ──────────────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const [user, setUser]             = useState<SessionUser | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading]       = useState(true)

  // cambio de contraseña
  const [pwNew, setPwNew]         = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwMsg, setPwMsg]         = useState<{ ok: boolean; text: string } | null>(null)
  const [pwLoading, setPwLoading] = useState(false)

  // equipo
  const [members, setMembers]     = useState<Member[]>([])
  const [invEmail, setInvEmail]   = useState('')
  const [invRole, setInvRole]     = useState('spender')
  const [invLoading, setInvLoading] = useState(false)
  const [invMsg, setInvMsg]       = useState<{ ok: boolean; text: string } | null>(null)
  const [showInvite, setShowInvite] = useState(false)

  // cambio de rol inline
  const [editingRole, setEditingRole]   = useState<string | null>(null)  // user_id en edición
  const [pendingRole, setPendingRole]   = useState('')
  const [roleLoading, setRoleLoading]   = useState(false)
  const [roleMsg, setRoleMsg]           = useState<{ uid: string; ok: boolean; text: string } | null>(null)

  const canManage = user?.role === 'owner' || user?.role === 'admin'

  // ── Carga inicial ─────────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      try {
        const u = await getSessionUser()
        setUser(u)
        if (u?.company_id) {
          const [compRes, memRes] = await Promise.all([
            supabase.from('companies').select('name').eq('id', u.company_id).maybeSingle(),
            supabase.from('company_members').select('user_id, role, status').eq('company_id', u.company_id),
          ])
          setCompanyName(compRes.data?.name ?? '')
          await loadMembersWithProfiles(memRes.data ?? [])
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function loadMembersWithProfiles(rawMembers: { user_id: string; role: string; status: string }[]) {
    const userIds = rawMembers.map(m => m.user_id)
    const { data: profilesData } = userIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
      : { data: [] }
    const profileMap = Object.fromEntries((profilesData ?? []).map(p => [p.id, p]))
    setMembers(rawMembers.map(m => ({ ...m, profiles: profileMap[m.user_id] ?? null })))
  }

  // ── Cambiar contraseña ───────────────────────────────────────────────────
  async function changePassword() {
    if (!pwNew || pwNew.length < 8) { setPwMsg({ ok: false, text: 'Mínimo 8 caracteres.' }); return }
    if (pwNew !== pwConfirm) { setPwMsg({ ok: false, text: 'Las contraseñas no coinciden.' }); return }
    setPwLoading(true); setPwMsg(null)
    const { error } = await supabase.auth.updateUser({ password: pwNew })
    setPwLoading(false)
    if (error) setPwMsg({ ok: false, text: error.message })
    else { setPwMsg({ ok: true, text: '✅ Contraseña actualizada.' }); setPwNew(''); setPwConfirm('') }
  }

  // ── Invitar usuario ─────────────────────────────────────────────────────
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
    setShowInvite(false)
    // refrescar lista
    const { data: rawData } = await supabase.from('company_members').select('user_id, role, status').eq('company_id', user!.company_id)
    await loadMembersWithProfiles(rawData ?? [])
  }

  // ── Cambiar rol de miembro ───────────────────────────────────────────────
  async function changeRole(uid: string) {
    if (!pendingRole || pendingRole === members.find(m => m.user_id === uid)?.role) {
      setEditingRole(null); return
    }
    setRoleLoading(true); setRoleMsg(null)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/members/${uid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ role: pendingRole, company_id: user?.company_id }),
    })
    const json = await res.json()
    setRoleLoading(false)
    if (!res.ok) {
      setRoleMsg({ uid, ok: false, text: json.error ?? 'Error al cambiar rol.' })
    } else {
      setMembers(prev => prev.map(m => m.user_id === uid ? { ...m, role: pendingRole } : m))
      setRoleMsg({ uid, ok: true, text: '✅ Rol actualizado.' })
      setEditingRole(null)
    }
  }

  // ── Desactivar miembro ────────────────────────────────────────────────────
  // Soft-disable (igual que mobile equipo.tsx): conserva la fila para auditoría;
  // las RLS filtran status='active' así que pierde acceso de inmediato.
  async function removeMember(uid: string) {
    if (!confirm('¿Desactivar a este miembro del equipo?')) return
    await supabase.from('company_members').update({ status: 'disabled' }).eq('user_id', uid).eq('company_id', user!.company_id)
    setMembers(m => m.filter(x => x.user_id !== uid))
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">Configuración</h1>
        <p className="text-slate-500 text-sm mt-1">Ajustes de cuenta, empresa y equipo</p>
      </div>

      {/* ── Tu cuenta ── */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <Avatar name={user?.full_name ?? user?.email ?? 'U'} role={user?.role ?? 'viewer'} />
          <div>
            <p className="font-bold text-slate-900 text-sm">{user?.full_name ?? '—'}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <div className="ml-auto">
            <RoleBadge role={user?.role ?? ''} />
          </div>
        </div>
        <div className="px-6 py-4">
          <Row label="Empresa" value={companyName || '—'} />
          <Row label="ID empresa" value={user?.company_id ?? '—'} mono />
        </div>
      </section>

      {/* ── Cambiar contraseña ── */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-slate-900 text-sm">Cambiar contraseña</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Nueva contraseña</label>
            <input
              type="password"
              value={pwNew}
              onChange={e => setPwNew(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Confirmar contraseña</label>
            <input
              type="password"
              value={pwConfirm}
              onChange={e => setPwConfirm(e.target.value)}
              placeholder="Repite la contraseña"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        </div>
        {pwMsg && <p className={`text-sm font-medium ${pwMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{pwMsg.text}</p>}
        <button
          onClick={changePassword}
          disabled={pwLoading}
          className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-700 text-sm disabled:opacity-50 transition-colors"
        >
          {pwLoading ? 'Guardando...' : 'Actualizar contraseña'}
        </button>
      </section>

      {/* ── Equipo — solo owner/admin ── */}
      {canManage && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Equipo</h2>
              <p className="text-xs text-slate-500 mt-0.5">{members.length} {members.length === 1 ? 'miembro' : 'miembros'}</p>
            </div>
            <button
              onClick={() => { setShowInvite(v => !v); setInvMsg(null) }}
              className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 transition-colors"
            >
              {showInvite ? '✕ Cancelar' : '+ Invitar'}
            </button>
          </div>

          {/* Formulario de invitación */}
          {showInvite && (
            <div className="px-6 py-5 border-b border-slate-100 space-y-4 bg-slate-50">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Correo electrónico</label>
                <input
                  type="email"
                  value={invEmail}
                  onChange={e => setInvEmail(e.target.value)}
                  placeholder="correo@empresa.com"
                  className="w-full max-w-sm border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-2">Rol y accesos</label>
                <RolePicker selected={invRole} onSelect={setInvRole} />
              </div>
              {invMsg && <p className={`text-sm font-medium ${invMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{invMsg.text}</p>}
              <button
                onClick={inviteUser}
                disabled={invLoading}
                className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-700 text-sm disabled:opacity-50 transition-colors"
              >
                {invLoading ? 'Enviando invitación...' : 'Enviar invitación'}
              </button>
            </div>
          )}

          {/* Lista de miembros */}
          <div className="divide-y divide-slate-100">
            {members.length === 0 && (
              <p className="px-6 py-4 text-sm text-slate-400">Sin miembros aún.</p>
            )}
            {members.map(m => {
              const name      = m.profiles?.full_name ?? m.user_id.slice(0, 8) + '…'
              const isMe      = m.user_id === user?.id
              const isEditing = editingRole === m.user_id
              const canEdit   = canManage && !isMe && m.role !== 'owner'

              return (
                <div key={m.user_id} className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={name} role={m.role} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
                        {isMe && <span className="text-xs text-slate-400">(tú)</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <RoleBadge role={m.role} />
                        <span className={`text-xs ${m.status === 'active' ? 'text-emerald-600' : 'text-amber-500'}`}>
                          {m.status === 'active' ? '● activo' : '○ invitado'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canEdit && !isEditing && (
                        <button
                          onClick={() => { setEditingRole(m.user_id); setPendingRole(m.role); setRoleMsg(null) }}
                          className="text-xs text-slate-400 hover:text-slate-700 font-medium transition-colors px-2 py-1 rounded hover:bg-slate-100"
                        >
                          Cambiar rol
                        </button>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => removeMember(m.user_id)}
                          className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors px-2 py-1 rounded hover:bg-red-50"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Editor de rol inline */}
                  {isEditing && (
                    <div className="mt-4 pl-10 space-y-3">
                      <RolePicker
                        selected={pendingRole}
                        onSelect={setPendingRole}
                        roles={INVITABLE_ROLES}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => changeRole(m.user_id)}
                          disabled={roleLoading}
                          className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
                        >
                          {roleLoading ? 'Guardando...' : 'Guardar cambio'}
                        </button>
                        <button
                          onClick={() => { setEditingRole(null); setRoleMsg(null) }}
                          className="text-xs text-slate-500 hover:text-slate-700 px-2"
                        >
                          Cancelar
                        </button>
                      </div>
                      {roleMsg?.uid === m.user_id && (
                        <p className={`text-xs font-medium ${roleMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                          {roleMsg.text}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Accesos por rol — referencia visual ── */}
      {canManage && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="font-bold text-slate-900 text-sm">Referencia de accesos por rol</h2>
            <p className="text-xs text-slate-500 mt-0.5">Qué puede ver y hacer cada rol en el sistema</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(ROLES_DEF).filter(([r]) => r !== 'owner').map(([r, def]) => (
              <div key={r} className="border border-slate-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-6 h-6 ${def.avatar} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
                    {def.label.charAt(0)}
                  </div>
                  <span className="text-sm font-bold text-slate-900">{def.label}</span>
                </div>
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">{def.description}</p>
                <div className="flex flex-wrap gap-1">
                  {def.modules.map(m => (
                    <span key={m.name} className="text-xs bg-slate-100 text-slate-600 rounded-md px-2 py-0.5 font-medium">
                      {m.icon} {m.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Plataforma del Contador ── */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold text-slate-900 text-sm">Plataforma del Contador</h2>
            <p className="text-sm text-slate-500 mt-1">Catálogo de cuentas, clasificación contable y exportación de pólizas CONTPAQi.</p>
          </div>
          <Link
            href="/gastocheck/polizas"
            className="shrink-0 px-4 py-2 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 text-sm transition-colors"
          >
            Abrir →
          </Link>
        </div>
      </section>

    </div>
  )
}
