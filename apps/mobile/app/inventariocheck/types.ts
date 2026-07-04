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
