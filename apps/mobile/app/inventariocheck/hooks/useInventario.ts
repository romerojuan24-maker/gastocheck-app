import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import type { InventoryProduct, InventoryAlert } from '../types'

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

export function useInventarioMutations(companyId: string) {
  const [saving, setSaving] = useState(false)

  const save = async (product: Partial<InventoryProduct>) => {
    if (!companyId) return { success: false, error: 'No company' }
    if (!product.name?.trim()) return { success: false, error: 'Name required' }
    setSaving(true)
    try {
      const payload = {
        company_id: companyId,
        name: product.name.trim(),
        sku: product.sku?.trim() || null,
        barcode: product.barcode?.trim() || null,
        category: product.category?.trim() || null,
        unit: product.unit || 'pza',
        cost: Number(product.cost) || 0,
        price: Number(product.price) || 0,
        stock_current: Number(product.stock_current) || 0,
        stock_minimum: Number(product.stock_minimum) || 0,
        notes: product.notes?.trim() || null,
      }

      let res
      if (product.id) {
        res = await supabase.from('inventory_products').update(payload).eq('id', product.id)
      } else {
        res = await supabase.from('inventory_products').insert(payload)
      }

      if (res.error) throw res.error
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
