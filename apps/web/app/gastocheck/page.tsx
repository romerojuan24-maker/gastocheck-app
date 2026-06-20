import { createClient } from '@supabase/supabase-js';
import { GastoCheckForm } from '@/components/GastoCheckForm';
import { GastoCheckHistorial } from '@/components/GastoCheckHistorial';
import { DashboardConsolidado } from '@/components/DashboardConsolidado';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default async function GastoCheckPage() {
  // Obtener empresa_id del usuario (asumiendo que está en sesión)
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div>No autorizado</div>;
  }

  // Obtener empresa_id del usuario (relación con empresa_usuarios)
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Columna izquierda: Formulario */}
        <div className="lg:col-span-1">
          <GastoCheckForm empresaId={empresa.empresa_id} />
        </div>

        {/* Columna derecha: Dashboard + Historial */}
        <div className="lg:col-span-2 space-y-8">
          <DashboardConsolidado empresaId={empresa.empresa_id} />
          <GastoCheckHistorial empresaId={empresa.empresa_id} />
        </div>
      </div>
    </div>
  );
}
