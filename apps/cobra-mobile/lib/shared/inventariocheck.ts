// ── InventarioCheck — tipos compartidos ──────────────────────────────────────

export type InventoryMovementType = 'in' | 'out' | 'adjust' | 'loss' | 'return' | 'transfer';

export type InventoryAlertType = 'low_stock' | 'out_of_stock' | 'no_movement' | 'restock_suggested';

export interface InventoryProduct {
  id:            string;
  company_id:    string;
  name:          string;
  sku:           string | null;
  barcode:       string | null;
  category:      string | null;
  unit:          string;
  cost:          number;
  price:         number;
  stock_current: number;
  stock_minimum: number;
  photo_url:     string | null;
  is_active:     boolean;
  notes:         string | null;
  created_at:    string;
  updated_at:    string;
}

export interface InventoryMovement {
  id:            string;
  company_id:    string;
  product_id:    string;
  movement_type: InventoryMovementType;
  quantity:      number;
  stock_before:  number;
  stock_after:   number;
  unit_cost:     number | null;
  notes:         string | null;
  source:        string;
  source_id:     string | null;
  created_by:    string | null;
  created_at:    string;
}

export interface InventoryAlert {
  id:          string;
  company_id:  string;
  product_id:  string;
  alert_type:  InventoryAlertType;
  message:     string;
  is_read:     boolean;
  created_at:  string;
}

export const INVENTORY_MOVEMENT_META: Record<InventoryMovementType, {
  label: string; color: string; sign: '+' | '-' | '~';
}> = {
  in:       { label: 'Entrada',       color: '#43A047', sign: '+' },
  out:      { label: 'Salida',        color: '#E53935', sign: '-' },
  adjust:   { label: 'Ajuste',        color: '#1565C0', sign: '~' },
  loss:     { label: 'Merma',         color: '#FB8C00', sign: '-' },
  return:   { label: 'Devolución',    color: '#7B1FA2', sign: '+' },
  transfer: { label: 'Transferencia', color: '#90A4AE', sign: '~' },
};

export const INVENTORY_ALERT_META: Record<InventoryAlertType, {
  label: string; color: string; icon: string;
}> = {
  low_stock:          { label: 'Stock bajo',           color: '#FB8C00', icon: '⚠' },
  out_of_stock:       { label: 'Agotado',              color: '#E53935', icon: '🔴' },
  no_movement:        { label: 'Sin movimiento',       color: '#90A4AE', icon: '💤' },
  restock_suggested:  { label: 'Reponer pronto',       color: '#1565C0', icon: '📦' },
};

export const UNIT_LABELS: Record<string, string> = {
  pza:   'Pieza',
  kg:    'Kilogramo',
  lt:    'Litro',
  caja:  'Caja',
  metro: 'Metro',
  par:   'Par',
  rollo: 'Rollo',
  saco:  'Saco',
  ton:   'Tonelada',
};

export function getStockStatus(product: InventoryProduct): {
  status: 'ok' | 'low' | 'out'; color: string; label: string;
} {
  if (product.stock_current <= 0)
    return { status: 'out', color: '#E53935', label: 'Agotado' };
  if (product.stock_current <= product.stock_minimum)
    return { status: 'low', color: '#FB8C00', label: 'Stock bajo' };
  return { status: 'ok', color: '#43A047', label: 'En stock' };
}
