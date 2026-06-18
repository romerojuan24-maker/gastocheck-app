'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@gastocheck/shared'
import { CobraClient, CobraInvoice } from '@gastocheck/shared/types/cobracheck'

export default function ClientDetailPage() {
  const { id } = useParams() as { id: string }
  const [client, setClient] = useState<CobraClient | null>(null)
  const [invoices, setInvoices] = useState<CobraInvoice[]>([])

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    const { data: c } = await supabase.from('cobra_clients').select('*').eq('id', id).single()
    setClient(c)

    const { data: invs } = await supabase.from('cobra_invoices').select('*').eq('client_id', id)
    setInvoices(invs || [])
  }

  if (!client) return <div className="p-6">Cargando...</div>

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-4">{client.name}</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-600">RFC</div>
          <div className="font-semibold">{client.rfc}</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-600">Saldo</div>
          <div className="font-bold text-blue-600">${client.current_balance.toLocaleString('es-MX')}</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-600">Límite</div>
          <div className="font-semibold">${client.credit_limit.toLocaleString('es-MX')}</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-600">Risk Score</div>
          <div className="font-bold text-red-600">{client.risk_score}/100</div>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-bold mb-4">Acciones Rápidas</h2>
        <div className="flex gap-2">
          <button className="bg-blue-600 text-white px-4 py-2 rounded">📞 Llamar</button>
          <button className="bg-green-600 text-white px-4 py-2 rounded">💬 WhatsApp</button>
          <button className="bg-gray-600 text-white px-4 py-2 rounded">📧 Email</button>
          <button className="bg-purple-600 text-white px-4 py-2 rounded">📅 Promesa</button>
          <button className="bg-yellow-600 text-white px-4 py-2 rounded">💰 Pago</button>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow mt-6">
        <h2 className="text-xl font-bold mb-4">Facturas ({invoices.length})</h2>
        <div className="grid gap-2">
          {invoices.map(i => (
            <div key={i.id} className="flex justify-between p-2 border-b">
              <div>
                <div className="font-semibold">{i.folio}</div>
                <div className="text-sm text-gray-600">${i.amount.toLocaleString('es-MX')}</div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-semibold ${i.status === 'paid' ? 'text-green-600' : i.status === 'overdue' ? 'text-red-600' : ''}`}>
                  {i.status}
                </div>
                <div className="text-sm text-gray-600">{i.days_overdue} días</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
