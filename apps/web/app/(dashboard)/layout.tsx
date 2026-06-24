'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import { supabase, getSessionUser, getHomeRoute, type SessionUser } from '../../lib/supabase';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [noMembership, setNoMembership] = useState(false);

  useEffect(() => {
    (async () => {
      // 1. ¿Hay sesión? Si no, a login.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      // 2. Hay sesión: resolver empresa/rol. Si no tiene membresía activa,
      //    NO rebotar a login (eso causaba un loop sin mensaje). Mostrar aviso.
      const u = await getSessionUser();
      if (!u) {
        setNoMembership(true);
      } else {
        setUser(u);
      }
      setLoading(false);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/login');
    });
    return () => subscription.unsubscribe();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (noMembership) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Sin empresa asignada</h2>
          <p className="text-sm text-slate-500">
            Tu cuenta inició sesión correctamente, pero no pertenece a ninguna empresa activa.
            Pide a un administrador que te agregue, o usa una cuenta con acceso.
          </p>
          <button
            onClick={handleLogout}
            className="w-full py-2.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} userName={user.full_name} onLogout={handleLogout} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
