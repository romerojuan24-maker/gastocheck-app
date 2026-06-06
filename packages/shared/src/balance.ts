// GastoCheck — Lógica de saldos de póliza
import type { Advance, Expense, Policy, PolicyBalance } from './types';

// Estatus que descuentan saldo real
const SPENT_STATUSES = new Set(['authorized', 'invoice_applied', 'closed_in_policy']);
// Estatus que aún están "por comprobar"
const PENDING_STATUSES = new Set(['captured', 'pending_auth', 'observed']);

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * Calcula el saldo de una póliza.
 *   disponible = saldo_inicial + Σ anticipos − Σ gastos autorizados
 *   por_comprobar = Σ gastos pendientes
 */
export function computeBalance(
  policy: Pick<Policy, 'opening_balance'>,
  advances: Pick<Advance, 'amount'>[],
  expenses: Pick<Expense, 'total' | 'status'>[],
): PolicyBalance {
  const advancesTotal = sum(advances.map((a) => a.amount));
  const authorizedSpent = sum(
    expenses.filter((e) => SPENT_STATUSES.has(e.status)).map((e) => e.total),
  );
  const pendingToVerify = sum(
    expenses.filter((e) => PENDING_STATUSES.has(e.status)).map((e) => e.total),
  );
  const opening = policy.opening_balance ?? 0;
  return {
    opening,
    advances: advancesTotal,
    authorizedSpent,
    available: opening + advancesTotal - authorizedSpent,
    pendingToVerify,
  };
}

/**
 * Saldo de cierre = saldo disponible al momento de cerrar.
 * La nueva póliza encadenada arranca con este valor como opening_balance.
 */
export function closingBalance(balance: PolicyBalance): number {
  return balance.available;
}
