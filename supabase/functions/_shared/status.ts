// Vendored desde packages/shared/src/status.ts para el bundler Deno de Edge Functions.
// Evita el import cruzado a ../../../packages (que rompe el CLI en Windows por el
// './types' ambiguo archivo/directorio → EISDIR). Tipos inlineados como string:
// solo se usan para `.includes(...)`, sin cambio de comportamiento.
type ExpenseStatus = string;
type MemberRole = string;

export type ExpenseAction =
  | 'confirm'
  | 'authorize'
  | 'reject'
  | 'observe'
  | 'fix'
  | 'apply_invoice'
  | 'mark_duplicate'
  | 'close'
  | 'delete';

interface Transition {
  from: ExpenseStatus[];
  to: ExpenseStatus;
  roles: MemberRole[];
}

export const TRANSITIONS: Record<ExpenseAction, Transition> = {
  confirm:        { from: ['captured'],                             to: 'pending_auth',     roles: ['owner','supervisor','spender','office'] },
  authorize:      { from: ['pending_auth','observed'],              to: 'authorized',       roles: ['owner','supervisor'] },
  reject:         { from: ['pending_auth','observed','authorized'], to: 'rejected',         roles: ['owner','supervisor'] },
  observe:        { from: ['pending_auth','authorized'],            to: 'observed',         roles: ['owner','supervisor'] },
  fix:            { from: ['observed'],                             to: 'pending_auth',     roles: ['owner','supervisor','spender','office'] },
  apply_invoice:  { from: ['authorized','pending_invoice'],         to: 'invoice_applied',  roles: ['owner','supervisor','office'] },
  mark_duplicate: { from: ['captured','pending_auth','authorized'], to: 'duplicate',        roles: ['owner','supervisor','office'] },
  close:          { from: ['authorized','invoice_applied'],         to: 'closed_in_policy', roles: ['owner','supervisor'] },
  delete:         { from: ['captured','pending_auth','observed','rejected','duplicate'], to: 'deleted', roles: ['owner','supervisor','office'] },
};

export function canTransition(action: ExpenseAction, from: ExpenseStatus, role: MemberRole): boolean {
  const t = TRANSITIONS[action];
  return !!t && t.from.includes(from) && t.roles.includes(role);
}

export function nextStatus(action: ExpenseAction): ExpenseStatus {
  return TRANSITIONS[action].to;
}
