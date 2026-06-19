'use client'

import { useState } from 'react'
import { Poliza, formatDateForPoliza, formatMoney } from '../lib/poliza'
import { downloadCSV } from '../lib/export-csv'
import { downloadExcel } from '../lib/export-excel'

interface PolizaDownloadProps {
  poliza: Poliza
  onClose?: () => void
}

export function PolizaDownload({ poliza, onClose }: PolizaDownloadProps) {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDownloadCSV = async () => {
    try {
      setDownloading(true)
      setError(null)
      downloadCSV(poliza)
    } catch (err: any) {
      setError(err.message || 'Error descargando CSV')
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadExcel = async () => {
    try {
      setDownloading(true)
      setError(null)
      await downloadExcel(poliza)
    } catch (err: any) {
      setError(err.message || 'Error descargando Excel')
    } finally {
      setDownloading(false)
    }
  }

  const totalDebe = poliza.lineas.reduce((s, l) => s + l.debe, 0)
  const totalHaber = poliza.lineas.reduce((s, l) => s + l.haber, 0)

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl">
      {/* Encabezado */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900">
          Póliza de {poliza.tipo}
        </h2>
        <p className="text-gray-600 text-sm mt-1">#{poliza.noPoliza}</p>

        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
          <div>
            <span className="text-gray-600">Fecha:</span>
            <p className="font-semibold">{formatDateForPoliza(poliza.fecha)}</p>
          </div>
          <div>
            <span className="text-gray-600">Referencia:</span>
            <p className="font-semibold">{poliza.referencia}</p>
          </div>
          <div className="col-span-2">
            <span className="text-gray-600">Descripción:</span>
            <p className="font-semibold">{poliza.descripcion}</p>
          </div>
          <div className="col-span-2">
            <span className="text-gray-600">Usuario:</span>
            <p className="font-semibold text-xs">{poliza.usuario}</p>
          </div>
        </div>
      </div>

      {/* Tabla de líneas */}
      <div className="mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b border-gray-300">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Cuenta</th>
              <th className="px-3 py-2 text-left">Descripción</th>
              <th className="px-3 py-2 text-right">Debe</th>
              <th className="px-3 py-2 text-right">Haber</th>
              <th className="px-3 py-2 text-left">Ref</th>
            </tr>
          </thead>
          <tbody>
            {poliza.lineas.map((linea) => (
              <tr key={linea.numero} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-3 py-2">{linea.numero}</td>
                <td className="px-3 py-2 font-mono">{linea.cuenta}</td>
                <td className="px-3 py-2">{linea.descripcion}</td>
                <td className="px-3 py-2 text-right">
                  {linea.debe > 0 ? `$${formatMoney(linea.debe)}` : '-'}
                </td>
                <td className="px-3 py-2 text-right">
                  {linea.haber > 0 ? `$${formatMoney(linea.haber)}` : '-'}
                </td>
                <td className="px-3 py-2 text-xs">{linea.referencia || '-'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300">
            <tr>
              <td colSpan={3} className="px-3 py-2">
                TOTAL
              </td>
              <td className="px-3 py-2 text-right">${formatMoney(totalDebe)}</td>
              <td className="px-3 py-2 text-right">${formatMoney(totalHaber)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Estado */}
      {Math.abs(totalDebe - totalHaber) < 0.01 ? (
        <div className="mb-4 p-3 bg-green-100 text-green-800 rounded text-sm">
          ✅ Póliza balanceada: Debe = Haber = ${formatMoney(totalDebe)}
        </div>
      ) : (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded text-sm">
          ❌ Póliza desbalanceada: Debe = ${formatMoney(totalDebe)}, Haber = $
          {formatMoney(totalHaber)}
        </div>
      )}

      {/* Error */}
      {error && <div className="mb-4 p-3 bg-red-100 text-red-800 rounded text-sm">{error}</div>}

      {/* Botones */}
      <div className="flex gap-3">
        <button
          onClick={handleDownloadCSV}
          disabled={downloading}
          className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 font-semibold"
        >
          📥 Descargar CSV
        </button>
        <button
          onClick={handleDownloadExcel}
          disabled={downloading}
          className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 font-semibold"
        >
          📊 Descargar Excel
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 font-semibold"
          >
            Cerrar
          </button>
        )}
      </div>
    </div>
  )
}
