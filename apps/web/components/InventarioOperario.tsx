'use client';

import { useState, useEffect } from 'react';

interface Producto {
  id: string;
  nombre: string;
  codigo: string;
  stock_actual: number;
  stock_minimo: number;
  unidad: string;
}

export function InventarioOperario({ empresaId }: { empresaId: string }) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [cantidad, setCantidad] = useState<number>(0);
  const [accion, setAccion] = useState<'entrada' | 'salida'>('entrada');
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    // Simular carga de productos
    const productosDemo = [
      { id: '1', nombre: 'Aceite Motor 5W30', codigo: 'ACE-001', stock_actual: 45, stock_minimo: 10, unidad: 'L' },
      { id: '2', nombre: 'Filtro Aire', codigo: 'FIL-002', stock_actual: 12, stock_minimo: 5, unidad: 'pz' },
      { id: '3', nombre: 'Bujías', codigo: 'BUJ-003', stock_actual: 3, stock_minimo: 8, unidad: 'set' },
      { id: '4', nombre: 'Refrigerante', codigo: 'REF-004', stock_actual: 8, stock_minimo: 5, unidad: 'L' },
    ];
    setProductos(productosDemo);
  }, [empresaId]);

  async function handleRegistrarMovimiento() {
    if (!selectedProducto || cantidad <= 0) {
      setMensaje('❌ Selecciona producto y cantidad');
      return;
    }

    setProcesando(true);
    try {
      const response = await fetch('/api/inventario/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaId,
          accion,
          producto_id: selectedProducto.id,
          cantidad,
          nota: `${accion === 'entrada' ? 'Entrada' : 'Salida'} de ${cantidad} ${selectedProducto.unidad}`,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      // Actualizar stock local
      setProductos(productos.map(p =>
        p.id === selectedProducto.id
          ? { ...p, stock_actual: data.producto.stock_nuevo }
          : p
      ));

      setMensaje(`✅ ${data.mensaje}`);
      if (data.alerta === 'STOCK_BAJO') {
        setMensaje(prev => prev + '\n⚠️ Stock bajo - ' + (data.orden_generada ? 'Orden generada automáticamente' : 'Requiere orden manual'));
      }

      setCantidad(0);
      setSelectedProducto(null);
    } catch (error) {
      setMensaje(`❌ Error: ${error instanceof Error ? error.message : 'Desconocido'}`);
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-white border border-gray-200 rounded-lg">
        <h3 className="text-lg font-bold mb-4">📦 Registrar Movimiento de Stock</h3>

        {/* Seleccionar acción */}
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">Tipo de movimiento</label>
          <div className="flex gap-2">
            <button
              onClick={() => setAccion('entrada')}
              className={`flex-1 px-4 py-2 rounded font-semibold ${
                accion === 'entrada' ? 'bg-green-600 text-white' : 'bg-gray-200'
              }`}
            >
              📥 Entrada (Recibir)
            </button>
            <button
              onClick={() => setAccion('salida')}
              className={`flex-1 px-4 py-2 rounded font-semibold ${
                accion === 'salida' ? 'bg-red-600 text-white' : 'bg-gray-200'
              }`}
            >
              📤 Salida (Usar)
            </button>
          </div>
        </div>

        {/* Seleccionar producto */}
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">Producto</label>
          <select
            value={selectedProducto?.id || ''}
            onChange={e => {
              const p = productos.find(pr => pr.id === e.target.value);
              setSelectedProducto(p || null);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Selecciona un producto...</option>
            {productos.map(p => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.codigo}) - Stock: {p.stock_actual} {p.unidad}
              </option>
            ))}
          </select>
        </div>

        {/* Cantidad */}
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">Cantidad</label>
          <input
            type="number"
            min="0"
            value={cantidad}
            onChange={e => setCantidad(parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Ingresa cantidad"
          />
          {selectedProducto && (
            <p className="text-xs text-gray-500 mt-1">
              Unidad: {selectedProducto.unidad} | Stock actual: {selectedProducto.stock_actual}
            </p>
          )}
        </div>

        {/* Botón registrar */}
        <button
          onClick={handleRegistrarMovimiento}
          disabled={procesando}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-bold"
        >
          {procesando ? '🔄 Procesando...' : '✅ Registrar Movimiento'}
        </button>

        {/* Mensaje */}
        {mensaje && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded text-sm whitespace-pre-wrap">
            {mensaje}
          </div>
        )}
      </div>

      {/* Historial rápido */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="font-semibold mb-3">📊 Stock Actual</h3>
        <div className="space-y-2">
          {productos.map(p => (
            <div key={p.id} className="flex justify-between items-center p-2 bg-white rounded border border-gray-200">
              <div>
                <div className="font-semibold text-sm">{p.nombre}</div>
                <div className="text-xs text-gray-500">{p.codigo}</div>
              </div>
              <div className="text-right">
                <div className={`font-bold ${p.stock_actual <= p.stock_minimo ? 'text-red-600' : 'text-green-600'}`}>
                  {p.stock_actual} {p.unidad}
                </div>
                {p.stock_actual <= p.stock_minimo && (
                  <div className="text-xs text-red-600">⚠️ Bajo</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
