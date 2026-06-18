import { createClient } from '@supabase/supabase-js';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anon);

export type UserRole =
  | 'owner'
  | 'admin'
  | 'accountant'
  | 'supervisor'
  | 'employee'
  | 'collector'
  | 'operator';

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
    .select('company_id, role, profiles:user_id(full_name)')
    .eq('user_id', session.user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (!member) return null;

  return {
    id:         session.user.id,
    email:      session.user.email ?? '',
    full_name:  (member.profiles as any)?.full_name ?? null,
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
  if (role === 'owner')                           return '/hoy';
  if (MANAGER_ROLES.includes(role))               return '/pendientes';
  return '/mis-tareas';
}
