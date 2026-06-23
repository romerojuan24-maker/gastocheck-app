// GastoCheck — Máquina de estados de gasto + permisos de transición
import type { ExpenseStatus, MemberRole } from './types';

export type ExpenseAction =
  | 'confirm'        // captured -> pending_auth
  | 'authorize'      // pending_auth -> authorized
  | 'reject'         // -> rejected
  | 'observe'        // -> observed
  | 'fix'            // observed -> pending_auth
  | 'apply_invoice'  // authorized -> invoice_applied
  | 'mark_duplicate' // -> duplicate
  | 'close'          // authorized/invoice_applied -> closed_in_policy
  | 'delete';        // -> deleted

interface Transition {
  from: ExpenseStatus[];
  to: ExpenseStatus;
  roles: MemberRole[];
}

export const TRANSITIONS: Record<ExpenseAction, Transition> = {
  confirm:        { from: ['captured'],                           to: 'pending_auth',    roles: ['owner','supervisor','spender','office'] },
  authorize:      { from: ['pending_auth','observed'],            to: 'authorized',      roles: ['owner','supervisor'] },
  reject:         { from: ['pending_auth','observed','authorized'], to: 'rejected',      roles: ['owner','supervisor'] },
  observe:        { from: ['pending_auth','authorized'],          to: 'observed',        roles: ['owner','supervisor'] },
  fix:            { from: ['observed'],                           to: 'pending_auth',    roles: ['owner','supervisor','spender','office'] },
  apply_invoice:  { from: ['authorized','pending_invoice'],       to: 'invoice_applied', roles: ['owner','supervisor','office'] },
  mark_duplicate: { from: ['captured','pending_auth','authorized'], to: 'duplicate',     roles: ['owner','supervisor','office'] },
  close:          { from: ['authorized','invoice_applied'],       to: 'closed_in_policy',roles: ['owner','supervisor'] },
  delete:         { from: ['captured','pending_auth','observed','rejected','duplicate'], to: 'deleted', roles: ['owner','supervisor','office'] },
};

export function canTransition(action: ExpenseAction, from: ExpenseStatus, role: MemberRole): boolean {
  const t = TRANSITIONS[action];
  return !!t && t.from.includes(from) && t.roles.includes(role);
}

export function nextStatus(action: ExpenseAction): ExpenseStatus {
  return TRANSITIONS[action].to;
}

// Metadatos de UI por estatus (color de marca + etiqueta)
export const STATUS_META: Record<ExpenseStatus, { label: string; color: string }> = {
  captured:         { label: 'Capturado',            color: '#90A4AE' },
  pending_auth:     { label: 'Pendiente de autorizar', color: '#FF9800' },
  authorized:       { label: 'Autorizado',           color: '#43A047' },
  pending_invoice:  { label: 'Pendiente de factura', color: '#FB8C00' },
  invoice_applied:  { label: 'Factura aplicada',     color: '#2E7D32' },
  observed:         { label: 'Observado',            color: '#FFB300' },
  rejected:         { label: 'Rechazado',            color: '#E53935' },
  deleted:          { label: 'Eliminado',            color: '#B0BEC5' },
  duplicate:        { label: 'Duplicado',            color: '#8E24AA' },
  closed_in_policy: { label: 'Cerrado en póliza',    color: '#1565C0' },
};
