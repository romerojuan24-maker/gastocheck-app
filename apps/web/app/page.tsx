'use client';

import { computeBalance, STATUS_META, type Expense } from '@gastocheck/shared';
import { Logo } from '../components/Logo';

// ---- Datos demo (se reemplazan por consultas a Supabase con RLS) ----
const demoExpenses: Pick<Expense, 'id' | 'provider_name' | 'total' | 'status' | 'spender_id'>[] = [
  { id: '1', provider_name: 'Gasolinera Pemex', total: 850, status: 'pending_auth', spender_id: 'Juan (chofer)' },
  { id: '2', provider_name: 'Ferretería La Obra', total: 1240, status: 'pending_auth', spender_id: 'Luis (residente)' },
  { id: '3', provider_name: 'Restaurante El Paso', total: 430, status: 'authorized', spender_id: 'Juan (chofer)' },
  { id: '4', provider_name: 'AutoZone', total: 2100, status: 'authorized', spender_id: 'Marco (técnico)' },
  { id: '5', provider_name: 'OXXO', total: 95, status: 'rejected', spender_id: 'Luis (residente)' },
];

const balance = computeBalance(
  { opening_balance: 5000 },
  [{ amount: 10000 }],
  demoExpenses.map((e) => ({ total: e.total, status: e.status })),
);

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold" style={{ color: accent ?? '#0D1B2A' }}>
        {value}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-8 flex items-center gap-3">
        <Logo />
        <div>
          <h1 className="text-2xl font-bold">GastoCheck</h1>
          <p className="text-sm text-gray-500">Tus gastos claros. Tus saldos bajo control.</p>
        </div>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Anticipos entregados" value={money(balance.advances)} accent="#1565C0" />
        <Kpi label="Gastos autorizados" value={money(balance.authorizedSpent)} accent="#43A047" />
        <Kpi label="Por comprobar" value={money(balance.pendingToVerify)} accent="#FF9800" />
        <Kpi label="Saldo disponible" value={money(balance.available)} accent="#0D1B2A" />
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Autorizaciones pendientes</h2>
        <div className="divide-y">
          {demoExpenses.map((e) => {
            const meta = STATUS_META[e.status];
            return (
              <div key={e.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">{e.provider_name}</div>
                  <div className="text-sm text-gray-500">{e.spender_id}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold">{money(e.total)}</span>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-medium text-white"
                    style={{ backgroundColor: meta.color }}
                  >
                    {meta.label}
                  </span>
                  {e.status === 'pending_auth' && (
                    <div className="flex gap-2">
                      <button className="rounded-lg bg-check px-3 py-1 text-sm font-medium text-white">
                        ✓ Autorizar
                      </button>
                      <button className="rounded-lg bg-reject px-3 py-1 text-sm font-medium text-white">
                        ✕ Rechazar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="mt-8 text-center text-sm text-gray-400">
        Demo del dashboard · datos de ejemplo · conecta Supabase en <code>.env</code>
      </footer>
    </main>
  );
}
