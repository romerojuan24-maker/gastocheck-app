'use client';

import { useState } from 'react';

export function BancoCheckConectar({ empresaId }: { empresaId: string }) {
  const [conectando, setConectando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleConectarBanco() {
    setConectando(true);
    setError(null);
    setSuccess(false);

    try {
      // Simulación: En producción, usar Plaid Link
      const metadata = {
        account: {
          id: 'CUENTA_PRINCIPAL',
          name: 'Cuenta Principal',
          type: 'CHEQUES',
        },
        institution: {
          institution_id: '110000000',
          name: 'Banamex',
        },
      };

      const response = await fetch('/api/bancocheck/conectar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaId,
          public_token: 'test_token_' + Date.now(),
          metadata,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setSuccess(true);
      alert(`✅ Banco conectado: ${data.banco_cuenta_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al conectar banco');
    } finally {
      setConectando(false);
    }
  }

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <h3 className="text-xl font-bold mb-4">🏦 Conectar Banco</h3>

      {error && <div className="p-3 mb-4 bg-red-100 text-red-700 rounded-md">{error}</div>}
      {success && (
        <div className="p-3 mb-4 bg-green-100 text-green-700 rounded-md">✅ Banco conectado correctamente</div>
      )}

      <p className="text-gray-600 text-sm mb-4">
        Conecta tu cuenta bancaria para sincronizar movimientos y reconciliar automáticamente.
      </p>

      <button
        onClick={handleConectarBanco}
        disabled={conectando}
        className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold"
      >
        {conectando ? '🔄 Conectando...' : '🔗 Conectar Cuenta Bancaria'}
      </button>

      <p className="text-xs text-gray-500 mt-2 text-center">Usamos Plaid para conectar de forma segura</p>
    </div>
  );
}
