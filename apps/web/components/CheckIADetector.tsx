'use client';

import { useEffect, useState } from 'react';

interface Anomalia {
  id: string;
  fecha: string;
  monto: number;
  z_score: number;
  severity: 'MEDIA' | 'ALTA' | 'CRÍTICA';
  razon: string;
  confianza: number;
  accion: string;
}

interface CheckIAData {
  anomalias: Anomalia[];
  estadisticas: {
    promedio_gasto: number;
    desv_est: number;
    total_gastos_analizados: number;
    anomalias_detectadas: number;
    tasa_anomalia: string;
  };
  clustering: any[];
  patrones: any[];
}

export function CheckIADetector({ empresaId }: { empresaId: string }) {
  const [data, setData] = useState<CheckIAData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtroSeveridad, setFiltroSeveridad] = useState<'todo' | 'MEDIA' | 'ALTA' | 'CRÍTICA'>('todo');

  useEffect(() => {
    async function fetchAnomalias() {
      try {
        const response = await fetch('/api/checkia/detectar?empresa_id=' + empresaId);
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAnomalias();
  }, [empresaId]);

  if (loading) return <div className="p-4 text-center text-gray-500">Analizando patrones...</div>;
  if (!data) return <div className="p-4 text-center text-red-500">Error al cargar análisis</div>;

  const anomalias_filtradas = data.anomalias.filter(
    a => filtroSeveridad === 'todo' || a.severity === filtroSeveridad
  );

  const colorSeveridad = {
    MEDIA: 'bg-yellow-50 border-yellow-300 text-yellow-900',
    ALTA: 'bg-orange-50 border-orange-300 text-orange-900',
    CRÍTICA: 'bg-red-50 border-red-300 text-red-900',
  };

  const iconoSeveridad = {
    MEDIA: '⚠️',
    ALTA: '🔴',
    CRÍTICA: '🚨',
  };

  return (
    <div className="space-y-6">
      {/* Estadísticas generales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-gray-600">Gastos Analizados</div>
          <div className="text-2xl font-bold text-blue-600">{data.estadisticas.total_gastos_analizados}</div>
        </div>

        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="text-sm text-gray-600">Promedio</div>
          <div className="text-2xl font-bold text-purple-600">
            ${data.estadisticas.promedio_gasto.toLocaleString('es-MX')}
          </div>
        </div>

        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="text-sm text-gray-600">Anomalías Detectadas</div>
          <div className="text-2xl font-bold text-orange-600">{data.estadisticas.anomalias_detectadas}</div>
        </div>

        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-sm text-gray-600">Tasa de Anomalía</div>
          <div className="text-2xl font-bold text-red-600">{data.estadisticas.tasa_anomalia}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {(['todo', 'MEDIA', 'ALTA', 'CRÍTICA'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFiltroSeveridad(s)}
            className={`px-4 py-2 rounded text-sm font-semibold ${
              filtroSeveridad === s
                ? s === 'CRÍTICA'
                  ? 'bg-red-600 text-white'
                  : s === 'ALTA'
                  ? 'bg-orange-600 text-white'
                  : s === 'MEDIA'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-800'
            }`}
          >
            {s === 'todo' ? 'Todas' : s}
          </button>
        ))}
      </div>

      {/* Anomalías detectadas */}
      {anomalias_filtradas.length === 0 ? (
        <div className="p-4 bg-green-50 border border-green-300 rounded-lg text-center">
          <p className="text-green-800 font-semibold">✅ Sin anomalías detectadas</p>
          <p className="text-green-700 text-sm">Los patrones de gasto son normales.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {anomalias_filtradas.map(anomalia => (
            <div key={anomalia.id} className={`p-4 border-2 rounded-lg ${colorSeveridad[anomalia.severity]}`}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{iconoSeveridad[anomalia.severity]}</span>
                  <div>
                    <div className="font-bold text-sm">Severidad {anomalia.severity}</div>
                    <div className="text-xs opacity-75">{anomalia.fecha}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">${anomalia.monto.toLocaleString('es-MX')}</div>
                  <div className="text-xs opacity-75">z-score: {anomalia.z_score}</div>
                </div>
              </div>

              <div className="bg-white bg-opacity-50 p-2 rounded mt-2">
                <p className="text-sm font-semibold mb-1">🔍 Razón: {anomalia.razon}</p>
                <p className="text-sm mb-2">💡 Acción: {anomalia.accion}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-600 h-2 rounded-full"
                      style={{ width: `${anomalia.confianza}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold">{anomalia.confianza}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Clustering de categorías */}
      {data.clustering.length > 0 && (
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <h3 className="text-lg font-bold mb-4">📊 Clustering por Categoría</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Categoría</th>
                  <th className="text-center p-2">Cantidad</th>
                  <th className="text-right p-2">Promedio</th>
                  <th className="text-right p-2">Total</th>
                  <th className="text-right p-2">Rango</th>
                </tr>
              </thead>
              <tbody>
                {data.clustering.slice(0, 10).map((cluster, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-semibold">{cluster.categoria}</td>
                    <td className="p-2 text-center">{cluster.cantidad}</td>
                    <td className="p-2 text-right">${cluster.promedio_gasto.toLocaleString('es-MX')}</td>
                    <td className="p-2 text-right font-bold">${cluster.total.toLocaleString('es-MX')}</td>
                    <td className="p-2 text-right text-xs">
                      ${cluster.rango.min.toLocaleString('es-MX')} - ${cluster.rango.max.toLocaleString('es-MX')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Patrones detectados */}
      {data.patrones.length > 0 && (
        <div className="p-4 bg-indigo-50 border border-indigo-300 rounded-lg">
          <h3 className="text-lg font-bold text-indigo-900 mb-3">🎯 Patrones Detectados</h3>
          <div className="space-y-2">
            {data.patrones.map((patron, i) => (
              <div key={i} className="bg-white bg-opacity-60 p-3 rounded">
                <div className="font-semibold text-indigo-900">{patron.tipo}</div>
                <div className="text-sm text-indigo-800">{patron.descripcion}</div>
                <div className="text-xs text-indigo-700 mt-1">👉 {patron.accion}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
