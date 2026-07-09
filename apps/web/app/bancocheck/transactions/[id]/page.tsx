'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function TransactionDetail() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [transaction, setTransaction] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClassifyModal, setShowClassifyModal] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [classifyForm, setClassifyForm] = useState({
    status: '',
    category: '',
    notes: '',
  });
  const [matchForm, setMatchForm] = useState({
    entityType: '',
    entityId: '',
    confidence: 100,
  });

  useEffect(() => {
    fetchTransaction();
  }, [id]);

  const fetchTransaction = async () => {
    try {
      const res = await fetch(`/api/bancocheck/transactions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setTransaction(data);
        setClassifyForm({
          status: data.status || '',
          category: data.category || '',
          notes: data.notes || '',
        });
        setMatchForm({
          entityType: data.matchedEntityType || '',
          entityId: data.matchedEntityId || '',
          confidence: data.confidence || 100,
        });
        fetchSuggestions();
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const res = await fetch(`/api/bancocheck/transactions/${id}/suggest-matches`);
      if (res.ok) setSuggestions(await res.json());
    } catch (err) {
      console.error('Error fetching suggestions:', err);
    }
  };

  const handleClassify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/bancocheck/transactions/${id}/classify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(classifyForm),
      });
      if (res.ok) {
        await fetchTransaction();
        setShowClassifyModal(false);
        alert('✓ Transacción clasificada');
      }
    } catch (err) {
      alert('Error al clasificar');
    }
  };

  const handleMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/bancocheck/transactions/${id}/match`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: matchForm.entityType,
          entityId: matchForm.entityId,
          confidence: matchForm.confidence,
        }),
      });
      if (res.ok) {
        await fetchTransaction();
        setShowMatchModal(false);
        alert('✓ Transacción relacionada');
      }
    } catch (err) {
      alert('Error al relacionar');
    }
  };

  const handleMarkPersonal = async () => {
    try {
      const res = await fetch(`/api/bancocheck/transactions/${id}/mark-personal`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPersonal: !transaction.isPersonal }),
      });
      if (res.ok) {
        await fetchTransaction();
        alert('✓ Marcado como ' + (!transaction.isPersonal ? 'personal' : 'negocio'));
      }
    } catch (err) {
      alert('Error');
    }
  };

  const handleIgnore = async () => {
    try {
      const res = await fetch(`/api/bancocheck/transactions/${id}/ignore`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Ignorado manualmente' }),
      });
      if (res.ok) {
        alert('✓ Ignorado');
        router.back();
      }
    } catch (err) {
      alert('Error');
    }
  };

  if (loading) return <div className="p-8">Cargando...</div>;
  if (!transaction) return <div className="p-8">No encontrado</div>;

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Movimiento</h1>
        <button onClick={() => router.back()} className="text-blue-600">← Volver</button>
      </div>

      <div className="bg-white border rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Descripción</p>
            <p className="text-lg font-medium">{transaction.description}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Fecha</p>
            <p className="text-lg font-medium">{new Date(transaction.date).toLocaleDateString('es-MX')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Tipo</p>
            <p className="text-lg font-bold">{transaction.debit > 0 ? '📤 Débito' : '📥 Crédito'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Monto</p>
            <p className={`text-2xl font-bold ${transaction.credit > 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${Math.max(parseFloat(transaction.debit), parseFloat(transaction.credit))}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Estado</p>
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
              {transaction.status}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-600">Categoría</p>
            <p className="font-medium">{transaction.category || '—'}</p>
          </div>
        </div>

        {transaction.notes && (
          <div>
            <p className="text-sm text-gray-600">Notas</p>
            <p className="text-base">{transaction.notes}</p>
          </div>
        )}

        {transaction.matchedEntityType && (
          <div className="bg-green-50 border border-green-200 p-3 rounded">
            <p className="text-sm text-gray-600">Relacionado con</p>
            <p className="font-medium">✓ {transaction.matchedEntityType}: {transaction.matchedEntityId}</p>
            <p className="text-xs text-gray-500">Confianza: {transaction.confidence}%</p>
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="bg-white border rounded-lg p-6 space-y-3">
          <h2 className="font-bold text-lg">Sugerencias de matching</h2>
          {suggestions.map((s: any) => (
            <div
              key={s.id}
              className="p-3 bg-gray-50 border rounded cursor-pointer hover:bg-gray-100"
              onClick={() => {
                setMatchForm({
                  entityType: s.entityType,
                  entityId: s.entityId,
                  confidence: s.confidence,
                });
                setShowMatchModal(true);
              }}
            >
              <p className="font-medium">{s.entityType}: {s.entityId}</p>
              <p className="text-sm text-gray-600">{s.reason} ({s.confidence}%)</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setShowClassifyModal(true)}
          className="w-full bg-blue-600 text-white px-4 py-3 rounded font-medium hover:bg-blue-700"
        >
          📝 Clasificar
        </button>
        <button
          onClick={() => setShowMatchModal(true)}
          className="w-full bg-green-600 text-white px-4 py-3 rounded font-medium hover:bg-green-700"
        >
          🔗 Relacionar
        </button>
        <button
          onClick={handleMarkPersonal}
          className={`w-full px-4 py-3 rounded font-medium ${
            transaction.isPersonal
              ? 'bg-gray-600 text-white hover:bg-gray-700'
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
          }`}
        >
          {transaction.isPersonal ? '✓ Personal' : '👤 Marcar personal'}
        </button>
        <button
          onClick={handleIgnore}
          className="w-full bg-red-600 text-white px-4 py-3 rounded font-medium hover:bg-red-700"
        >
          🚫 Ignorar
        </button>
      </div>

      {showClassifyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-bold">Clasificar transacción</h2>
            <form onSubmit={handleClassify} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Estado</label>
                <select
                  value={classifyForm.status}
                  onChange={(e) => setClassifyForm({ ...classifyForm, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                >
                  <option value="">-- Selecciona --</option>
                  <option value="NEW">NEW</option>
                  <option value="EXPLAINED">EXPLAINED</option>
                  <option value="NEEDS_RECEIPT">NEEDS_RECEIPT</option>
                  <option value="NEEDS_INVOICE">NEEDS_INVOICE</option>
                  <option value="PERSONAL">PERSONAL</option>
                  <option value="IGNORED">IGNORED</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Categoría</label>
                <input
                  type="text"
                  value={classifyForm.category}
                  onChange={(e) => setClassifyForm({ ...classifyForm, category: e.target.value })}
                  placeholder="ej: gasto_negocio"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Notas</label>
                <textarea
                  value={classifyForm.notes}
                  onChange={(e) => setClassifyForm({ ...classifyForm, notes: e.target.value })}
                  maxLength={500}
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setShowClassifyModal(false)}
                  className="flex-1 bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-bold">Relacionar transacción</h2>
            <form onSubmit={handleMatch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tipo de entidad</label>
                <select
                  value={matchForm.entityType}
                  onChange={(e) => setMatchForm({ ...matchForm, entityType: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                >
                  <option value="">-- Selecciona --</option>
                  <option value="invoice">Factura</option>
                  <option value="expense">Gasto</option>
                  <option value="collection">Cobro</option>
                  <option value="payment">Pago</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">ID de la entidad</label>
                <input
                  type="text"
                  value={matchForm.entityId}
                  onChange={(e) => setMatchForm({ ...matchForm, entityId: e.target.value })}
                  placeholder="ej: inv_123"
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Confianza: {matchForm.confidence}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={matchForm.confidence}
                  onChange={(e) => setMatchForm({ ...matchForm, confidence: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Relacionar
                </button>
                <button
                  type="button"
                  onClick={() => setShowMatchModal(false)}
                  className="flex-1 bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
