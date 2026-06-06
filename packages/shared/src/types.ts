// GastoCheck — Tipos de dominio compartidos (web + móvil)

export type MemberRole = 'owner' | 'supervisor' | 'spender' | 'office' | 'accountant';
export type CompanyPlan = 'basico' | 'equipo' | 'empresa' | 'corporativo';
export type PolicyStatus = 'open' | 'closed';
export type AdvanceMethod = 'transfer' | 'cash' | 'card' | 'other';
export type AttachmentKind = 'ticket' | 'pdf' | 'xml' | 'payment' | 'receipt';
export type CostCenterType =
  | 'obra' | 'ruta' | 'proyecto' | 'lote' | 'cliente' | 'unidad' | 'sucursal' | 'otro';

export type ExpenseStatus =
  | 'captured'
  | 'pending_auth'
  | 'authorized'
  | 'pending_invoice'
  | 'invoice_applied'
  | 'observed'
  | 'rejected'
  | 'deleted'
  | 'duplicate'
  | 'closed_in_policy';

export interface Company {
  id: string;
  name: string;
  rfc: string | null;
  plan: CompanyPlan;
  plan_seats: number;
  allow_supervisor_close: boolean;
}

export interface Policy {
  id: string;
  company_id: string;
  holder_id: string;
  name: string;
  period_start: string | null;
  period_end: string | null;
  opening_balance: number;
  closing_balance: number | null;
  status: PolicyStatus;
  previous_policy_id: string | null;
  closed_at: string | null;
}

export interface Advance {
  id: string;
  policy_id: string;
  amount: number;
  method: AdvanceMethod;
  reference: string | null;
  date: string;
}

export interface Expense {
  id: string;
  company_id: string;
  policy_id: string;
  spender_id: string;
  category_id: string | null;
  cost_center_id: string | null;
  provider_name: string | null;
  provider_rfc: string | null;
  subtotal: number | null;
  iva: number | null;
  total: number;
  expense_date: string | null;
  status: ExpenseStatus;
  notes: string | null;
  authorized_by: string | null;
  authorized_at: string | null;
}

export interface CfdiData {
  expense_id: string;
  uuid: string;
  rfc_emisor: string;
  rfc_receptor: string;
  subtotal: number;
  iva: number;
  total: number;
  fecha: string;
  metodo_pago: string;
  forma_pago: string;
  conceptos: { descripcion: string; importe: number; cantidad?: number }[];
}

export interface PolicyBalance {
  opening: number;
  advances: number;
  authorizedSpent: number;
  available: number;     // saldo disponible
  pendingToVerify: number; // por comprobar
}
