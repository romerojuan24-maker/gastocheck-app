'use client';

import { useState } from 'react';

export function BancoCheckFlujo({ empresaId }: { empresaId: string }) {
  const [periodo, setPeriodo] = useState<'dia' | 'semana' | 'mes'>('dia');

  // Datos simulados (en producción, vienen de Edge Function)
  const datos = {
    dia: {
      ingresos: 8200,
      egresos: 2500,
      neto: 5700,
    },
    semana: {
      ingresos: 45000,
      egresos: 12000,
      neto: 33000,
    },
    mes: {
      ingresos: 185000,
      egresos: 52000,
      neto: 133000,
    },
  };

  const d = datos[periodo];
  const saldo_anterior = periodo === 'dia' ? 150000 : periodo === 'semana' ? 145000 : 100000;
  const saldo_final = saldo_anterior + d.neto;

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <h3 className="text-xl font-bold mb-4">📈 Flujo de Efectivo</h3>

      {/* Selector de período */}
      <div className="flex gap-2 mb-6">
        {(['dia', 'semana', 'mes'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`px-4 py-2 rounded font-semibold text-sm ${
              periodo === p ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            {p === 'dia' ? 'Hoy' : p === 'semana' ? 'Esta Semana' : 'Este Mes'}
          </button>
        ))}
      </div>

      {/* Flujo */}
      <div className="space-y-4">
        {/* Saldo anterior */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Saldo Anterior</div>
          <div className="text-3xl font-bold text-gray-800">${saldo_anterior.toLocaleString('es-MX')}</div>
        </div>

        {/* Movimientos */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-sm text-gray-600">Ingresos</div>
            <div className="text-2xl font-bold text-green-600">+${d.ingresos.toLocaleString('es-MX')}</div>
          </div>
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="text-sm text-gray-600">Egresos</div>
            <div className="text-2xl font-bold text-red-600">-${d.egresos.toLocaleString('es-MX')}</div>
          </div>
        </div>

        {/* Neto */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-sm text-gray-600">Neto del Período</div>
          <div className="text-2xl font-bold text-blue-600">{d.neto >= 0 ? '+' : '-'}${Math.abs(d.neto).toLocaleString('es-MX')}</div>
        </div>

        {/* Saldo final */}
        <div className={`p-4 rounded-lg border-2 ${saldo_final >= 0 ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
          <div className="text-sm text-gray-600">Saldo Final</div>
          <div className={`text-3xl font-bold ${saldo_final >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${saldo_final.toLocaleString('es-MX')}
          </div>
        </div>
      </div>

      {/* Alertas */}
      {saldo_final < 10000 && (
        <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md text-sm">
          ⚠️ Saldo bajo: Considera aumentar ingresos o reducir egresos
        </div>
      )}

      {d.neto > 0 && (
        <div className="mt-4 p-3 bg-green-100 border border-green-300 text-green-700 rounded-md text-sm">
          ✅ Flujo positivo: {periodo === 'dia' ? 'Buen día' : 'Buen ' + periodo}
        </div>
      )}
    </div>
  );
}
