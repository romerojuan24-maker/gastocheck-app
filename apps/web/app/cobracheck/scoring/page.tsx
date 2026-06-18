'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@gastocheck/shared'
import { CobraClient } from '@gastocheck/shared/types/cobracheck'

export default function ScoringPage() {
  const [clients, setClients] = useState<CobraClient[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const { data: member } = await supabase.from('company_members').select('company_id')
        .eq('auth_id', session?.user?.id || '').single()
      const { data } = await supabase.from('cobra_clients').select('*')
        .eq('company_id', member?.company_id || '').order('risk_score', { ascending: false })
      setClients(data || [])
    }
    load()
  }, [])

  const getRecommendation = (score: number) => {
    if (score >= 80) return '🔴 Llamar urgentemente'
    if (score >= 60) return '🟠 Contactar pronto'
    return '🟢 Mantener vigilancia'
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Risk Scoring</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded">⚙️ Recalcular Scores</button>
      </div>

      <table className="w-full bg-white rounded shadow">
        <thead className="border-b">
          <tr>
            <th className="text-left p-4">Cliente</th>
            <th className="text-center p-4">Score</th>
            <th className="text-left p-4">Recomendación</th>
          </tr>
        </thead>
        <tbody>
          {clients.map(c => (
            <tr key={c.id} className="border-b hover:bg-gray-50">
              <td className="p-4">{c.name}</td>
              <td className="text-center">
                <span className={`font-bold ${
                  c.risk_score >= 80 ? 'text-red-600' : c.risk_score >= 60 ? 'text-orange-600' : 'text-green-600'
                }`}>
                  {c.risk_score}/100
                </span>
              </td>
              <td className="p-4">{getRecommendation(c.risk_score)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
