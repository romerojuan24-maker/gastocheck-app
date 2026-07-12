export interface InventoryProduct {
  id: string
  company_id: string
  name: string
  sku: string | null
  barcode: string | null
  category: string | null
  unit: string
  cost: number
  price: number
  stock_current: number
  stock_minimum: number
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface InventoryAlert {
  id: string
  company_id: string
  product_id: string
  message: string
  alert_type: string
  is_read: boolean
  created_at: string
}

export type InventoryMovementType =
  | 'IN' | 'OUT' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'WASTE' | 'RETURN_IN' | 'RETURN_OUT' | 'TRANSFER'

export interface InventoryMovement {
  id: string
  company_id: string
  product_id: string
  movement_type: InventoryMovementType
  quantity: number
  stock_before: number
  stock_after: number
  unit_cost: number | null
  notes: string | null
  reason: string | null
  source: string
  location_id: string | null
  to_location_id: string | null
  created_by: string | null
  created_at: string
}

export interface InventoryLocation {
  id: string
  company_id: string
  name: string
  type: string
  parent_id: string | null
  is_active: boolean
}
