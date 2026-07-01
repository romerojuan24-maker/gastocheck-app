import { createClient } from '@supabase/supabase-js';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anon);

export type UserRole =
  | 'owner'
  | 'admin'
  | 'accountant'
  | 'supervisor'
  | 'buyer'
  | 'collector'
  | 'viewer';

export interface SessionUser {
  id:         string;
  email:      string;
  full_name:  string | null;
  company_id: string;
  role:       UserRole;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: member } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', session.user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (!member) return null;

  // Perfil en query separada: no existe FK declarada company_members.user_id → profiles,
  // por lo que el embedded join de PostgREST devuelve 400 PGRST200.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', session.user.id)
    .maybeSingle();

  return {
    id:         session.user.id,
    email:      session.user.email ?? '',
    full_name:  profile?.full_name ?? null,
    company_id: member.company_id,
    role:       member.role as UserRole,
  };
}

export const FINANCIAL_ROLES: UserRole[] = ['owner', 'admin', 'accountant'];
export const MANAGER_ROLES:   UserRole[] = ['owner', 'admin', 'accountant', 'supervisor'];

export function canSeeFinancials(role: UserRole) {
  return FINANCIAL_ROLES.includes(role);
}
export function isManager(role: UserRole) {
  return MANAGER_ROLES.includes(role);
}
export function getHomeRoute(role: UserRole): string {
  if (role === 'owner' || role === 'admin') return '/hoy';
  // '/pendientes' consulta columnas que ya no existen (receipts.folio/amount/vendor_name,
  // advances.status/user_id) — quedó obsoleto. '/gastocheck/polizas' es la página real
  // de trabajo del contador (reembolsos pendientes + SAT + generar póliza).
  if (role === 'accountant' || role === 'supervisor') return '/gastocheck/polizas';
  if (role === 'collector') return '/cobracheck';
  return '/gastocheck';
}
