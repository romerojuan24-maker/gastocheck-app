'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SuccessContent() {
  const params   = useSearchParams();
  const planCode = params.get('plan') ?? '';

  const tier = planCode.includes('STARTER')    ? 'Starter'
             : planCode.includes('PRO')        ? 'Pro'
             : planCode.includes('BUSINESS')   ? 'Business'
             : planCode.includes('ENTERPRISE') ? 'Enterprise'
             : 'tu plan';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-[#0F172A] mb-2">
          ¡Suscripción activada!
        </h1>
        <p className="text-gray-500 mb-2">
          Plan <strong>{tier}</strong> con 30 días de prueba gratuita.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          Abre la app en tu dispositivo — tu acceso ya está actualizado.
        </p>

        <div className="bg-[#F0FDF4] border border-[#00A650]/30 rounded-xl p-4 text-left mb-6">
          <h3 className="font-semibold text-[#00A650] mb-2 text-sm">Próximos pasos</h3>
          <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
            <li>Abre GastoCheck en tu celular</li>
            <li>El acceso premium está activo automáticamente</li>
            <li>Durante el trial no se realizará ningún cobro</li>
          </ol>
        </div>

        <a
          href="/precios"
          className="inline-block text-sm text-[#0F172A] underline"
        >
          Ver detalles de mi plan
        </a>
      </div>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
