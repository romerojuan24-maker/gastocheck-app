'use client'

// BancoCheck — Conciliación cruzada. Aquí vive el VoBo del contador: el
// motor de matching (Edge Function bancocheck-auto-match) solo PROPONE
// (bank_match_suggestions status='pending'); nada se aplica a un movimiento
// hasta que el contador aprueba explícitamente cada sugerencia. Ver regla
// del usuario: "el contador debe SIEMPRE tener el VoBo de la aplicación."
import { useEffect, useState, useCallback } from 'react'
import { supabase, getSessionUser } from '@/lib/supabase'
import type { BankTransaction, BankMatchSuggestion } from '@/lib/bancocheck-types'
import { generatePolizaFromBankMatches, type ReconciledBankTransaction } from '@/lib/poliza'
import { PolizaDownload } from '@/components/PolizaDownload'

const CONTADOR_ROLES = ['owner', 'admin', 'supervisor', 'accountant', 'contador_general']

const money = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

type EnrichedSuggestion = BankMatchSuggestion & {
  txn?: BankTransaction & { bank_account_name?: string }
  candidateLabel: string
}

export default function ConciliacionPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [suggestions, setSuggestions] = useState<EnrichedSuggestion[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [approvedToday, setApprovedToday] = useState<ReconciledBankTransaction[]>([])
  const [poliza, setPoliza] = useState<ReturnType<typeof generatePolizaFromBankMatches> | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async (cid: string) => {
    setLoading(true)
    try {
      const { data: suggRows } = await supabase
        .from('bank_match_suggestions')
        .select('*')
        .eq('company_id', cid)
        .eq('status', 'pending')
        .order('confidence', { ascending: false })

      const rows = (suggRows ?? []) as BankMatchSuggestion[]
      if (rows.length === 0) { setSuggestions([]); setLoading(false); return }

      const txnIds = Array.from(new Set(rows.map(r => r.transaction_id)))
      const { data: txns } = await supabase
        .from('bank_transactions')
        .select('*, bank_accounts(name)')
        .in('id', txnIds)
      const txnMap = new Map((txns ?? []).map((t: any) => [t.id, { ...t, bank_account_name: t.bank_accounts?.name }]))

      const invoiceIds = rows.filter(r => r.match_type === 'invoice').map(r => r.match_id)
      const advanceIds = rows.filter(r => r.match_type === 'advance').map(r => r.match_id)
      const receiptIds = rows.filter(r => r.match_type === 'receipt').map(r => r.match_id)
      const transferIds = rows.filter(r => r.match_type === 'transfer').map(r => r.match_id)

      const [{ data: invoices }, { data: advances }, { data: receipts }, { data: transferTxns }] = await Promise.all([
        invoiceIds.length ? supabase.from('cobra_invoices').select('id, folio, amount, cobra_clients(name)').in('id', invoiceIds) : Promise.resolve({ data: [] as any[] }),
        advanceIds.length ? supabase.from('advances').select('id, amount, concept').in('id', advanceIds) : Promise.resolve({ data: [] as any[] }),
        receiptIds.length ? supabase.from('receipts').select('id, provider_name, total_amount').in('id', receiptIds) : Promise.resolve({ data: [] as any[] }),
        transferIds.length ? supabase.from('bank_transactions').select('id, description, bank_account_id, bank_accounts(name)').in('id', transferIds) : Promise.resolve({ data: [] as any[] }),
      ])
      const invoiceMap = new Map((invoices ?? []).map((i: any) => [i.id, i]))
      const advanceMap = new Map((advances ?? []).map((a: any) => [a.id, a]))
      const receiptMap = new Map((receipts ?? []).map((r: any) => [r.id, r]))
      const transferMap = new Map((transferTxns ?? []).map((t: any) => [t.id, t]))

      const enriched: EnrichedSuggestion[] = rows.map(s => {
        let candidateLabel = '—'
        if (s.match_type === 'invoice') {
          const inv = invoiceMap.get(s.match_id)
          candidateLabel = inv ? `Factura ${inv.folio ?? inv.id} — ${inv.cobra_clients?.name ?? 'cliente'} (${money(inv.amount)})` : 'Factura'
        } else if (s.match_type === 'advance') {
          const adv = advanceMap.get(s.match_id)
          candidateLabel = adv ? `Anticipo ${adv.concept ?? ''} (${money(adv.amount)})` : 'Anticipo'
        } else if (s.match_type === 'receipt') {
          const r = receiptMap.get(s.match_id)
          candidateLabel = r ? `Comprobante — ${r.provider_name ?? 'proveedor'} (${money(r.total_amount)})` : 'Comprobante'
        } else if (s.match_type === 'transfer') {
          const t = transferMap.get(s.match_id)
          candidateLabel = t ? `Transferencia con ${t.bank_accounts?.name ?? 'otra cuenta'} — "${t.description}"` : 'Transferencia entre cuentas propias'
        }
        return { ...s, txn: txnMap.get(s.transaction_id), candidateLabel }
      })

      setSuggestions(enriched)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadApprovedToday = useCallback(async (cid: string) => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const { data } = await supabase
      .from('bank_transactions')
      .select('*, bank_accounts(name)')
      .eq('company_id', cid)
      .eq('status', 'explained')
      .gte('updated_at', todayStart.toISOString())
      .order('updated_at', { ascending: false })

    setApprovedToday((data ?? []).map((t: any) => ({
      id: t.id,
      bank_account_name: t.bank_accounts?.name ?? 'Cuenta',
      transaction_date: t.transaction_date,
      description: t.description,
      amount: t.amount,
      category: t.category,
      matched_entity_type: t.matched_entity_type,
    })))
  }, [])

  useEffect(() => {
    (async () => {
      const u = await getSessionUser()
      if (!u?.company_id) { setLoading(false); return }
      setCompanyId(u.company_id)
      setUserEmail(u.email)
      setAllowed(CONTADOR_ROLES.includes(u.role))
      if (CONTADOR_ROLES.includes(u.role)) {
        await Promise.all([load(u.company_id), loadApprovedToday(u.company_id)])
      } else {
        setLoading(false)
      }
    })()
  }, [load, loadApprovedToday])

  async function runMatching() {
    if (!companyId) return
    setAnalyzing(true)
    setNotice(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/bancocheck-auto-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ company_id: companyId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al analizar movimientos')
      setNotice(`Analizados ${json.processed} movimiento(s), ${json.suggested} sugerencia(s) nueva(s).`)
      await load(companyId)
    } catch (err: any) {
      setNotice('Error: ' + err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  async function approve(s: EnrichedSuggestion) {
    setBusyId(s.id)
    try {
      const { error } = await supabase.rpc('bancocheck_approve_suggestion', { p_suggestion_id: s.id })
      if (error) throw error
      if (companyId) { await load(companyId); await loadApprovedToday(companyId) }
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function reject(s: EnrichedSuggestion) {
    setBusyId(s.id)
    try {
      const { error } = await supabase.rpc('bancocheck_reject_suggestion', { p_suggestion_id: s.id })
      if (error) throw error
      if (companyId) await load(companyId)
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function generateVoucher() {
    if (!companyId || approvedToday.length === 0) return
    const labeled: ReconciledBankTransaction[] = approvedToday.map(t => ({ ...t }))
    const p = generatePolizaFromBankMatches(labeled, { id: companyId }, userEmail)
    setPoliza(p)

    const totalDebe = p.lineas.reduce((s, l) => s + l.debe, 0)
    const totalHaber = p.lineas.reduce((s, l) => s + l.haber, 0)
    await supabase.from('accounting_vouchers').insert({
      company_id: companyId,
      voucher_number: p.noPoliza,
      voucher_type: 'TRANSFER',
      source_module: 'bancocheck',
      source_ids: approvedToday.map(t => t.id),
      total_debit: totalDebe,
      total_credit: totalHaber,
      currency: 'MXN',
      entries: p.lineas,
      status: 'draft',
    })
  }

  if (loading) return <div className="flex items-center justify-center h-96 text-slate-600">Cargando…</div>
  if (allowed === false) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center text-slate-500">
        <p className="text-4xl mb-3">🔒</p>
        <p className="font-bold text-slate-900">Sin acceso a Conciliación</p>
        <p className="text-sm mt-1">Solo contadores y administradores pueden aprobar conciliaciones bancarias.</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">🔗 Conciliación Cruzada</h1>
          <p className="text-slate-500 mt-1">GastoCheck, CobraCheck y transferencias entre cuentas — todo requiere tu VoBo.</p>
        </div>
        <button onClick={runMatching} disabled={analyzing}
          className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm whitespace-nowrap">
          {analyzing ? 'Analizando…' : '🤖 Analizar movimientos'}
        </button>
      </div>

      {notice && <div className="text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3">{notice}</div>}

      <div>
        <h2 className="font-bold text-slate-900 mb-3">Pendientes de tu VoBo ({suggestions.length})</h2>
        {suggestions.length === 0 ? (
          <div className="p-10 text-center text-slate-400 border border-dashed border-slate-200 rounded-lg">
            Sin sugerencias pendientes. Usa "Analizar movimientos" para buscar coincidencias nuevas.
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map(s => (
              <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-400">{s.txn?.bank_account_name} · {s.txn && new Date(s.txn.transaction_date).toLocaleDateString('es-MX')}</p>
                    <p className="font-semibold text-slate-900 truncate">{s.txn?.description}</p>
                    <p className={`font-bold ${((s.txn?.amount ?? 0) >= 0) ? 'text-emerald-600' : 'text-red-600'}`}>
                      {money(Math.abs(s.txn?.amount ?? 0))}
                    </p>
                    <p className="text-sm text-slate-600 mt-2">↔ {s.candidateLabel}</p>
                    {s.reason && <p className="text-xs text-slate-400 mt-0.5">{s.reason}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${s.confidence >= 0.85 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {Math.round(s.confidence * 100)}% confianza
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => approve(s)} disabled={busyId === s.id}
                    className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                    ✓ Aprobar (VoBo)
                  </button>
                  <button onClick={() => reject(s)} disabled={busyId === s.id}
                    className="px-4 py-1.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-200 disabled:opacity-50">
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-900">Conciliados hoy ({approvedToday.length})</h2>
          {approvedToday.length > 0 && (
            <button onClick={generateVoucher}
              className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-700">
              📑 Generar póliza de conciliación
            </button>
          )}
        </div>
        {approvedToday.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no has aprobado ninguna conciliación hoy.</p>
        ) : (
          <div className="space-y-2">
            {approvedToday.map(t => (
              <div key={t.id} className="flex items-center justify-between text-sm bg-white rounded-lg border border-slate-100 p-3">
                <div>
                  <p className="font-semibold text-slate-900">{t.description}</p>
                  <p className="text-xs text-slate-400">{t.bank_account_name} · {t.category ?? 'sin categoría'}</p>
                </div>
                <p className={`font-bold ${t.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{money(Math.abs(t.amount))}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {poliza && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setPoliza(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <PolizaDownload poliza={poliza} onClose={() => setPoliza(null)} />
          </div>
        </div>
      )}
    </div>
  )
}
