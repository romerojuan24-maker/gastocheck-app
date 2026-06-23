'use client'

import { useEffect, useState } from 'react'
import { supabase, getSessionUser } from '../../../lib/supabase'

export default function BitacoraPage() {
  const [entries, setEntries] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const { data: member } = await supabase.from('company_members').select('company_id')
        .eq('auth_id', session?.user?.id || '').single()
      const { data: calls } = await supabase.from('cobra_calls').select('*')
        .eq('company_id', member?.company_id || '').order('call_date', { ascending: false }).limit(50)
      setEntries(calls || [])
    }
    load()
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Bitácora de Cobranza</h1>
      <div className="grid gap-2">
        {entries.map((e: any) => (
          <div key={e.id} className="bg-white p-4 rounded shadow flex justify-between text-sm">
            <div>
              <div className="font-semibold">{new Date(e.call_date).toLocaleString('es-MX')}</div>
              <div className="text-gray-600">{e.notes}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{e.status}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
