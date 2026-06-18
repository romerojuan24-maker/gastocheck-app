'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionUser, getHomeRoute } from '../lib/supabase';

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    getSessionUser().then(u => {
      if (!u) { router.replace('/login'); return; }
      router.replace(getHomeRoute(u.role));
    });
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-2xl font-black text-slate-900 mb-2">
          Check<span className="text-emerald-500">Suite</span>
        </h1>
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mt-4" />
      </div>
    </div>
  );
}
