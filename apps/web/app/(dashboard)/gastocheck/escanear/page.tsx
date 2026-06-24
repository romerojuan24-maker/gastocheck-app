'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface OcrResult {
  providerName: string | null
  providerRfc: string | null
  receiptDate: string | null
  subtotal: number | null
  tax: number | null
  total: number | null
  currency: string
  fiscalUuid: string | null
  paymentMethod: string | null
  confidence: 'high' | 'medium' | 'low'
  warnings: string[]
}

export default function EscanearPage() {
  const [preview, setPreview] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<OcrResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onFile(file: File) {
    setError(null); setResult(null)
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      setPreview(dataUrl)
      const base64 = dataUrl.split(',')[1]
      setScanning(true)
      try {
        const { data, error } = await supabase.functions.invoke('ocr-extract', {
          body: { image_base64: base64, mime_type: file.type || 'image/jpeg' },
        })
        if (error) throw error
        if (data?.error) throw new Error(data.error)
        setResult(data as OcrResult)
      } catch (e: any) {
        setError(e.message || 'Error al escanear')
      } finally {
        setScanning(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const fmt = (n: number | null) => (n == null ? '—' : `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`)

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900">📷 Escanear Comprobante</h1>
        <p className="text-slate-500 mt-1">Sube la foto de un ticket o factura — la IA extrae los datos automáticamente</p>
      </div>

      <label className="block bg-white border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-400 transition">
        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <div className="text-4xl mb-2">📤</div>
        <p className="font-semibold text-slate-700">Toca para subir una imagen</p>
        <p className="text-xs text-slate-400 mt-1">JPG o PNG de un ticket/factura</p>
      </label>

      {preview && (
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Imagen</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="comprobante" className="rounded-lg border border-slate-200 max-h-80 object-contain w-full" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Datos extraídos</p>
            {scanning && (
              <div className="flex items-center gap-3 text-slate-600 p-4">
                <div className="animate-spin w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full" />
                Analizando con IA…
              </div>
            )}
            {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-4 text-sm">❌ {error}</div>}
            {result && (
              <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
                <Row label="Proveedor" value={result.providerName ?? '—'} />
                <Row label="RFC" value={result.providerRfc ?? '—'} />
                <Row label="Fecha" value={result.receiptDate ?? '—'} />
                <Row label="Subtotal" value={fmt(result.subtotal)} />
                <Row label="IVA" value={fmt(result.tax)} />
                <Row label="Total" value={fmt(result.total)} strong />
                <Row label="Método pago" value={result.paymentMethod ?? '—'} />
                <Row label="UUID CFDI" value={result.fiscalUuid ?? '—'} />
                <Row label="Confianza" value={result.confidence} />
                {result.warnings?.length > 0 && (
                  <div className="p-3 text-xs text-amber-700 bg-amber-50">⚠ {result.warnings.join(' · ')}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <p className="text-xs text-slate-400">Procesado on-device vía Edge Function <code>ocr-extract</code> (Gemini 2.5 Flash).</p>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between items-center p-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm ${strong ? 'font-bold text-slate-900' : 'font-medium text-slate-800'}`}>{value}</span>
    </div>
  )
}
