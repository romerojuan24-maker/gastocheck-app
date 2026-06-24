'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ContabilidadIntegration() {
  const [tab, setTab] = useState<'upload' | 'clasificacion' | 'sat' | 'export'>('upload')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Obtener company_id de la sesión del usuario
  useEffect(() => {
    getSessionUser().then((user) => {
      if (user) setCompanyId(user.company_id)
    })
  }, [])

  // ============================================================================
  // 1. UPLOAD CATÁLOGO DE CUENTAS
  // ============================================================================
  const handleUploadCatalog = async (file: File) => {
    if (!file.name.match(/\.(csv|xlsx|json)$/i)) {
      setMessage('❌ Solo se aceptan archivos CSV, Excel o JSON')
      return
    }

    setLoading(true)
    const text = await file.text()

    try {
      const lines = text.split('\n').slice(1) // Skip header
      const accounts = lines
        .filter((line) => line.trim())
        .map((line) => {
          const [code, name, type, nature] = line.split(',').map((s) => s.trim())
          return { code, name, account_type: type, nature }
        })

      // Insertar en Supabase
      if (!companyId) {
        setMessage('❌ No se pudo obtener el ID de la empresa')
        setLoading(false)
        return
      }
      const { error } = await supabase.from('accounting_accounts_v2').insert(
        accounts.map((a) => ({
          ...a,
          company_id: companyId,
          active: true,
        }))
      )

      if (error) throw error
      setMessage(`✅ ${accounts.length} cuentas importadas exitosamente`)
    } catch (err: any) {
      setMessage(`❌ Error al importar: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // 2. CLASIFICACIÓN CONTABLE
  // ============================================================================
  const ClassificacionTab = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">
          Clasificar Gastos por Cuenta Contable
        </h2>
        <p className="text-slate-600">
          Asigna cada comprobante a su cuenta contable correspondiente antes de generar la póliza
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Selecciona un comprobante
            </label>
            <select className="w-full px-4 py-2 border border-slate-200 rounded-lg">
              <option>Cargando comprobantes...</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Monto: $0.00
              </label>
              <input
                type="text"
                disabled
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                RFC Proveedor
              </label>
              <input
                type="text"
                disabled
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Cuenta Contable (*)
            </label>
            <select className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="">-- Selecciona cuenta --</option>
              <option value="1010">1010 - Caja</option>
              <option value="1020">1020 - Bancos</option>
              <option value="5010">5010 - Gastos de Operación</option>
              <option value="5020">5020 - Gastos de Administración</option>
              <option value="5030">5030 - Otros Gastos</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Deducible para ISR/IVA
            </label>
            <select className="w-full px-4 py-2 border border-slate-200 rounded-lg">
              <option value="true">Sí, es deducible</option>
              <option value="false">No, no es deducible</option>
            </select>
          </div>

          <button className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700">
            Guardar Clasificación
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          ℹ️ Clasifica todos los comprobantes antes de generar la póliza contable
        </p>
      </div>
    </div>
  )

  // ============================================================================
  // 3. VALIDACIÓN SAT
  // ============================================================================
  const SATTab = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Validación de CFDIs contra SAT</h2>
        <p className="text-slate-600">
          Verifica que todos los CFDIs sean vigentes antes de contabilizar
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <button className="w-full bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700">
          🔍 Validar todos los CFDIs en esta póliza
        </button>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-slate-900">Resultados de Validación</h3>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✓</span>
            <div>
              <p className="font-semibold text-green-900">CFDI: abc123...xyz</p>
              <p className="text-sm text-green-800">RFC: ABC123456XYZ</p>
              <p className="text-sm text-green-700">Estado: Vigente en SAT</p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✗</span>
            <div>
              <p className="font-semibold text-red-900">CFDI: def456...uvw</p>
              <p className="text-sm text-red-800">RFC: DEF456789ABC</p>
              <p className="text-sm text-red-700">Estado: CANCELADO - No se puede contabilizar</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // ============================================================================
  // 4. EXPORTACIÓN DE PÓLIZA
  // ============================================================================
  const ExportTab = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Exportar Póliza</h2>
        <p className="text-slate-600">
          Genera archivo para importar en tu sistema contable
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button className="border-2 border-slate-200 rounded-lg p-6 text-center hover:border-slate-400 hover:bg-slate-50 transition">
          <div className="text-4xl mb-2">📊</div>
          <p className="font-semibold text-slate-900">CONTPAQi</p>
          <p className="text-xs text-slate-600 mt-2">Formato XML compatible con CONTPAQi Contabilidad</p>
        </button>

        <button className="border-2 border-slate-200 rounded-lg p-6 text-center hover:border-slate-400 hover:bg-slate-50 transition">
          <div className="text-4xl mb-2">📄</div>
          <p className="font-semibold text-slate-900">SAT XML</p>
          <p className="text-xs text-slate-600 mt-2">Formato XML validado por SAT</p>
        </button>

        <button className="border-2 border-slate-200 rounded-lg p-6 text-center hover:border-slate-400 hover:bg-slate-50 transition">
          <div className="text-4xl mb-2">📋</div>
          <p className="font-semibold text-slate-900">JSON</p>
          <p className="text-xs text-slate-600 mt-2">Formato JSON para APIs</p>
        </button>

        <button className="border-2 border-slate-200 rounded-lg p-6 text-center hover:border-slate-400 hover:bg-slate-50 transition">
          <div className="text-4xl mb-2">📑</div>
          <p className="font-semibold text-slate-900">CSV</p>
          <p className="text-xs text-slate-600 mt-2">Hoja de cálculo para Excel</p>
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          💾 Se genera un link de descarga que expira en 7 días. No se envía por WhatsApp.
        </p>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-green-900">✓ Póliza lista para exportar</p>
        <p className="text-sm text-green-800 mt-1">
          Asientos: 12 | Debe: $45,320.00 | Haber: $45,320.00 | Balanceada: ✓
        </p>
      </div>

      <button className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 text-lg">
        ⬇️ Descargar Póliza
      </button>
    </div>
  )

  // ============================================================================
  // UPLOAD TAB
  // ============================================================================
  const UploadTab = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Importar Catálogo de Cuentas</h2>
        <p className="text-slate-600">
          Carga tu catálogo contable desde CSV, Excel o JSON
        </p>
      </div>

      <div className="bg-white border-2 border-dashed border-slate-300 rounded-lg p-8">
        <input
          type="file"
          accept=".csv,.xlsx,.json"
          onChange={(e) => {
            if (e.target.files?.[0]) handleUploadCatalog(e.target.files[0])
          }}
          className="w-full"
        />
        <p className="text-center text-slate-600 mt-4 text-sm">
          CSV/Excel con formato: Código | Nombre | Tipo | Naturaleza
        </p>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h3 className="font-semibold text-slate-900 mb-3">Formato esperado (CSV)</h3>
        <pre className="text-xs bg-white p-3 rounded border border-slate-200 overflow-x-auto">
{`codigo,nombre,tipo,naturaleza
1010,Caja,activo,deudora
1020,Bancos,activo,deudora
5010,Gastos de Operacion,egreso,deudora
5020,Gastos de Administracion,egreso,deudora`}
        </pre>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.includes('✅') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Integración Contable</h1>
        <p className="text-slate-600 mt-2">
          Validación SAT, clasificación de cuentas y exportación a sistemas contables
        </p>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {[
          { id: 'upload', label: '📤 Catálogo de Cuentas' },
          { id: 'clasificacion', label: '📊 Clasificación' },
          { id: 'sat', label: '🔍 Validación SAT' },
          { id: 'export', label: '⬇️ Exportar' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-3 font-medium transition-colors ${
              tab === t.id
                ? 'text-slate-900 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'upload' && <UploadTab />}
        {tab === 'clasificacion' && <ClassificacionTab />}
        {tab === 'sat' && <SATTab />}
        {tab === 'export' && <ExportTab />}
      </div>
    </div>
  )
}
