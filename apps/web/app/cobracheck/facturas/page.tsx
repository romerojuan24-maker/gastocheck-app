'use client'

import { useEffect, useState } from 'react'
import { supabase, getSessionUser } from '../../../lib/supabase'
import { CobraInvoice } from '@gastocheck/shared'

export default function FacturasPage() {
  const [invoices, setInvoices] = useState<CobraInvoice[]>([])
  const [tab, setTab] = useState<'vigentes' | 'vencidas' | 'pagadas'>('vencidas')

  useEffect(() => {
    loadInvoices()
  }, [tab])

  const loadInvoices = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const { data: member } = await supabase.from('company_members').select('company_id')
      .eq('auth_id', session?.user?.id || '').single()

    let query = supabase.from('cobra_invoices').select('*').eq('company_id', member?.company_id || '')
    if (tab === 'vigentes') query = query.in('status', ['pending', 'partial'])
    else if (tab === 'vencidas') query = query.eq('status', 'overdue')
    else query = query.eq('status', 'paid')

    const { data } = await query
    setInvoices(data || [])
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Facturas</h1>
      <div className="flex gap-2 mb-6">
        {(['vigentes', 'vencidas', 'pagadas'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="grid gap-2">
        {invoices.map(i => (
          <div key={i.id} className="bg-white p-4 rounded shadow flex justify-between">
            <div>
              <div className="font-semibold">{i.folio}</div>
              <div className="text-sm text-gray-600">${i.amount.toLocaleString('es-MX')}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{i.days_overdue} días</div>
              <div className="text-sm text-gray-600">{new Date(i.due_date).toLocaleDateString('es-MX')}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
