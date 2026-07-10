'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, getSessionUser } from '@/lib/supabase'
import type { BankAccount, BankTransaction } from '@gastocheck/shared'

const money = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

const CATEGORIES: { key: string; label: string; status: string }[] = [
  { key: 'collection', label: '💰 Cobranza (cliente)', status: 'explained' },
  { key: 'expense',    label: '🧾 Gasto',              status: 'explained' },
  { key: 'supplier',   label: '🏭 Pago a proveedor',   status: 'explained' },
  { key: 'advance',    label: '📤 Anticipo',           status: 'explained' },
  { key: 'transfer',   label: '🔁 Traspaso',           status: 'explained' },
  { key: 'personal',   label: '👤 Personal',           status: 'personal' },
  { key: 'ignore',     label: '🚫 Ignorar',            status: 'ignored' },
]
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]))

export default function BancoCheckPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [tab, setTab] = useState<'new' | 'explained' | 'pending'>('new')
  const [loading, setLoading] = useState(true)
  const [classifying, setClassifying] = useState<BankTransaction | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (cid: string) => {
    const [accRes, txnRes] = await Promise.all([
      supabase.from('bank_accounts').select('*').eq('company_id', cid).eq('is_active', true),
      supabase.from('bank_transactions').select('*').eq('company_id', cid).order('transaction_date', { ascending: false }).limit(200),
    ])
    const accounts_list = (accRes.data ?? []) as BankAccount[]
    setAccounts(accounts_list)
    setSelectedAccountId((cur) => cur ?? (accounts_list[0]?.id ?? null))
    setTransactions((txnRes.data ?? []) as BankTransaction[])
  }, [])

  useEffect(() => {
    (async () => {
      const u = await getSessionUser()
      if (u?.company_id) { setCompanyId(u.company_id); await load(u.company_id) }
      setLoading(false)
    })()
  }, [load])

  async function classify(category: string) {
    if (!companyId || !classifying) return
    const status = CATEGORIES.find((c) => c.key === category)?.status ?? 'explained'
    setSaving(true)
    const { error } = await supabase.from('bank_transactions').update({ category, status }).eq('id', classifying.id)
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setClassifying(null)
    await load(companyId)
  }

  async function resetClassification(t: BankTransaction) {
    if (!companyId) return
    const { error } = await supabase.from('bank_transactions').update({ category: null, status: 'new' }).eq('id', t.id)
    if (error) { alert('Error: ' + error.message); return }
    await load(companyId)
  }

  const filtered = transactions.filter((t) => {
    if (selectedAccountId && t.bank_account_id !== selectedAccountId) return false
    if (tab === 'new') return t.status === 'new'
    if (tab === 'explained') return ['explained', 'personal', 'ignored', 'matched'].includes(t.status)
    if (tab === 'pending') return t.status === 'pending_document' || t.status === 'pending_invoice'
    return true
  })

  const totalBalance = accounts.reduce((s, a) => s + (a.current_balance ?? 0), 0)
  const sinClasificar = transactions.filter((t) => t.status === 'new' && (!selectedAccountId || t.bank_account_id === selectedAccountId)).length

  if (loading) return <div className="flex items-center justify-center h-96 text-slate-600">Cargando…</div>

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">🏦 BancoCheck</h1>
          <p className="text-slate-500 mt-1">Reconciliación bancaria inteligente</p>
          <a href="/bancocheck/analisis" className="inline-block mt-2 text-sm font-semibold text-emerald-600 hover:text-emerald-800">🤖 Análisis IA de convergencias →</a>
        </div>
        <a href="/bancocheck/importar"
          className="px-4 py-2 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 text-sm whitespace-nowrap">
          📥 Importar CSV
        </a>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Saldo total" value={money(totalBalance)} color="text-slate-900" />
        <Kpi label="Sin clasificar" value={sinClasificar} color="text-blue-600" />
        <Kpi label="Total importadas" value={transactions.length} color="text-slate-700" />
      </div>

      {accounts.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {accounts.map((acc) => (
            <button key={acc.id} onClick={() => setSelectedAccountId(acc.id)}
              className={`px-4 py-2 rounded-lg font-bold text-sm ${selectedAccountId === acc.id ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200'}`}>
              {acc.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200">
        {(['new', 'explained', 'pending'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-3 text-sm font-bold ${tab === t ? 'text-emerald-600 border-b-2 border-emerald-500' : 'text-slate-500'}`}>
            {t === 'new' ? 'Sin clasificar' : t === 'explained' ? 'Clasificadas' : 'Pendientes'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">Sin transacciones en esta vista.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const isDeposit = (t.amount ?? 0) >= 0
            return (
              <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{t.description || 'Sin descripción'}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(t.transaction_date).toLocaleDateString('es-MX')}
                    {t.category && <> · {CATEGORY_LABEL[t.category] ?? t.category}</>}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <p className={`font-black ${isDeposit ? 'text-emerald-600' : 'text-red-600'}`}>{isDeposit ? '+' : '-'}{money(Math.abs(t.amount ?? 0))}</p>
                  {t.status === 'new' ? (
                    <button onClick={() => setClassifying(t)} className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-700">Clasificar</button>
                  ) : (
                    <button onClick={() => resetClassification(t)} className="text-xs text-slate-400 hover:text-slate-700 font-semibold">Reabrir</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal clasificar */}
      {classifying && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setClassifying(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">Clasificar movimiento</h2>
            <p className="text-sm text-slate-500 truncate">{classifying.description}</p>
            <p className={`font-black ${(classifying.amount ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{money(Math.abs(classifying.amount ?? 0))}</p>
            <div className="grid grid-cols-1 gap-2 pt-1">
              {CATEGORIES.map((c) => (
                <button key={c.key} disabled={saving} onClick={() => classify(c.key)}
                  className="w-full text-left px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-50">
                  {c.label}
                </button>
              ))}
            </div>
            <button onClick={() => setClassifying(null)} className="w-full py-2 text-slate-500 text-sm hover:text-slate-700">Cancelar</button>
          </div>
        </div>
      )}
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
// Build timestamp: Thu Jul  9 18:46:30     2026
