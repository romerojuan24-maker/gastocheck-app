import type { BatchStatus } from './types';

// ── Meta de estados ────────────────────────────────────────────────────────────

export const BATCH_STATUS_META: Record<BatchStatus, { label: string; color: string; icon: string }> = {
  draft:    { label: 'Borrador',  color: '#757575', icon: '📝' },
  open:     { label: 'Abierta',   color: '#1565C0', icon: '📂' },
  closed:   { label: 'Cerrada',   color: '#43A047', icon: '✅' },
  exported: { label: 'Exportada', color: '#7B1FA2', icon: '📤' },
  cancelled: { label: 'Anulada',   color: '#C62828', icon: '🚫' },
};

// ── Reglas de negocio ─────────────────────────────────────────────────────────

export function canAddReceiptToBatch(batchStatus: BatchStatus): boolean {
  return batchStatus === 'open' || batchStatus === 'draft';
}

export function canRemoveReceiptFromBatch(batchStatus: BatchStatus): boolean {
  return batchStatus === 'open' || batchStatus === 'draft';
}

export function canCloseBatch(batchStatus: BatchStatus, receiptCount: number): boolean {
  return (batchStatus === 'open' || batchStatus === 'draft') && receiptCount > 0;
}

export function canReopenBatch(batchStatus: BatchStatus): boolean {
  return batchStatus === 'closed';
}

export function canExportBatch(batchStatus: BatchStatus): boolean {
  return batchStatus === 'closed' || batchStatus === 'exported';
}

export function canVoidBatch(batchStatus: BatchStatus): boolean {
  return batchStatus === 'draft' || batchStatus === 'open';
}

// ── Resumen de totales ────────────────────────────────────────────────────────

export interface BatchSummary {
  receiptCount: number;
  subtotal:     number;
  tax:          number;
  total:        number;
  byCategory:   Record<string, number>;
  byEmployee:   Record<string, number>;
}

export function summarizeBatch(
  receipts: Array<{
    total_amount:     number | null;
    subtotal_amount?: number | null;
    tax_amount?:      number | null;
    category_name?:   string | null;
    employee_name?:   string | null;
  }>,
): BatchSummary {
  const s: BatchSummary = {
    receiptCount: receipts.length,
    subtotal: 0, tax: 0, total: 0,
    byCategory: {}, byEmployee: {},
  };
  for (const r of receipts) {
    const t = r.total_amount ?? 0;
    s.total    += t;
    s.subtotal += r.subtotal_amount ?? t;
    s.tax      += r.tax_amount      ?? 0;
    const cat = r.category_name ?? 'Sin categoría';
    const emp = r.employee_name ?? 'Sin asignar';
    s.byCategory[cat] = (s.byCategory[cat] ?? 0) + t;
    s.byEmployee[emp] = (s.byEmployee[emp] ?? 0) + t;
  }
  return s;
}

// ── Nombre sugerido para nueva relación ──────────────────────────────────────

export function suggestBatchName(periodStart: string, periodEnd: string, index = 1): string {
  const s = periodStart.slice(0, 7).replace('-', '/');
  const e = periodEnd.slice(0, 7).replace('-', '/');
  const seq = String(index).padStart(3, '0');
  return s === e ? `REL-${s}-${seq}` : `REL-${s}_${e}-${seq}`;
}
