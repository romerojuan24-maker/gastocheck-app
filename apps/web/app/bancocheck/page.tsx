import { createClient } from '@supabase/supabase-js';
import { BancoCheckConectar } from '@/components/BancoCheckConectar';
import { BancoCheckMovimientos } from '@/components/BancoCheckMovimientos';
import { BancoCheckFlujo } from '@/components/BancoCheckFlujo';
import { DashboardConsolidado } from '@/components/DashboardConsolidado';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default async function BancoCheckPage() {
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

  // Obtener cuentas bancarias conectadas
  const { data: cuentas } = await supabase
    .from('banco_cuentas')
    .select('*')
    .eq('empresa_id', empresa.empresa_id);

  const cuenta_principal = cuentas?.[0];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-4xl font-bold mb-8">🏦 BancoCheck - Reconciliación Automática</h1>

      {/* Dashboard consolidado */}
      <div className="mb-8">
        <DashboardConsolidado empresaId={empresa.empresa_id} />
      </div>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Columna izquierda: Conectar banco */}
        <div className="lg:col-span-1">
          <BancoCheckConectar empresaId={empresa.empresa_id} />
        </div>

        {/* Columna derecha: Movimientos + Flujo */}
        <div className="lg:col-span-2 space-y-8">
          {cuenta_principal ? (
            <>
              <BancoCheckMovimientos empresaId={empresa.empresa_id} bancoCuentaId={cuenta_principal.id} />
              <BancoCheckFlujo empresaId={empresa.empresa_id} />
            </>
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-300 text-yellow-700 rounded-lg">
              ⚠️ Conecta una cuenta bancaria para ver movimientos y flujo de efectivo
            </div>
          )}
        </div>
      </div>

      {/* Información */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-bold text-blue-900 mb-2">💡 ¿Cómo funciona BancoCheck?</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✅ Conecta tu banco con Plaid (seguro)</li>
          <li>✅ Los movimientos se sincronizan automáticamente</li>
          <li>✅ Se reconcilian automáticamente con GastoCheck + CobraCheck</li>
          <li>✅ Ves tu flujo de efectivo en tiempo real</li>
          <li>✅ Alertas cuando saldo es bajo</li>
        </ul>
      </div>
    </div>
  );
}
