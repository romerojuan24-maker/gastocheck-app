'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { UserRole } from '../lib/supabase';

// Acceso completo solo para este email durante el desarrollo
const DEV_EMAIL = 'danielbenco1@gmail.com';
// Rutas visibles para todos los demás usuarios (solo GastoCheck)
const GASTOCHECK_ONLY_HREFS = ['/hoy', '/pendientes', '/gastocheck'];

interface NavItem {
  href:   string;
  label:  string;
  icon:   string;
  roles:  UserRole[];
}

const NAV: NavItem[] = [
  { href: '/hoy',           label: 'Hoy',           icon: '⚡', roles: ['owner', 'admin'] },
  { href: '/pendientes',    label: 'Pendientes',     icon: '📋', roles: ['owner', 'admin', 'accountant', 'supervisor'] },
  { href: '/gastocheck',    label: 'GastoCheck',     icon: '🧾', roles: ['owner', 'admin', 'accountant', 'supervisor', 'buyer', 'viewer'] },
  { href: '/cobracheck',    label: 'CobraCheck',     icon: '💰', roles: ['owner', 'admin', 'accountant', 'supervisor', 'collector', 'viewer'] },
  { href: '/clientes',      label: 'Clientes',       icon: '👥', roles: ['owner', 'admin', 'accountant', 'supervisor', 'collector'] },
  { href: '/bancocheck',    label: 'BancoCheck',     icon: '🏦', roles: ['owner', 'admin', 'accountant'] },
  { href: '/flujocheck',    label: 'FlujoCheck',     icon: '📈', roles: ['owner', 'admin', 'accountant'] },
  { href: '/facturacheck',  label: 'FacturaCheck',   icon: '📄', roles: ['owner', 'admin', 'accountant'] },
  { href: '/inventariocheck', label: 'Inventario',   icon: '📦', roles: ['owner', 'admin', 'supervisor'] },
  { href: '/advisor',       label: 'Advisor IA',     icon: '🤖', roles: ['owner', 'admin', 'accountant'] },
];

const ROLE_COLORS: Record<UserRole, string> = {
  owner:      'bg-violet-500',
  admin:      'bg-blue-500',
  accountant: 'bg-emerald-500',
  supervisor: 'bg-amber-500',
  buyer:      'bg-orange-500',
  collector:  'bg-teal-500',
  viewer:     'bg-slate-500',
};

const ROLE_LABELS: Record<UserRole, string> = {
  owner:      'Dueño',
  admin:      'Admin',
  accountant: 'Contador',
  supervisor: 'Supervisor',
  buyer:      'Comprador',
  collector:  'Cobrador',
  viewer:     'Visor',
};

interface Props {
  role:      UserRole;
  userName:  string | null;
  userEmail: string;
  onLogout:  () => void;
}

export default function Sidebar({ role, userName, userEmail, onLogout }: Props) {
  const path = usePathname();
  const isDevUser = userEmail === DEV_EMAIL;
  const visible = NAV.filter(n =>
    n.roles.includes(role) &&
    (isDevUser || GASTOCHECK_ONLY_HREFS.includes(n.href))
  );
  const initial = (userName ?? 'U').charAt(0).toUpperCase();
  const avatarColor = ROLE_COLORS[role] ?? 'bg-slate-500';

  return (
    <aside className="w-60 shrink-0 bg-slate-900 text-white flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="text-lg font-black tracking-tight">
          <span className="text-white">Check</span>
          <span className="text-emerald-400"> Suite</span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">Control total de tu negocio</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visible.map(item => {
          const active = path === item.href || (item.href !== '/hoy' && path.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer — usuario */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-800 transition-colors mb-2">
          <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{userName ?? 'Usuario'}</p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[role] ?? role}</p>
          </div>
        </div>
        <div className="flex items-center justify-between px-2">
          <Link href="/configuracion" className="text-xs text-slate-500 hover:text-emerald-400 transition-colors">
            ⚙ Configuración
          </Link>
          <button onClick={onLogout} className="text-xs text-slate-600 hover:text-red-400 transition-colors">
            Salir
          </button>
        </div>
      </div>
    </aside>
  );
}
