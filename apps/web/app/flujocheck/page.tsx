import { createClient } from '@supabase/supabase-js';
import { FlujoCheckProyeccion } from '@/components/FlujoCheckProyeccion';
import { DashboardConsolidado } from '@/components/DashboardConsolidado';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default async function FlujoCheckPage() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div>No autorizado</div>;
  }

  const { data: empresa } = await supabase
    .from('empresa_usuarios')
    .select('empresa_id')
    .eq('usuario_id', user.id)
    .single();

  if (!empresa) {
    return <div>No tienes empresa asignada</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-4xl font-bold mb-2">📈 FlujoCheck - Proyección de Efectivo</h1>
      <p className="text-gray-600 mb-8">Predice tu saldo para los próximos 30 días basado en gastos históricos y cobros pendientes</p>

      {/* Dashboard consolidado */}
      <div className="mb-8">
        <DashboardConsolidado empresaId={empresa.empresa_id} />
      </div>

      {/* Proyección principal */}
      <div className="p-4 bg-white border border-gray-200 rounded-lg">
        <FlujoCheckProyeccion empresaId={empresa.empresa_id} />
      </div>

      {/* Info & Tips */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-bold text-blue-900 mb-2">💡 ¿Cómo funciona?</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✅ Analiza últimos 30 días de gastos</li>
            <li>✅ Calcula promedio diario de egresos</li>
            <li>✅ Incluye facturas pendientes como ingresos</li>
            <li>✅ Proyecta saldo día a día</li>
            <li>✅ Detecta días críticos (saldo bajo)</li>
          </ul>
        </div>

        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-bold text-green-900 mb-2">✅ Beneficios</h3>
          <ul className="text-sm text-green-800 space-y-1">
            <li>🎯 Planifica con anticipación</li>
            <li>📍 Evita insolvencia</li>
            <li>💰 Toma decisiones informadas</li>
            <li>⚡ Optimiza cobros y gastos</li>
            <li>📊 Visibilidad total del futuro</li>
          </ul>
        </div>
      </div>

      {/* Metodología */}
      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="font-bold text-gray-900 mb-2">🔧 Metodología</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="font-semibold text-gray-800">1️⃣ Saldo Actual</div>
            <p className="text-gray-600 text-xs mt-1">
              Se calcula como suma de todos los ingresos menos egresos registrados hasta hoy.
            </p>
          </div>
          <div>
            <div className="font-semibold text-gray-800">2️⃣ Promedio Gasto</div>
            <p className="text-gray-600 text-xs mt-1">
              Se obtiene del promedio diario de gastos de los últimos 30 días (GastoCheck).
            </p>
          </div>
          <div>
            <div className="font-semibold text-gray-800">3️⃣ Cobros Pendientes</div>
            <p className="text-gray-600 text-xs mt-1">
              Se incluyen facturas pendientes de CobraCheck que vencen en los próximos 30 días.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
