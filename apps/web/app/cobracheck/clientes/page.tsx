'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@gastocheck/shared'
import Link from 'next/link'
import { CobraClient } from '@gastocheck/shared/types/cobracheck'

export default function ClientesPage() {
  const [clients, setClients] = useState<CobraClient[]>([])
  const [filter, setFilter] = useState<'todos' | 'riesgo' | 'bloqueados'>('todos')

  useEffect(() => {
    loadClients()
  }, [filter])

  const loadClients = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const { data: member } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('auth_id', session.user.id)
      .single()

    let query = supabase.from('cobra_clients').select('*').eq('company_id', member?.company_id || '')

    if (filter === 'riesgo') query = query.gte('risk_score', 70)
    if (filter === 'bloqueados') query = query.eq('status', 'blacklist')

    const { data } = await query
    setClients(data || [])
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Clientes</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded font-semibold">+ Crear</button>
      </div>

      <div className="flex gap-2 mb-6">
        {(['todos', 'riesgo', 'bloqueados'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
            {f === 'todos' ? 'Todos' : f === 'riesgo' ? 'Riesgo Alto' : 'Bloqueados'}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {clients.map(c => (
          <Link key={c.id} href={`/cobracheck/clientes/${c.id}`}>
            <div className="bg-white p-4 rounded-lg shadow cursor-pointer hover:shadow-lg">
              <div className="flex justify-between">
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-sm text-gray-600">{c.rfc} • {c.phone}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold">${c.current_balance.toLocaleString('es-MX')}</div>
                  <div className={`text-sm font-semibold ${c.risk_score >= 80 ? 'text-red-600' : 'text-green-600'}`}>
                    Score: {c.risk_score}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
