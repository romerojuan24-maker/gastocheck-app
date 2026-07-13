import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import type { InventoryProduct, InventoryAlert, InventoryMovement, InventoryMovementType } from '../types'

export function useInventarioProducts(companyId: string) {
  const [products, setProducts] = useState<InventoryProduct[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('inventory_products')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name')
      setProducts((data ?? []) as InventoryProduct[])
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    load()
  }, [load])

  return { products, loading, refetch: load }
}

export function useInventarioAlerts(companyId: string) {
  const [alerts, setAlerts] = useState<InventoryAlert[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('inventory_alerts')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_read', false)
      setAlerts((data ?? []) as InventoryAlert[])
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    load()
  }, [load])

  return { alerts, loading, refetch: load }
}

// ============================================================================
// Movimientos — historial (join manual con productos, sin FK embed porque
// company_members/profiles ya mostró que PostgREST no siempre resuelve
// joins implícitos entre estas tablas).
// ============================================================================

export function useInventarioMovements(companyId: string) {
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const { data: moves } = await supabase
        .from('inventory_movements')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(200)

      const list = (moves ?? []) as InventoryMovement[]
      setMovements(list)

      const productIds = Array.from(new Set(list.map(m => m.product_id)))
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('inventory_products').select('id, name').in('id', productIds)
        setProductNames(Object.fromEntries((products ?? []).map((p: any) => [p.id, p.name])))
      }
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    load()
  }, [load])

  return { movements, productNames, loading, refetch: load }
}

// ============================================================================
// Movimiento rápido — RPC ACID (inventory_quick_movement). idempotencyKey
// evita duplicar por doble tap: se genera una vez por apertura del sheet,
// no en cada intento de guardar.
// ============================================================================

export function useInventarioQuickMove() {
  const [saving, setSaving] = useState(false)

  const quickMove = async (
    productId: string,
    movementType: InventoryMovementType,
    quantity: number,
    reason: string | null,
    notes: string | null,
    idempotencyKey: string,
  ) => {
    setSaving(true)
    try {
      const { error } = await supabase.rpc('inventory_quick_movement', {
        p_product_id: productId, p_movement_type: movementType, p_quantity: quantity,
        p_reason: reason, p_notes: notes, p_idempotency_key: idempotencyKey,
      })
      if (error) throw error
      return { success: true, error: null }
    } catch (err: any) {
      return { success: false, error: err.message ?? 'No se pudo registrar el movimiento' }
    } finally {
      setSaving(false)
    }
  }

  return { quickMove, saving }
}

export function useInventarioMutations(companyId: string) {
  const [saving, setSaving] = useState(false)
  const { quickMove } = useInventarioQuickMove()

  // Alta/edición de FICHA del producto — nunca toca stock_current en una
  // edición existente. El stock solo cambia vía movimientos (regla del
  // negocio: "nunca actualizar stock fuera de una transacción ACID").
  const save = async (product: Partial<InventoryProduct>) => {
    if (!companyId) return { success: false, error: 'No company' }
    if (!product.name?.trim()) return { success: false, error: 'Name required' }
    setSaving(true)
    try {
      const basePayload = {
        company_id: companyId,
        name: product.name.trim(),
        sku: product.sku?.trim() || null,
        barcode: product.barcode?.trim() || null,
        category: product.category?.trim() || null,
        unit: product.unit || 'pza',
        cost: Number(product.cost) || 0,
        price: Number(product.price) || 0,
        stock_minimum: Number(product.stock_minimum) || 0,
        notes: product.notes?.trim() || null,
      }

      if (product.id) {
        const { error } = await supabase.from('inventory_products').update(basePayload).eq('id', product.id)
        if (error) throw error
        return { success: true, error: null }
      }

      // Producto nuevo — stock inicial se aplica vía el mismo RPC de
      // movimientos (type INITIAL→IN) para que quede su propio registro
      // de historial, no un valor "de la nada" en la ficha.
      const { data: created, error: e1 } = await supabase.from('inventory_products')
        .insert({ ...basePayload, stock_current: 0 }).select('id').single()
      if (e1) throw e1

      const initialStock = Number(product.stock_current) || 0
      if (initialStock > 0) {
        const idemKey = `initial-${created.id}-${Date.now()}`
        const res = await quickMove(created.id, 'IN', initialStock, 'stock inicial', null, idemKey)
        if (!res.success) throw new Error(res.error ?? 'No se pudo registrar el stock inicial')
      }

      return { success: true, error: null }
    } catch (err: any) {
      return { success: false, error: err.message }
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('inventory_products')
        .update({ is_active: false })
        .eq('id', id)
      if (error) throw error
      return { success: true, error: null }
    } catch (err: any) {
      return { success: false, error: err.message }
    } finally {
      setSaving(false)
    }
  }

  return { save, remove, saving }
}
