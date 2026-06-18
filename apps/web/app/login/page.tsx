'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getHomeRoute, type UserRole } from '../../lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) { setError('Correo o contraseña incorrectos.'); return; }

      // Obtener rol para redirigir a la pantalla correcta
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError('Sin sesión.'); return; }

      const { data: member } = await supabase
        .from('company_members')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      const role = (member?.role ?? 'employee') as UserRole;
      router.replace(getHomeRoute(role));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black">
            <span className="text-slate-900">Check</span>
            <span className="text-emerald-500"> Suite</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">Controla tu negocio</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Correo</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="tu@empresa.com"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Contraseña</label>
            <input
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full py-3 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
