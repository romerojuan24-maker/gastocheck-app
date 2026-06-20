'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface Gasto {
  id: string;
  fecha: string;
  concepto: string;
  monto: number;
  proveedor: string;
  categoria: string;
  estado: string;
  movimientos_financieros: { estado_pago: string; poliza_id: string }[];
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export function GastoCheckHistorial({ empresaId }: { empresaId: string }) {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState<string>('');

  useEffect(() => {
    async function fetchGastos() {
      try {
        let query = supabase
          .from('gastos')
          .select('*, movimientos_financieros(estado_pago, poliza_id)')
          .eq('empresa_id', empresaId)
          .order('fecha', { ascending: false });

        if (filtroCategoria) {
          query = query.eq('categoria', filtroCategoria);
        }

        const { data } = await query;
        setGastos(data || []);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchGastos();
  }, [empresaId, filtroCategoria]);

  const categorias = Array.from(new Set(gastos.map(g => g.categoria)));

  if (loading) return <div>Cargando gastos...</div>;

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <h3 className="text-xl font-bold mb-4">📋 Historial de Gastos</h3>

      {/* Filtro */}
      <div className="mb-4">
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      {gastos.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No hay gastos registrados</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-2">Fecha</th>
                <th className="text-left p-2">Concepto</th>
                <th className="text-left p-2">Proveedor</th>
                <th className="text-left p-2">Categoría</th>
                <th className="text-right p-2">Monto</th>
                <th className="text-center p-2">Pago</th>
                <th className="text-center p-2">Póliza</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((gasto) => {
                const mov = gasto.movimientos_financieros[0];
                const pagado = mov?.estado_pago === 'PAGADO';
                const tienePol = !!mov?.poliza_id;

                return (
                  <tr key={gasto.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{gasto.fecha}</td>
                    <td className="p-2">{gasto.concepto}</td>
                    <td className="p-2 text-gray-600">{gasto.proveedor || '-'}</td>
                    <td className="p-2 text-xs bg-blue-50 w-fit rounded px-2 py-1">{gasto.categoria}</td>
                    <td className="p-2 text-right font-semibold">${Math.abs(gasto.monto).toFixed(2)}</td>
                    <td className="p-2 text-center">
                      {pagado ? <span className="text-green-600">✅</span> : <span className="text-yellow-600">⏳</span>}
                    </td>
                    <td className="p-2 text-center">
                      {tienePol ? <span className="text-green-600">✅</span> : <span className="text-red-600">❌</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totales */}
          <div className="mt-4 pt-4 border-t font-bold">
            Total: ${gastos.reduce((sum, g) => sum + Math.abs(g.monto), 0).toFixed(2)}
            {' '} | Pagados: {gastos.filter(g => g.movimientos_financieros[0]?.estado_pago === 'PAGADO').length}/{gastos.length}
          </div>
        </div>
      )}
    </div>
  );
}
