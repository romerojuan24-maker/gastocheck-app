'use client';

export default function BillingCancelPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="text-6xl mb-4">↩️</div>
        <h1 className="text-2xl font-bold text-[#0F172A] mb-2">
          Pago cancelado
        </h1>
        <p className="text-gray-500 mb-8">
          No se realizó ningún cargo. Puedes intentarlo de nuevo cuando quieras.
        </p>

        <a
          href="/precios"
          className="inline-block bg-[#0F172A] text-white px-8 py-3 rounded-xl font-semibold hover:opacity-80 transition-opacity"
        >
          Ver planes
        </a>
      </div>
    </div>
  );
}
