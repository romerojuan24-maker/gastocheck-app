'use client';

import { useEffect, useState } from 'react';

interface ProyeccionDia {
  dia: number;
  fecha: string;
  saldo_anterior: number;
  ingresos: number;
  egresos: number;
  saldo: number;
  alertas: string[] | null;
  es_critico: boolean;
  es_bajo: boolean;
}

interface ProyeccionData {
  saldo_actual: number;
  saldo_final: number;
  promedio_gasto_diario: number;
  proyeccion: ProyeccionDia[];
  dias_criticos: number[];
  recomendaciones: string[];
}

export function FlujoCheckProyeccion({ empresaId }: { empresaId: string }) {
  const [data, setData] = useState<ProyeccionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'todo' | 'critico' | 'bajo'>('todo');

  useEffect(() => {
    async function fetchProyeccion() {
      try {
        const response = await fetch(`/api/flujocheck/proyeccion?empresa_id=${empresaId}&dias=30`);
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProyeccion();
  }, [empresaId]);

  if (loading) return <div className="p-4 text-center text-gray-500">Proyectando flujo...</div>;
  if (!data) return <div className="p-4 text-center text-red-500">Error al cargar proyección</div>;

  // Filtrar proyección según filtro
  let proyeccion_filtrada = data.proyeccion;
  if (filtro === 'critico') {
    proyeccion_filtrada = data.proyeccion.filter(p => p.es_critico);
  } else if (filtro === 'bajo') {
    proyeccion_filtrada = data.proyeccion.filter(p => p.es_bajo);
  }

  // Calcular estadísticas
  const saldo_minimo = Math.min(...data.proyeccion.map(p => p.saldo));
  const saldo_maximo = Math.max(...data.proyeccion.map(p => p.saldo));
  const promedio_saldo = data.proyeccion.reduce((sum, p) => sum + p.saldo, 0) / data.proyeccion.length;

  return (
    <div className="space-y-6">
      {/* Resumen KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-gray-600">Saldo Hoy</div>
          <div className="text-2xl font-bold text-blue-600">${data.saldo_actual.toLocaleString('es-MX')}</div>
        </div>

        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="text-sm text-gray-600">Saldo Final (Día 30)</div>
          <div className={`text-2xl font-bold ${data.saldo_final >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${data.saldo_final.toLocaleString('es-MX')}
          </div>
        </div>

        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="text-sm text-gray-600">Promedio Gasto/Día</div>
          <div className="text-2xl font-bold text-orange-600">
            ${data.promedio_gasto_diario.toLocaleString('es-MX')}
          </div>
        </div>

        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-sm text-gray-600">Saldo Mínimo</div>
          <div className="text-2xl font-bold text-red-600">${saldo_minimo.toLocaleString('es-MX')}</div>
        </div>
      </div>

      {/* Gráfico simulado (ASCII para demo) */}
      <div className="p-4 bg-white border border-gray-200 rounded-lg">
        <h3 className="text-lg font-bold mb-4">📈 Proyección 30 Días</h3>

        <div className="bg-gray-50 p-4 rounded border border-gray-200 text-xs font-mono">
          <div className="text-center text-gray-600 mb-2">Saldo Proyectado (Escala simplificada)</div>
          <pre>{`
$${saldo_maximo.toLocaleString('es-MX')} ┤
               │                      ╱╲
               │                  ╱╲╱  ╲
$${promedio_saldo.toLocaleString('es-MX')} ┤              ╱╲╱    ╲    ╱╲
               │          ╱╲╱        ╲╱  ╲╱╲
$${saldo_minimo.toLocaleString('es-MX')} ┤──╱────────────────────────────
               └────────────────────────────
                Día  5  10  15  20  25  30
          `}</pre>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          📊 Visualización simplificada. Datos reales en tabla abajo.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <button
          onClick={() => setFiltro('todo')}
          className={`px-4 py-2 rounded text-sm font-semibold ${
            filtro === 'todo' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
          }`}
        >
          Todos los días
        </button>
        <button
          onClick={() => setFiltro('bajo')}
          className={`px-4 py-2 rounded text-sm font-semibold ${
            filtro === 'bajo' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-800'
          }`}
        >
          Saldo Bajo ⚠️
        </button>
        <button
          onClick={() => setFiltro('critico')}
          className={`px-4 py-2 rounded text-sm font-semibold ${
            filtro === 'critico' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-800'
          }`}
        >
          Críticos 🔴
        </button>
      </div>

      {/* Tabla detallada */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-2">Día</th>
              <th className="text-left p-2">Fecha</th>
              <th className="text-right p-2">Saldo Anterior</th>
              <th className="text-right p-2">Ingresos</th>
              <th className="text-right p-2">Egresos</th>
              <th className="text-right p-2">Saldo Final</th>
              <th className="text-left p-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {proyeccion_filtrada.map((p) => (
              <tr
                key={p.dia}
                className={`border-b ${
                  p.es_critico ? 'bg-red-50' : p.es_bajo ? 'bg-yellow-50' : 'hover:bg-gray-50'
                }`}
              >
                <td className="p-2 font-semibold">{p.dia}</td>
                <td className="p-2 text-gray-600">{p.fecha}</td>
                <td className="p-2 text-right">${p.saldo_anterior.toLocaleString('es-MX')}</td>
                <td className="p-2 text-right text-green-600">
                  {p.ingresos > 0 ? `+$${p.ingresos.toLocaleString('es-MX')}` : '—'}
                </td>
                <td className="p-2 text-right text-red-600">-${p.egresos.toLocaleString('es-MX')}</td>
                <td className={`p-2 text-right font-bold ${p.saldo >= 10000 ? 'text-green-600' : 'text-red-600'}`}>
                  ${p.saldo.toLocaleString('es-MX')}
                </td>
                <td className="p-2">
                  {p.es_critico ? (
                    <span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs rounded font-semibold">
                      🔴 CRÍTICO
                    </span>
                  ) : p.es_bajo ? (
                    <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded font-semibold">
                      ⚠️ BAJO
                    </span>
                  ) : (
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded">✅ OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recomendaciones */}
      {data.recomendaciones.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-300 rounded-lg">
          <h3 className="font-bold text-blue-900 mb-2">💡 Recomendaciones</h3>
          <ul className="space-y-1">
            {data.recomendaciones.map((rec, i) => (
              <li key={i} className="text-sm text-blue-800">
                • {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Alertas de días críticos */}
      {data.dias_criticos.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-300 rounded-lg">
          <h3 className="font-bold text-red-900 mb-2">🚨 Días Críticos (Saldo &lt; $5k)</h3>
          <p className="text-sm text-red-800">
            {data.dias_criticos.map(d => `Día ${d}`).join(', ')}
          </p>
          <p className="text-xs text-red-700 mt-2">
            Planifica cobros o reduce gastos en estos días para evitar insolvencia.
          </p>
        </div>
      )}

      {/* Buen flujo */}
      {data.saldo_final > data.saldo_actual && (
        <div className="p-4 bg-green-50 border border-green-300 rounded-lg">
          <h3 className="font-bold text-green-900 mb-1">✅ Flujo Positivo</h3>
          <p className="text-sm text-green-800">
            Tu flujo proyectado es positivo: ${(data.saldo_final - data.saldo_actual).toLocaleString('es-MX')} ganancia en 30 días.
          </p>
        </div>
      )}
    </div>
  );
}
