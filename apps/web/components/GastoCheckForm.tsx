'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function GastoCheckForm({ empresaId }: { empresaId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);

    try {
      const response = await fetch('/api/gastocheck/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaId,
          monto: parseFloat(formData.get('monto') as string),
          fecha: formData.get('fecha'),
          concepto: formData.get('concepto'),
          rfc_proveedor: formData.get('rfc_proveedor'),
          nombre_proveedor: formData.get('nombre_proveedor'),
          categoria: formData.get('categoria'),
          ocr_confidence: 'high',
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setSuccess(true);
      e.currentTarget.reset();

      // Refrescar página
      setTimeout(() => router.refresh(), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear gasto');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <h2 className="text-xl font-bold">💰 Nuevo Gasto</h2>

      <div>
        <label className="block text-sm font-medium">Concepto</label>
        <input
          type="text"
          name="concepto"
          required
          placeholder="Ej: Compra papel A4"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Monto</label>
        <input
          type="number"
          name="monto"
          required
          step="0.01"
          placeholder="0.00"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Fecha</label>
        <input
          type="date"
          name="fecha"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Proveedor</label>
        <input
          type="text"
          name="nombre_proveedor"
          placeholder="Ej: Proveedor A"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">RFC Proveedor</label>
        <input
          type="text"
          name="rfc_proveedor"
          placeholder="13 caracteres"
          maxLength={13}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Categoría</label>
        <select
          name="categoria"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="Sin categorizar">Sin categorizar</option>
          <option value="Gastos Administrativos">Gastos Administrativos</option>
          <option value="Combustibles">Combustibles</option>
          <option value="Servicios">Servicios</option>
          <option value="Compras">Compras</option>
        </select>
      </div>

      {error && <div className="p-3 bg-red-100 text-red-700 rounded-md">{error}</div>}
      {success && <div className="p-3 bg-green-100 text-green-700 rounded-md">✅ Gasto creado + Póliza automática</div>}

      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Guardando...' : '💾 Guardar Gasto'}
      </button>
    </form>
  );
}
