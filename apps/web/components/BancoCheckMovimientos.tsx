'use client';

import { useState } from 'react';

interface Movimiento {
  id: string;
  fecha: string;
  concepto: string;
  monto: number;
  tipo: string;
  match_type: string;
  confianza: number;
}

export function BancoCheckMovimientos({ empresaId, bancoCuentaId }: { empresaId: string; bancoCuentaId: string }) {
  const [sincronizando, setSincronizando] = useState(false);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [resumen, setResumen] = useState({ ingresos_hoy: 0, egresos_hoy: 0, reconciliados: 0 });

  async function handleSincronizar() {
    setSincronizando(true);

    try {
      // Simulación: movimientos de prueba
      const movimientos_simulados = [
        {
          id: 'mov1',
          fecha: new Date().toISOString().split('T')[0],
          concepto: 'Transferencia recibida - Cliente A',
          monto: 5000,
        },
        {
          id: 'mov2',
          fecha: new Date().toISOString().split('T')[0],
          concepto: 'Pago proveedor B',
          monto: -2500,
        },
        {
          id: 'mov3',
          fecha: new Date().toISOString().split('T')[0],
          concepto: 'Depósito Cliente C',
          monto: 3200,
        },
      ];

      const response = await fetch('/api/bancocheck/sincronizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaId,
          banco_cuenta_id: bancoCuentaId,
          movimientos_simulados,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setMovimientos(data.detalle);
      setResumen({
        ingresos_hoy: data.resumenes.ingresos_hoy,
        egresos_hoy: data.resumenes.egresos_hoy,
        reconciliados: data.reconciliados,
      });
    } catch (error) {
      alert('Error al sincronizar: ' + (error instanceof Error ? error.message : 'Desconocido'));
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-white border border-gray-200 rounded-lg">
        <h3 className="text-xl font-bold mb-4">💳 Movimientos Bancarios</h3>

        <button
          onClick={handleSincronizar}
          disabled={sincronizando}
          className="mb-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          {sincronizando ? '🔄 Sincronizando...' : '🔄 Sincronizar Ahora'}
        </button>

        {/* Resumen */}
        {movimientos.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="p-2 bg-green-50 rounded">
              <div className="text-xs text-gray-600">Ingresos Hoy</div>
              <div className="font-bold text-green-600">${resumen.ingresos_hoy.toFixed(2)}</div>
            </div>
            <div className="p-2 bg-red-50 rounded">
              <div className="text-xs text-gray-600">Egresos Hoy</div>
              <div className="font-bold text-red-600">${resumen.egresos_hoy.toFixed(2)}</div>
            </div>
            <div className="p-2 bg-blue-50 rounded">
              <div className="text-xs text-gray-600">Reconciliados</div>
              <div className="font-bold text-blue-600">{resumen.reconciliados}</div>
            </div>
          </div>
        )}

        {/* Tabla de movimientos */}
        {movimientos.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Haz clic en "Sincronizar" para cargar movimientos</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-2">Fecha</th>
                  <th className="text-left p-2">Concepto</th>
                  <th className="text-right p-2">Monto</th>
                  <th className="text-center p-2">Tipo</th>
                  <th className="text-center p-2">Match</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((mov) => (
                  <tr key={mov.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 text-sm">{mov.fecha}</td>
                    <td className="p-2 text-sm">{mov.concepto}</td>
                    <td className={`p-2 text-right font-semibold ${mov.monto > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {mov.monto > 0 ? '+' : ''}${Math.abs(mov.monto).toFixed(2)}
                    </td>
                    <td className="p-2 text-center text-xs">
                      <span className={`px-2 py-1 rounded ${mov.monto > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {mov.monto > 0 ? 'INGRESO' : 'EGRESO'}
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      {mov.match_type === 'SIN_MATCH' ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span className="text-green-600 font-bold">✅</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
