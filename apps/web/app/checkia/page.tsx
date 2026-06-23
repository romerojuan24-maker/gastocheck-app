'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase'
import { CheckIADetector } from '@/components/CheckIADetector'
import { DashboardConsolidado } from '@/components/DashboardConsolidado'

export default function CheckIAPage() {
  const router = useRouter()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSessionUser().then(user => {
      if (!user) { router.push('/login'); return }
      setCompanyId(user.company_id)
      setLoading(false)
    })
  }, [router])

  if (loading) return <div className="p-8 text-center">Cargando...</div>
  if (!companyId) return null

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-4xl font-bold mb-2">🤖 CheckIA - Inteligencia en Gastos</h1>
      <p className="text-gray-600 mb-8">
        Detección automática de anomalías, clustering inteligente y patrones de fraude
      </p>

      <div className="mb-8">
        <DashboardConsolidado empresaId={companyId} />
      </div>

      <div className="p-4 bg-white border border-gray-200 rounded-lg mb-8">
        <h2 className="text-2xl font-bold mb-4">🔍 Análisis de Anomalías</h2>
        <CheckIADetector empresaId={companyId} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-bold text-blue-900 mb-2">💡 Cómo Funciona</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✅ Analiza últimos 90 gastos</li>
            <li>✅ Calcula z-score (desviación estándar)</li>
            <li>✅ Detecta anomalías (gastos inusuales)</li>
            <li>✅ Agrupa por categoría automáticamente</li>
            <li>✅ Identifica patrones de fraude</li>
          </ul>
        </div>

        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-bold text-green-900 mb-2">🎯 Casos de Uso</h3>
          <ul className="text-sm text-green-800 space-y-1">
            <li>🚨 Gasto 5x el promedio → Posible fraude</li>
            <li>📊 Agrupar "Combustible" + "Gasolina" automáticamente</li>
            <li>⚠️ Múltiples gastos en 1 día → Validar</li>
            <li>💰 Presupuesto excedido 20% → Alerta</li>
            <li>📈 Patrón de gastos crecientes → Análisis</li>
          </ul>
        </div>
      </div>

      <div className="mt-8 p-4 bg-purple-50 border border-purple-200 rounded-lg">
        <h3 className="font-bold text-purple-900 mb-2">🧠 Técnicas ML</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="font-semibold text-purple-900">Isolation Forest</div>
            <p className="text-purple-800 text-xs mt-1">Gastos &gt; 2.5σ son anómalos.</p>
          </div>
          <div>
            <div className="font-semibold text-purple-900">K-Means Clustering</div>
            <p className="text-purple-800 text-xs mt-1">Agrupa gastos por categoría automáticamente.</p>
          </div>
          <div>
            <div className="font-semibold text-purple-900">Pattern Detection</div>
            <p className="text-purple-800 text-xs mt-1">Detecta duplicados y actividad anormal.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
