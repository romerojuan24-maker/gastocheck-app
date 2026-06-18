'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { UserRole } from '../lib/supabase';

interface NavItem {
  href:   string;
  label:  string;
  icon:   string;
  roles:  UserRole[];
}

const NAV: NavItem[] = [
  // Dashboards primarios
  { href: '/hoy',          label: 'Hoy',           icon: '⚡', roles: ['owner'] },
  { href: '/pendientes',   label: 'Pendientes',     icon: '📋', roles: ['owner','admin','accountant','supervisor'] },
  { href: '/mis-tareas',   label: 'Mis tareas',     icon: '✅', roles: ['employee','collector','operator'] },
  // Módulos
  { href: '/gastocheck',   label: 'GastoCheck',     icon: '🧾', roles: ['owner','admin','accountant','supervisor','employee','operator'] },
  { href: '/cobracheck',   label: 'CobraCheck',     icon: '💰', roles: ['owner','admin','accountant','supervisor','collector'] },
  { href: '/bancocheck',   label: 'BancoCheck',     icon: '🏦', roles: ['owner','admin','accountant','supervisor','operator'] },
  { href: '/flujocheck',   label: 'FlujoCheck',     icon: '📈', roles: ['owner','admin','accountant'] },
  { href: '/facturacheck', label: 'FacturaCheck',   icon: '📄', roles: ['owner','admin','accountant','supervisor','operator'] },
  { href: '/inventariocheck', label: 'Inventario',  icon: '📦', roles: ['owner','admin','supervisor','operator'] },
  { href: '/advisor',      label: 'Advisor IA',     icon: '🤖', roles: ['owner','admin','accountant'] },
];

interface Props {
  role:      UserRole;
  userName:  string | null;
  onLogout:  () => void;
}

export default function Sidebar({ role, userName, onLogout }: Props) {
  const path = usePathname();

  const visible = NAV.filter(n => n.roles.includes(role));

  return (
    <aside className="w-64 shrink-0 bg-slate-900 text-white flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-700">
        <div className="text-lg font-black tracking-tight">
          <span className="text-white">Check</span>
          <span className="text-emerald-400"> Suite</span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">Control total de tu negocio</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visible.map(item => {
          const active = path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-700">
        <p className="text-xs text-slate-400 truncate mb-1">{userName ?? 'Usuario'}</p>
        <p className="text-xs text-slate-500 capitalize mb-3">{role}</p>
        <Link
          href="/configuracion"
          className="block text-xs text-slate-400 hover:text-white mb-2"
        >
          ⚙ Configuración
        </Link>
        <button
          onClick={onLogout}
          className="text-xs text-slate-500 hover:text-red-400 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
