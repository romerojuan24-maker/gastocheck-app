// ── FlujoCheck — tipos compartidos ───────────────────────────────────────────

export type CashFlowItemType =
  | 'income'
  | 'expense'
  | 'invoice_receivable'
  | 'pending_advance'
  | 'inventory_restock'
  | 'other';

export type CashFlowItemStatus =
  | 'pending'
  | 'paid'
  | 'collected'
  | 'at_risk'
  | 'overdue'
  | 'cancelled';

export type CashFlowRiskLevel = 'green' | 'yellow' | 'red';

export interface CashFlowItem {
  id:           string;
  company_id:   string;
  item_type:    CashFlowItemType;
  description:  string;
  expected_date: string;
  amount:       number;
  direction:    'in' | 'out';
  status:       CashFlowItemStatus;
  source:       string;
  source_id:    string | null;
  is_scenario:  boolean;
  scenario_id:  string | null;
  notes:        string | null;
  created_at:   string;
  updated_at:   string;
}

export interface CashFlowScenario {
  id:                string;
  company_id:        string;
  name:              string;
  description:       string | null;
  base_snapshot:     unknown;
  adjustments:       unknown;
  projected_balance: number | null;
  risk_level:        CashFlowRiskLevel;
  created_by:        string | null;
  created_at:        string;
  updated_at:        string;
}

export interface CashFlowDashboard {
  current_balance:      number;
  expected_income_7d:   number;
  expected_income_30d:  number;
  expected_expense_7d:  number;
  expected_expense_30d: number;
  projected_balance_7d: number;
  projected_balance_30d: number;
  risk_level:           CashFlowRiskLevel;
  overdue_receivables:  number;
  items_at_risk:        number;
}

export const CASH_FLOW_RISK_META: Record<CashFlowRiskLevel, {
  label: string; color: string; message: string;
}> = {
  green:  { label: 'Flujo positivo',    color: '#43A047', message: 'Te alcanza' },
  yellow: { label: 'Flujo ajustado',    color: '#FB8C00', message: 'Cuidado con los plazos' },
  red:    { label: 'Riesgo de déficit', color: '#E53935', message: 'No te va a alcanzar' },
};

export const CASH_FLOW_STATUS_META: Record<CashFlowItemStatus, { label: string; color: string }> = {
  pending:   { label: 'Pendiente',  color: '#90A4AE' },
  paid:      { label: 'Pagado',     color: '#43A047' },
  collected: { label: 'Cobrado',    color: '#43A047' },
  at_risk:   { label: 'En riesgo',  color: '#FB8C00' },
  overdue:   { label: 'Vencido',    color: '#E53935' },
  cancelled: { label: 'Cancelado',  color: '#B0BEC5' },
};

export function projectCashFlow(
  currentBalance: number,
  items: CashFlowItem[],
  horizonDays: number,
): { balance: number; risk: CashFlowRiskLevel } {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + horizonDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const relevant = items.filter(
    i => i.expected_date <= cutoffStr && i.status !== 'cancelled',
  );

  const income  = relevant.filter(i => i.direction === 'in').reduce((s, i) => s + i.amount, 0);
  const expense = relevant.filter(i => i.direction === 'out').reduce((s, i) => s + i.amount, 0);
  const balance = currentBalance + income - expense;

  const risk: CashFlowRiskLevel =
    balance < 0              ? 'red'
    : balance < expense * 0.2 ? 'yellow'
    : 'green';

  return { balance, risk };
}
