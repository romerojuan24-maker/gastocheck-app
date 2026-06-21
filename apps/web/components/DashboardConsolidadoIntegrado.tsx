'use client';

import { useEffect, useState } from 'react';

interface DashboardData {
  gastos_totales: number;
  ingresos_totales: number;
  saldo_actual: number;
  movimientos_total: number;
  movimientos_pagados: number;
  porcentaje_reconciliacion: number;
  polizas_generadas: number;
  anomalias_criticas: number;
  stock_bajo_count: number;
  saldo_critico: boolean;
  dias_criticos_proximos: number;
  alertas: any[];
}

export function DashboardConsolidadoIntegrado({ empresaId }: { empresaId: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const response = await fetch(`/api/dashboard/integrado?empresa_id=${empresaId}`);
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
    // Actualizar cada 5 segundos (datos en tiempo real)
    const interval = setInterval(fetchDashboard, 5000);
    return () => clearInterval(interval);
  }, [empresaId]);

  if (loading) return <div className="p-4 text-center text-gray-500">Cargando dashboard integrado...</div>;
  if (!data) return <div className="p-4 text-center text-red-500">Error al cargar dashboard</div>;

  // Calcular saldo neto
  const saldo_neto = data.ingresos_totales - data.gastos_totales;
  const es_positivo = saldo_neto >= 0;

  return (
    <div className="space-y-6">
      {/* TÍTULO CON ESTADO GLOBAL */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold">📊 Dashboard Consolidado</h2>
            <p className="text-blue-100 mt-2">Integración en tiempo real de todos los módulos</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-blue-100">Estado Global</div>
            <div className="text-2xl font-bold">
              {data.porcentaje_reconciliacion === 100 ? '✅ PERFECTO' : '⚠️ REVISIÓN NECESARIA'}
            </div>
          </div>
        </div>
      </div>

      {/* FILA 1: KPIs PRINCIPALES */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Gastos */}
        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
          <div className="text-sm text-gray-600">💰 Gastos Totales</div>
          <div className="text-2xl font-bold text-red-600">${data.gastos_totales.toLocaleString('es-MX')}</div>
          <div className="text-xs text-gray-500 mt-1">GastoCheck + Inventarios</div>
        </div>

        {/* Ingresos */}
        <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
          <div className="text-sm text-gray-600">💵 Ingresos Totales</div>
          <div className="text-2xl font-bold text-green-600">${data.ingresos_totales.toLocaleString('es-MX')}</div>
          <div className="text-xs text-gray-500 mt-1">CobraCheck + Banco</div>
        </div>

        {/* Saldo Neto */}
        <div
          className={`p-4 border-2 rounded-lg ${
            es_positivo ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="text-sm text-gray-600">🏦 Saldo Neto</div>
          <div className={`text-2xl font-bold ${es_positivo ? 'text-blue-600' : 'text-red-600'}`}>
            ${saldo_neto.toLocaleString('es-MX')}
          </div>
          <div className="text-xs text-gray-500 mt-1">Ingresos - Gastos</div>
        </div>

        {/* Reconciliación */}
        <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
          <div className="text-sm text-gray-600">♻️ Reconciliación</div>
          <div className="text-2xl font-bold text-purple-600">{data.porcentaje_reconciliacion.toFixed(1)}%</div>
          <div className="text-xs text-gray-500 mt-1">BancoCheck validado</div>
        </div>

        {/* Pólizas */}
        <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
          <div className="text-sm text-gray-600">📋 Pólizas</div>
          <div className="text-2xl font-bold text-yellow-600">{data.polizas_generadas}</div>
          <div className="text-xs text-gray-500 mt-1">Auto-generadas</div>
        </div>
      </div>

      {/* FILA 2: INTEGRACIÓN Y ALERTAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Movimientos */}
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <div className="text-sm font-bold text-gray-800 mb-2">📈 Movimientos</div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Totales registrados</span>
              <span className="font-bold">{data.movimientos_total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Reconciliados (banco)</span>
              <span className="font-bold text-green-600">{data.movimientos_pagados}</span>
            </div>
            <div className="mt-2 pt-2 border-t">
              <div className="flex justify-between">
                <span className="text-xs font-semibold text-gray-800">% Reconciliado</span>
                <span className="text-sm font-bold">{data.porcentaje_reconciliacion.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Alertas CheckIA */}
        <div className={`p-4 rounded-lg border-2 ${data.anomalias_criticas > 0 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
          <div className={`text-sm font-bold mb-2 ${data.anomalias_criticas > 0 ? 'text-red-900' : 'text-green-900'}`}>
            🤖 Análisis CheckIA
          </div>
          {data.anomalias_criticas > 0 ? (
            <div className="space-y-1">
              <div className="text-2xl font-bold text-red-600">{data.anomalias_criticas}</div>
              <div className="text-xs text-red-700">Anomalías CRÍTICAS detectadas</div>
              <button className="mt-2 text-xs text-red-600 font-semibold hover:underline">
                → Ver detalles en CheckIA
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-2xl font-bold text-green-600">✅</div>
              <div className="text-xs text-green-700">Sin anomalías detectadas</div>
            </div>
          )}
        </div>

        {/* Alertas Inventarios */}
        <div className={`p-4 rounded-lg border-2 ${data.stock_bajo_count > 0 ? 'bg-yellow-50 border-yellow-300' : 'bg-green-50 border-green-300'}`}>
          <div className={`text-sm font-bold mb-2 ${data.stock_bajo_count > 0 ? 'text-yellow-900' : 'text-green-900'}`}>
            📦 Inventario
          </div>
          {data.stock_bajo_count > 0 ? (
            <div className="space-y-1">
              <div className="text-2xl font-bold text-yellow-600">{data.stock_bajo_count}</div>
              <div className="text-xs text-yellow-700">Artículos con stock bajo</div>
              <button className="mt-2 text-xs text-yellow-600 font-semibold hover:underline">
                → Ver en Inventarios
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-2xl font-bold text-green-600">✅</div>
              <div className="text-xs text-green-700">Stock OK en todos los productos</div>
            </div>
          )}
        </div>
      </div>

      {/* FILA 3: FLUJO CHECK */}
      <div className="p-4 bg-indigo-50 border-2 border-indigo-300 rounded-lg">
        <div className="text-sm font-bold text-indigo-900 mb-3">📈 Proyección FlujoCheck</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-indigo-700">Saldo Mínimo (próx. 30 días)</div>
            <div className="text-2xl font-bold text-indigo-600 mt-1">
              ${(data.saldo_actual || 0).toLocaleString('es-MX')}
            </div>
          </div>
          <div>
            <div className="text-xs text-indigo-700">Días en Zona Crítica</div>
            <div className={`text-2xl font-bold mt-1 ${data.dias_criticos_proximos > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {data.dias_criticos_proximos}
            </div>
          </div>
          <div>
            <div className="text-xs text-indigo-700">Estado</div>
            <div className={`text-2xl font-bold mt-1 ${data.saldo_critico ? 'text-red-600' : 'text-green-600'}`}>
              {data.saldo_critico ? '🚨 CRÍTICO' : '✅ OK'}
            </div>
          </div>
        </div>
      </div>

      {/* FILA 4: ALERTAS GLOBALES */}
      {data.alertas && data.alertas.length > 0 && (
        <div className="p-4 bg-white border-2 border-orange-300 rounded-lg">
          <h3 className="text-sm font-bold text-orange-900 mb-3">🔔 Alertas Integradas ({data.alertas.length})</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {data.alertas.slice(0, 5).map((alerta, i) => {
              const colorBg = alerta.severidad === 'CRÍTICO' ? 'bg-red-100' : 'bg-yellow-100';
              const colorText = alerta.severidad === 'CRÍTICO' ? 'text-red-800' : 'text-yellow-800';
              const icono = alerta.severidad === 'CRÍTICO' ? '🚨' : '⚠️';

              return (
                <div key={i} className={`p-2 rounded ${colorBg}`}>
                  <div className={`text-xs font-semibold ${colorText}`}>
                    {icono} {alerta.tipo}: {alerta.descripcion}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{new Date(alerta.fecha_creacion).toLocaleString()}</div>
                </div>
              );
            })}
          </div>
          {data.alertas.length > 5 && (
            <button className="mt-3 text-xs text-orange-600 font-semibold hover:underline w-full">
              Ver todas las alertas ({data.alertas.length})
            </button>
          )}
        </div>
      )}

      {/* FOOTER: INFORMACIÓN DE INTEGRACIÓN */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="text-sm font-bold text-gray-800 mb-2">🔗 Flujo de Integración Activo</h3>
        <div className="text-xs text-gray-600 space-y-1">
          <div>
            ✅ <strong>GastoCheck</strong> → INSERT movimientos_financieros (GASTO) → Póliza automática → Dashboard actualiza
          </div>
          <div>
            ✅ <strong>CobraCheck</strong> → INSERT movimientos_financieros (INGRESO) → Póliza automática → FlujoCheck recalcula
          </div>
          <div>
            ✅ <strong>BancoCheck</strong> → UPDATE estado_pago = PAGADO → Dashboard muestra reconciliación → FlujoCheck ajusta proyección
          </div>
          <div>
            ✅ <strong>CheckIA</strong> → Detecta anomalías → Crea alertas → Dashboard muestra estado crítico
          </div>
          <div>
            ✅ <strong>Inventarios</strong> → Stock bajo → Orden automática → Afecta FlujoCheck → Dashboard alerta
          </div>
        </div>
      </div>

      {/* CAJA CUADRA 100% */}
      {data.porcentaje_reconciliacion === 100 && (
        <div className="p-4 bg-gradient-to-r from-green-100 to-green-50 border-2 border-green-300 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-700">✅ CAJA CUADRA 100%</div>
          <p className="text-sm text-green-600 mt-1">Todos los movimientos están reconciliados con el banco</p>
        </div>
      )}
    </div>
  );
}
