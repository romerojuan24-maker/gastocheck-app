'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@gastocheck/shared'
import { CobraPromise } from '@gastocheck/shared/types/cobracheck'

export default function PromesasPage() {
  const [promises, setPromises] = useState<CobraPromise[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const { data: member } = await supabase.from('company_members').select('company_id')
        .eq('auth_id', session?.user?.id || '').single()
      const { data } = await supabase.from('cobra_promises').select('*')
        .eq('company_id', member?.company_id || '').eq('status', 'pending')
      setPromises(data || [])
    }
    load()
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Promesas de Pago</h1>
      <div className="grid gap-2">
        {promises.map(p => (
          <div key={p.id} className="bg-white p-4 rounded shadow flex justify-between">
            <div>
              <div className="font-semibold">${p.amount.toLocaleString('es-MX')}</div>
              <div className="text-sm text-gray-600">{p.notes}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{new Date(p.promise_date).toLocaleDateString('es-MX')}</div>
              <div className="text-sm text-gray-600">Pendiente</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
