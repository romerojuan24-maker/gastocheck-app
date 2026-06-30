'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Reembolso {
  id: string
  employee_email: string
  employee_id: string
  name: string | null
  notes: string | null
  total: number
  status: string
  created_at: string
}

interface ReceiptLine {
  id: string
  provider_name: string | null
  total_amount: number
  receipt_date: string | null
  fiscal_uuid: string | null
  sat_validation_status: string | null
  is_credit: boolean
  accounting_account_id: string | null
  accounting_account_code: string | null
  receipt_image_url: string | null
  // local state
  accepted: boolean
}

interface Policy {
  id: string
  name: string
  policy_type: string | null
  opening_balance: number
  created_at: string
  closed_at: string | null
}

interface Account {
  id: string
  code: string
  name: string
}

const money = (n: number | null | undefined) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n ?? 0)

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// ── Componente principal ───────────────────────────────────────────────────────

export default function PolizasWeb() {
  const [companyId, setCompanyId]   = useState<string | null>(null)
  const [section, setSection]       = useState<'reembolsos' | 'polizas'>('reembolsos')

  // Reembolsos
  const [reembolsos, setReembolsos]     = useState<Reembolso[]>([])
  const [loadingReb, setLoadingReb]     = useState(true)
  const [selectedReb, setSelectedReb]   = useState<Reembolso | null>(null)
  const [lines, setLines]               = useState<ReceiptLine[]>([])
  const [loadingLines, setLoadingLines] = useState(false)

  // Pólizas cerradas
  const [policies, setPolicies]     = useState<Policy[]>([])
  const [loadingPol, setLoadingPol] = useState(true)

  // Catálogo de cuentas contables
  const [accounts, setAccounts]           = useState<Account[]>([])
  const [acctSearch, setAcctSearch]       = useState('')
  const [acctTarget, setAcctTarget]       = useState<ReceiptLine | null>(null)
  const [savingAcct, setSavingAcct]       = useState(false)

  // Acciones
  const [validatingSat, setValidatingSat] = useState(false)
  const [generating, setGenerating]       = useState(false)
  const [satResult, setSatResult]         = useState<string | null>(null)

  // ── Carga ──────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    const user = await getSessionUser()
    if (!user?.company_id) return
    const cid = user.company_id
    setCompanyId(cid)

    // Reembolsos pendientes
    setLoadingReb(true)
    const { data: rebData } = await supabase
      .from('reembolsos')
      .select('id, employee_email, employee_id, name, notes, total, status, created_at')
      .eq('company_id', cid)
      .eq('status', 'pending_auth')
      .order('created_at', { ascending: false })
    setReembolsos((rebData ?? []) as Reembolso[])
    setLoadingReb(false)

    // Pólizas cerradas
    setLoadingPol(true)
    const { data: polData } = await supabase
      .from('policies')
      .select('id, name, policy_type, opening_balance, created_at, closed_at')
      .eq('company_id', cid)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
    setPolicies((polData ?? []) as Policy[])
    setLoadingPol(false)

    // Catálogo cuentas
    const { data: acctData } = await supabase
      .from('accounting_accounts')
      .select('id, code, name')
      .eq('company_id', cid)
      .eq('active', true)
      .order('code')
    setAccounts((acctData ?? []) as Account[])
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Abrir reembolso ────────────────────────────────────────────────────────

  async function openReembolso(r: Reembolso) {
    setSelectedReb(r)
    setLines([])
    setSatResult(null)
    setLoadingLines(true)
    const { data } = await supabase
      .from('receipt_reembolsos')
      .select('receipts(id, provider_name, total_amount, receipt_date, fiscal_uuid, sat_validation_status, is_credit, accounting_account_id, accounting_account_code, receipt_image_url)')
      .eq('reembolso_id', r.id)
    const parsed: ReceiptLine[] = (data ?? [])
      .map((item: any) => item.receipts)
      .filter(Boolean)
      .map((rec: any) => ({ ...rec, is_credit: rec.is_credit ?? false, accepted: true }))
    setLines(parsed)
    setLoadingLines(false)
  }

  // ── Toggle aceptar ─────────────────────────────────────────────────────────

  const toggleAccept = (id: string) =>
    setLines(prev => prev.map(r => r.id === id ? { ...r, accepted: !r.accepted } : r))

  // ── Asignar cuenta contable ────────────────────────────────────────────────

  async function assignAccount(acct: Account) {
    if (!acctTarget) return
    setSavingAcct(true)
    const { error } = await supabase.from('receipts').update({
      accounting_account_id: acct.id,
      accounting_account_code: acct.code,
    }).eq('id', acctTarget.id)
    if (!error) {
      setLines(prev => prev.map(r =>
        r.id === acctTarget.id
          ? { ...r, accounting_account_id: acct.id, accounting_account_code: acct.code }
          : r
      ))
    }
    setSavingAcct(false)
    setAcctTarget(null)
    setAcctSearch('')
  }

  // ── Validar SAT ────────────────────────────────────────────────────────────

  async function validateSat() {
    const fiscales = lines.filter(r => r.accepted && r.fiscal_uuid &&
      r.sat_validation_status !== 'validated' && r.sat_validation_status !== 'invalid')
    if (fiscales.length === 0) { setSatResult('Sin CFDI pendientes de validar.'); return }
    setValidatingSat(true)
    setSatResult(null)
    let ok = 0; let fail = 0
    for (const rec of fiscales) {
      try {
        const { data } = await supabase.functions.invoke('validate-cfdi', { body: { uuid: rec.fiscal_uuid } })
        const ns = data?.status === 'validated' ? 'validated' : 'invalid'
        await supabase.from('receipts').update({ sat_validation_status: ns }).eq('id', rec.id)
        setLines(prev => prev.map(r => r.id === rec.id ? { ...r, sat_validation_status: ns } : r))
        if (ns === 'validated') ok++; else fail++
      } catch { fail++ }
    }
    setValidatingSat(false)
    setSatResult(`✅ ${ok} vigente(s)   ❌ ${fail} cancelado(s) o no encontrado(s)`)
  }

  // ── Generar póliza ─────────────────────────────────────────────────────────

  async function generatePoliza() {
    if (!selectedReb || !companyId) return
    setGenerating(true)
    try {
      const accepted = lines.filter(r => r.accepted)
      const total    = accepted.reduce((s, r) => s + r.total_amount, 0)

      const { data: pol, error: polErr } = await supabase.from('policies').insert({
        company_id:      companyId,
        name:            selectedReb.name ?? `Reembolso ${selectedReb.employee_email} — ${fmtDate(selectedReb.created_at)}`,
        policy_type:     'reembolso',
        status:          'closed',
        holder_id:       selectedReb.employee_id,
        opening_balance: total,
        closed_at:       new Date().toISOString(),
      }).select('id').single()
      if (polErr) throw new Error(polErr.message)

      await supabase.from('reembolsos')
        .update({ status: 'closed', linked_policy_id: pol.id })
        .eq('id', selectedReb.id)

      const acceptedIds = accepted.map(r => r.id)
      if (acceptedIds.length > 0)
        await supabase.from('receipts').update({ status: 'closed_in_policy' }).in('id', acceptedIds)

      alert(`✅ Póliza generada por ${money(total)}\n\nEl reembolso quedó cerrado y los comprobantes marcados.`)
      setSelectedReb(null)
      setLines([])
      await loadAll()
    } catch (e: any) {
      alert(`Error: ${e.message}`)
    } finally {
      setGenerating(false)
    }
  }

  // ── Lógica de habilitación ─────────────────────────────────────────────────

  const accepted      = lines.filter(r => r.accepted)
  const allClassified = accepted.length > 0 && accepted.every(r => !!r.accounting_account_code)
  const hasCfdi       = accepted.some(r => !!r.fiscal_uuid)
  const allSatDone    = !hasCfdi || accepted.every(r =>
    !r.fiscal_uuid || r.sat_validation_status === 'validated' || r.sat_validation_status === 'invalid'
  )
  const canGenerate   = allClassified && allSatDone

  const filteredAccounts = accounts.filter(a => {
    const q = acctSearch.toLowerCase()
    return !q || a.code.startsWith(q) || a.name.toLowerCase().includes(q)
  }).slice(0, 50)

  // ── RENDER: Vista de detalle de reembolso ──────────────────────────────────

  if (selectedReb) {
    const totalAceptado = accepted.reduce((s, r) => s + r.total_amount, 0)

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedReb(null); setLines([]) }}
            className="text-blue-600 hover:underline font-medium text-sm"
          >
            ← Reembolsos pendientes
          </button>
          <span className="text-slate-400">/</span>
          <span className="text-slate-600 text-sm truncate">{selectedReb.employee_email}</span>
        </div>

        {/* Header reembolso */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {selectedReb.name ?? `Reembolso de ${selectedReb.employee_email}`}
              </h2>
              <p className="text-slate-500 text-sm mt-1">{selectedReb.employee_email} · {fmtDate(selectedReb.created_at)}</p>
              {selectedReb.notes && <p className="text-slate-600 text-sm mt-1 italic">{selectedReb.notes}</p>}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">{money(selectedReb.total)}</p>
              <span className="inline-block bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-1 rounded-full mt-1">
                ⏳ Pendiente de clasificar
              </span>
            </div>
          </div>
        </div>

        {/* Instrucción */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <strong>Flujo contable:</strong> (1) Revisa cada comprobante y haz clic en "Ver imagen".
          (2) Acepta o rechaza. (3) Asigna cuenta contable a los aceptados.
          (4) Valida CFDIs en SAT. (5) Genera la póliza.
        </div>

        {/* Lista de comprobantes */}
        {loadingLines ? (
          <div className="text-center py-16 text-slate-400">Cargando comprobantes...</div>
        ) : lines.length === 0 ? (
          <div className="text-center py-16 text-slate-400">Sin comprobantes en este reembolso</div>
        ) : (
          <div className="space-y-3">
            {lines.map(rec => {
              const satOk   = rec.sat_validation_status === 'validated'
              const satBad  = rec.sat_validation_status === 'invalid'
              const satPend = !!rec.fiscal_uuid && !rec.sat_validation_status

              return (
                <div
                  key={rec.id}
                  className={`bg-white rounded-xl border p-5 transition-opacity ${!rec.accepted ? 'opacity-50 border-slate-200' : 'border-slate-200'}`}
                >
                  {/* Fila superior */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">
                        {rec.provider_name ?? '(sin proveedor)'}
                      </p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {fmtDate(rec.receipt_date)}
                        {' · '}
                        {rec.is_credit ? '💳 Pago corporativo' : '💵 Pago propio'}
                      </p>
                      {rec.fiscal_uuid && (
                        <span className={`inline-block text-xs font-semibold mt-1 px-2 py-0.5 rounded-full
                          ${satOk  ? 'bg-green-100 text-green-800'
                          : satBad ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'}`}>
                          {satOk ? '✅ CFDI Vigente' : satBad ? '❌ CFDI Cancelado' : '⏳ CFDI sin validar'}
                        </span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-slate-900">{money(rec.total_amount)}</p>
                      {rec.receipt_image_url && (
                        <a
                          href={rec.receipt_image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline font-medium mt-1 inline-block"
                        >
                          👁 Ver imagen
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Cuenta contable */}
                  <div className="mt-3">
                    <button
                      onClick={() => { setAcctTarget(rec); setAcctSearch('') }}
                      className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition
                        ${rec.accounting_account_code
                          ? 'bg-green-50 border-green-200 text-green-800 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-400'}`}
                    >
                      {rec.accounting_account_code
                        ? `📒 ${rec.accounting_account_code}`
                        : '+ Asignar cuenta contable'}
                    </button>
                  </div>

                  {/* Aceptar / Rechazar */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => { if (!rec.accepted) toggleAccept(rec.id) }}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition
                        ${rec.accepted
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-green-400'}`}
                    >
                      ✓ {rec.accepted ? 'Aceptado' : 'Aceptar'}
                    </button>
                    <button
                      onClick={() => { if (rec.accepted) toggleAccept(rec.id) }}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition
                        ${!rec.accepted
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-red-400'}`}
                    >
                      ✗ {!rec.accepted ? 'Rechazado' : 'Rechazar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Resumen y acciones */}
        {lines.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Comprobantes aceptados</span>
              <span className="font-semibold">{accepted.length} / {lines.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Total a reembolsar</span>
              <span className="text-2xl font-bold text-green-700">{money(totalAceptado)}</span>
            </div>

            {!allClassified && (
              <p className="text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                ⚠️ Asigna cuenta contable a cada comprobante aceptado antes de continuar
              </p>
            )}
            {allClassified && hasCfdi && !allSatDone && (
              <p className="text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                🔍 Tienes CFDIs sin validar en SAT. Valídalos antes de generar la póliza.
              </p>
            )}
            {satResult && (
              <p className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">{satResult}</p>
            )}

            {/* Validar SAT */}
            {allClassified && hasCfdi && !allSatDone && (
              <button
                onClick={validateSat}
                disabled={validatingSat}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition"
              >
                {validatingSat ? 'Validando CFDIs...' : '🔍 Validar en SAT'}
              </button>
            )}

            {/* Generar póliza */}
            {canGenerate && (
              <button
                onClick={generatePoliza}
                disabled={generating}
                className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold rounded-xl transition text-lg"
              >
                {generating ? 'Generando póliza...' : '📋 Generar Póliza'}
              </button>
            )}
          </div>
        )}

        {/* Modal: asignar cuenta contable */}
        {acctTarget && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] flex flex-col">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Cuenta Contable</h3>
                <p className="text-sm text-slate-500 truncate">
                  {acctTarget.provider_name ?? '(sin proveedor)'} — {money(acctTarget.total_amount)}
                </p>
              </div>
              <input
                type="text"
                placeholder="Código (ej: 605) o nombre..."
                value={acctSearch}
                onChange={e => setAcctSearch(e.target.value)}
                autoFocus
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="overflow-y-auto flex-1 -mx-2">
                {filteredAccounts.map(a => (
                  <button
                    key={a.id}
                    onClick={() => assignAccount(a)}
                    disabled={savingAcct}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-xl transition
                      ${acctTarget.accounting_account_id === a.id ? 'bg-green-50' : ''}`}
                  >
                    <span className="font-mono text-sm font-bold text-slate-900 w-16 shrink-0">{a.code}</span>
                    <span className="text-sm text-slate-600 flex-1 truncate">{a.name}</span>
                    {acctTarget.accounting_account_id === a.id && (
                      <span className="text-green-600 font-bold">✓</span>
                    )}
                  </button>
                ))}
                {filteredAccounts.length === 0 && (
                  <p className="text-center text-slate-400 py-8 text-sm">Sin resultados</p>
                )}
              </div>
              <button
                onClick={() => { setAcctTarget(null); setAcctSearch('') }}
                className="w-full py-3 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── RENDER: Lista principal ────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Pólizas</h1>
          <p className="text-slate-600 mt-1">Revisión y aprobación de reembolsos de empleados</p>
        </div>
        <button
          onClick={loadAll}
          className="text-sm text-blue-600 hover:underline font-medium"
        >
          ↻ Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200">
        {([
          { key: 'reembolsos', label: `📋 Reembolsos pendientes${reembolsos.length > 0 ? ` (${reembolsos.length})` : ''}` },
          { key: 'polizas',    label: '✅ Pólizas cerradas' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setSection(t.key)}
            className={`px-5 py-3 font-medium text-sm transition-colors border-b-2
              ${section === t.key
                ? 'border-green-600 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Sección 1: Reembolsos pendientes ─────────────────────────────── */}
      {section === 'reembolsos' && (
        loadingReb ? (
          <div className="text-center py-20 text-slate-400">Cargando reembolsos...</div>
        ) : reembolsos.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">✅</p>
            <p className="text-xl font-semibold text-slate-400">Sin reembolsos pendientes</p>
            <p className="text-slate-400 text-sm mt-2">Cuando un empleado envíe un reembolso aparecerá aquí</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reembolsos.map(r => (
              <button
                key={r.id}
                onClick={() => openReembolso(r)}
                className="w-full bg-white rounded-xl border border-slate-200 p-5 text-left hover:border-blue-300 hover:shadow-sm transition group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">
                      {r.name ?? r.employee_email}
                    </p>
                    <p className="text-sm text-slate-500 mt-0.5">{r.employee_email}</p>
                    <p className="text-xs text-slate-400 mt-1">{fmtDate(r.created_at)}</p>
                    {r.notes && <p className="text-xs text-slate-500 mt-1 italic truncate">{r.notes}</p>}
                    <span className="inline-block mt-2 bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                      ⏳ Pendiente de clasificar
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-slate-900">{money(r.total)}</p>
                    <span className="text-blue-600 text-sm font-medium group-hover:underline mt-1 inline-block">
                      Revisar →
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {/* ── Sección 2: Pólizas cerradas ───────────────────────────────────── */}
      {section === 'polizas' && (
        loadingPol ? (
          <div className="text-center py-20 text-slate-400">Cargando pólizas...</div>
        ) : policies.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📋</p>
            <p className="text-xl font-semibold text-slate-400">Sin pólizas cerradas</p>
            <p className="text-slate-400 text-sm mt-2">Las pólizas generadas aparecerán aquí</p>
          </div>
        ) : (
          <div className="space-y-3">
            {policies.map(p => (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Cerrada: {fmtDate(p.closed_at ?? p.created_at)}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                        {p.policy_type === 'reembolso' ? '↩ Reembolso' : '💼 Anticipo'}
                      </span>
                      <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                        🔒 Cerrada
                      </span>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 shrink-0">{money(p.opening_balance)}</p>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
