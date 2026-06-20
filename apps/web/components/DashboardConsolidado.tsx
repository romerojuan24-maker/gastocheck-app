'use client';

import { useEffect, useState } from 'react';

interface ConsolidadoData {
  consolidado: {
    gastos: { total: number; cantidad: number };
    ingresos: { total: number; cantidad: number };
    caja: { esperada: number; pendiente: number; reconciliado: number };
    polizas: { generadas: number };
    clientes: { cantidad: number };
    analisis: { top_categorias: Array<{ categoria: string; monto: number }>; pendientes: number; reconciliacion_porciento: number };
  };
}

export function DashboardConsolidado({ empresaId }: { empresaId: string }) {
  const [data, setData] = useState<ConsolidadoData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const response = await fetch(`/api/dashboard/consolidado?empresa_id=${empresaId}`);
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [empresaId]);

  if (loading) return <div>Cargando...</div>;
  if (!data) return <div>Error al cargar dashboard</div>;

  const d = data.consolidado;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">📊 Dashboard Consolidado</h1>

      {/* KPIs Principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-sm text-gray-600">Gastos</div>
          <div className="text-2xl font-bold">${d.gastos.total.toFixed(2)}</div>
          <div className="text-xs text-gray-500">{d.gastos.cantidad} registros</div>
        </div>

        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-sm text-gray-600">Ingresos</div>
          <div className="text-2xl font-bold">${d.ingresos.total.toFixed(2)}</div>
          <div className="text-xs text-gray-500">{d.ingresos.cantidad} registros</div>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-gray-600">Caja Esperada</div>
          <div className="text-2xl font-bold">${d.caja.esperada.toFixed(2)}</div>
          <div className="text-xs text-gray-500">Teoría</div>
        </div>

        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-sm text-gray-600">Pólizas</div>
          <div className="text-2xl font-bold">{d.polizas.generadas}</div>
          <div className="text-xs text-gray-500">Automáticas</div>
        </div>
      </div>

      {/* Análisis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <h3 className="font-bold mb-3">Top Categorías</h3>
          <div className="space-y-2">
            {d.analisis.top_categorias.map((cat) => (
              <div key={cat.categoria} className="flex justify-between text-sm">
                <span>{cat.categoria}</span>
                <span className="font-semibold">${cat.monto.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <h3 className="font-bold mb-3">Reconciliación</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Pendientes</span>
              <span className="font-semibold">{d.analisis.pendientes}</span>
            </div>
            <div className="flex justify-between">
              <span>Reconciliados</span>
              <span className="font-semibold">{d.caja.reconciliado}</span>
            </div>
            <div className="mt-2 pt-2 border-t">
              <div className="flex justify-between font-bold">
                <span>% Reconciliado</span>
                <span>{d.analisis.reconciliacion_porciento.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alert */}
      {d.caja.pendiente > 0 && (
        <div className="p-4 bg-yellow-100 border border-yellow-300 rounded-lg">
          ⚠️ Pendientes: ${d.caja.pendiente.toFixed(2)} sin reconciliar
        </div>
      )}

      {d.analisis.reconciliacion_porciento === 100 && (
        <div className="p-4 bg-green-100 border border-green-300 rounded-lg">
          ✅ CAJA CUADRA 100%
        </div>
      )}
    </div>
  );
}
