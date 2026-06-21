'use client';

import { useState, useEffect } from 'react';

interface ProductoStock {
  id: string;
  nombre: string;
  codigo: string;
  stock_actual: number;
  stock_minimo: number;
  stock_maximo: number;
  stock_reservado: number;
  unidad: string;
  proveedor: string;
  auto_ordenar: boolean;
}

interface Orden {
  id: string;
  producto: string;
  cantidad: number;
  estado: 'PENDIENTE' | 'ORDENADA' | 'EN_TRANSITO' | 'RECIBIDA';
  fecha_esperada: string;
  proveedor: string;
}

export function InventarioDashboard({ empresaId }: { empresaId: string }) {
  const [productos, setProductos] = useState<ProductoStock[]>([]);
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<'todo' | 'bajo' | 'critico'>('todo');

  useEffect(() => {
    // Simular carga de datos
    const productosDemo = [
      {
        id: '1',
        nombre: 'Aceite Motor 5W30',
        codigo: 'ACE-001',
        stock_actual: 45,
        stock_minimo: 10,
        stock_maximo: 100,
        stock_reservado: 5,
        unidad: 'L',
        proveedor: 'Grupo Petrosa',
        auto_ordenar: true,
      },
      {
        id: '2',
        nombre: 'Filtro Aire',
        codigo: 'FIL-002',
        stock_actual: 12,
        stock_minimo: 5,
        stock_maximo: 30,
        stock_reservado: 0,
        unidad: 'pz',
        proveedor: 'Mann+Hummel',
        auto_ordenar: true,
      },
      {
        id: '3',
        nombre: 'Bujías',
        codigo: 'BUJ-003',
        stock_actual: 3,
        stock_minimo: 8,
        stock_maximo: 20,
        stock_reservado: 2,
        unidad: 'set',
        proveedor: 'Bosch',
        auto_ordenar: true,
      },
      {
        id: '4',
        nombre: 'Refrigerante',
        codigo: 'REF-004',
        stock_actual: 8,
        stock_minimo: 5,
        stock_maximo: 25,
        stock_reservado: 0,
        unidad: 'L',
        proveedor: 'Valvoline',
        auto_ordenar: false,
      },
    ];

    const ordenesDemo = [
      {
        id: 'ORD-001',
        producto: 'Bujías',
        cantidad: 15,
        estado: 'PENDIENTE',
        fecha_esperada: '2026-06-28',
        proveedor: 'Bosch',
      },
      {
        id: 'ORD-002',
        producto: 'Aceite Motor 5W30',
        cantidad: 50,
        estado: 'EN_TRANSITO',
        fecha_esperada: '2026-06-25',
        proveedor: 'Grupo Petrosa',
      },
    ];

    setProductos(productosDemo);
    setOrdenes(ordenesDemo);
  }, [empresaId]);

  // Filtrar productos
  let productosFiltrados = productos;
  if (filtroEstado === 'critico') {
    productosFiltrados = productos.filter(p => p.stock_actual < p.stock_minimo);
  } else if (filtroEstado === 'bajo') {
    productosFiltrados = productos.filter(
      p => p.stock_actual >= p.stock_minimo && p.stock_actual <= p.stock_minimo * 1.5
    );
  }

  // Calcular métricas
  const criticos = productos.filter(p => p.stock_actual < p.stock_minimo).length;
  const bajos = productos.filter(p => p.stock_actual >= p.stock_minimo && p.stock_actual <= p.stock_minimo * 1.5).length;
  const ordenesActivas = ordenes.filter(o => ['PENDIENTE', 'EN_TRANSITO'].includes(o.estado)).length;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-gray-600">Total Productos</div>
          <div className="text-2xl font-bold text-blue-600">{productos.length}</div>
        </div>

        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-sm text-gray-600">Stock Bajo</div>
          <div className="text-2xl font-bold text-yellow-600">{bajos}</div>
        </div>

        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-sm text-gray-600">Stock Crítico</div>
          <div className="text-2xl font-bold text-red-600">{criticos}</div>
        </div>

        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="text-sm text-gray-600">Órdenes Activas</div>
          <div className="text-2xl font-bold text-purple-600">{ordenesActivas}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <button
          onClick={() => setFiltroEstado('todo')}
          className={`px-4 py-2 rounded text-sm font-semibold ${
            filtroEstado === 'todo' ? 'bg-blue-600 text-white' : 'bg-gray-200'
          }`}
        >
          Todos ({productos.length})
        </button>
        <button
          onClick={() => setFiltroEstado('bajo')}
          className={`px-4 py-2 rounded text-sm font-semibold ${
            filtroEstado === 'bajo' ? 'bg-yellow-600 text-white' : 'bg-gray-200'
          }`}
        >
          Bajo ⚠️ ({bajos})
        </button>
        <button
          onClick={() => setFiltroEstado('critico')}
          className={`px-4 py-2 rounded text-sm font-semibold ${
            filtroEstado === 'critico' ? 'bg-red-600 text-white' : 'bg-gray-200'
          }`}
        >
          Crítico 🚨 ({criticos})
        </button>
      </div>

      {/* Tabla de stock */}
      <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">Producto</th>
              <th className="text-center p-3">Stock Actual</th>
              <th className="text-center p-3">Mínimo</th>
              <th className="text-center p-3">Máximo</th>
              <th className="text-center p-3">Reservado</th>
              <th className="text-center p-3">Estado</th>
              <th className="text-center p-3">Auto-Orden</th>
            </tr>
          </thead>
          <tbody>
            {productosFiltrados.map(p => {
              const estado =
                p.stock_actual < p.stock_minimo
                  ? { text: '🚨 CRÍTICO', color: 'bg-red-100 text-red-800' }
                  : p.stock_actual <= p.stock_minimo * 1.5
                  ? { text: '⚠️ BAJO', color: 'bg-yellow-100 text-yellow-800' }
                  : { text: '✅ OK', color: 'bg-green-100 text-green-800' };

              const disponible = p.stock_actual - p.stock_reservado;

              return (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    <div className="font-semibold">{p.nombre}</div>
                    <div className="text-xs text-gray-500">{p.codigo}</div>
                  </td>
                  <td className="p-3 text-center font-bold">{p.stock_actual} {p.unidad}</td>
                  <td className="p-3 text-center">{p.stock_minimo} {p.unidad}</td>
                  <td className="p-3 text-center">{p.stock_maximo} {p.unidad}</td>
                  <td className="p-3 text-center text-xs">
                    {p.stock_reservado > 0 ? `${p.stock_reservado} (${disponible} disp.)` : '—'}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${estado.color}`}>
                      {estado.text}
                    </span>
                  </td>
                  <td className="p-3 text-center">{p.auto_ordenar ? '✅' : '❌'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Órdenes pendientes */}
      {ordenes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-bold text-lg mb-3">📋 Órdenes de Compra</h3>
          <div className="space-y-2">
            {ordenes.map(o => {
              const colorEstado = {
                PENDIENTE: 'bg-yellow-50 border-yellow-300',
                ORDENADA: 'bg-blue-50 border-blue-300',
                EN_TRANSITO: 'bg-purple-50 border-purple-300',
                RECIBIDA: 'bg-green-50 border-green-300',
              };

              return (
                <div key={o.id} className={`p-3 border-2 rounded ${colorEstado[o.estado]}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">{o.id}: {o.producto}</div>
                      <div className="text-sm text-gray-600">Cantidad: {o.cantidad} | Proveedor: {o.proveedor}</div>
                      <div className="text-xs text-gray-500">Fecha esperada: {o.fecha_esperada}</div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      o.estado === 'PENDIENTE'
                        ? 'bg-yellow-200 text-yellow-800'
                        : o.estado === 'EN_TRANSITO'
                        ? 'bg-purple-200 text-purple-800'
                        : 'bg-green-200 text-green-800'
                    }`}>
                      {o.estado}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Información */}
      <div className="p-4 bg-blue-50 border border-blue-300 rounded-lg">
        <h3 className="font-bold text-blue-900 mb-2">💡 Gestión de Inventario</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✅ Rastreo automático de entrada/salida</li>
          <li>✅ Alertas de stock bajo automáticas</li>
          <li>✅ Órdenes de compra automáticas</li>
          <li>✅ Reservas de stock (asignaciones)</li>
          <li>✅ Historial de movimientos completo</li>
        </ul>
      </div>
    </div>
  );
}
