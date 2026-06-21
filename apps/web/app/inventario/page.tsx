import { createClient } from '@supabase/supabase-js';
import { InventarioOperario } from '@/components/InventarioOperario';
import { InventarioDashboard } from '@/components/InventarioDashboard';
import { DashboardConsolidado } from '@/components/DashboardConsolidado';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default async function InventarioPage() {
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
      <h1 className="text-4xl font-bold mb-2">📦 Inventarios - Gestión de Stock</h1>
      <p className="text-gray-600 mb-8">
        Rastreo automático de inventario, órdenes inteligentes y alertas de stock bajo
      </p>

      {/* Dashboard consolidado */}
      <div className="mb-8">
        <DashboardConsolidado empresaId={empresa.empresa_id} />
      </div>

      {/* Contenido principal - 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Columna izquierda: Operario */}
        <div className="lg:col-span-1">
          <InventarioOperario empresaId={empresa.empresa_id} />
        </div>

        {/* Columna derecha: Dashboard Supervisor */}
        <div className="lg:col-span-2">
          <InventarioDashboard empresaId={empresa.empresa_id} />
        </div>
      </div>

      {/* Información general */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-bold text-green-900 mb-2">👷 Para Operarios</h3>
          <ul className="text-sm text-green-800 space-y-1">
            <li>✅ Registra entrada de stock</li>
            <li>✅ Registra salida de stock</li>
            <li>✅ Ve alertas de stock bajo</li>
            <li>✅ Foto OCR para artículos</li>
          </ul>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-bold text-blue-900 mb-2">📊 Para Supervisores</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✅ Dashboard de stock en tiempo real</li>
            <li>✅ Órdenes automáticas generadas</li>
            <li>✅ Historial de movimientos</li>
            <li>✅ Alertas de reorden</li>
          </ul>
        </div>

        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h3 className="font-bold text-purple-900 mb-2">⚙️ Automatizaciones</h3>
          <ul className="text-sm text-purple-800 space-y-1">
            <li>✅ Órdenes automáticas cuando stock bajo</li>
            <li>✅ Alertas a supervisor</li>
            <li>✅ Cálculo automático de disponibilidad</li>
            <li>✅ Historial completo rastreable</li>
          </ul>
        </div>
      </div>

      {/* Flujo de trabajo */}
      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="font-bold text-yellow-900 mb-3">🔄 Flujo de Trabajo</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-center text-sm">
          <div className="p-3 bg-white rounded border-2 border-yellow-300">
            <div className="font-bold text-yellow-900">1️⃣ Operario</div>
            <p className="text-xs text-gray-600">Registra entrada/salida</p>
          </div>
          <div className="text-3xl flex items-center justify-center text-yellow-500">→</div>
          <div className="p-3 bg-white rounded border-2 border-yellow-300">
            <div className="font-bold text-yellow-900">2️⃣ Sistema</div>
            <p className="text-xs text-gray-600">Actualiza stock</p>
          </div>
          <div className="text-3xl flex items-center justify-center text-yellow-500">→</div>
          <div className="p-3 bg-white rounded border-2 border-yellow-300">
            <div className="font-bold text-yellow-900">3️⃣ Supervisor</div>
            <p className="text-xs text-gray-600">Ve dashboard + órdenes</p>
          </div>
        </div>
      </div>

      {/* Ejemplo de uso */}
      <div className="mt-8 p-4 bg-indigo-50 border border-indigo-300 rounded-lg">
        <h3 className="font-bold text-indigo-900 mb-3">📚 Ejemplo de Uso</h3>
        <div className="space-y-2 text-sm text-indigo-800">
          <p>
            <strong>Caso 1 - Entrada de Stock:</strong> Operario recibe 20 litros de Aceite Motor.
            Registra en app → Sistema actualiza a 45L → Stock está OK ✅
          </p>
          <p>
            <strong>Caso 2 - Salida de Stock:</strong> Operario usa 5 Filtros de Aire.
            Registra en app → Sistema actualiza a 7L → Stock está BAJO ⚠️ → Supervisor ve alerta
          </p>
          <p>
            <strong>Caso 3 - Orden Automática:</strong> Stock de Bujías cae a 3 (mínimo: 8).
            Sistema detecta → Orden automática generada → Se notifica al supervisor
          </p>
        </div>
      </div>
    </div>
  );
}
