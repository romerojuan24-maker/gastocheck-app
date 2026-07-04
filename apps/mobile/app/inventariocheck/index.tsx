import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'

// Hooks
import { useInventarioProducts, useInventarioAlerts, useInventarioMutations } from './hooks'

// Componentes
import { ProductList, AlertsList, EditModal } from './components'

// Tipos
import type { InventoryProduct } from './types'

export default function InventarioCheckScreen() {
  const insets = useSafeAreaInsets()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [tab, setTab] = useState<'stock' | 'alertas'>('stock')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Partial<InventoryProduct> | null>(null)

  const { products, refetch: refetchProducts } = useInventarioProducts(companyId || '')
  const { alerts } = useInventarioAlerts(companyId || '')
  const { save, remove, saving } = useInventarioMutations(companyId || '')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', data.user.id)
        .single()
        .then(({ data: member }) => {
          if (member) setCompanyId(member.company_id)
        })
    })
  }, [])

  const handleSave = async (product: Partial<InventoryProduct>) => {
    const result = await save(product)
    if (result.success) {
      Alert.alert('Éxito', product.id ? 'Producto actualizado' : 'Producto creado')
      setEditing(null)
      await refetchProducts()
    } else {
      Alert.alert('Error', result.error || 'No se pudo guardar')
    }
  }

  const handleDelete = (product: InventoryProduct) => {
    Alert.alert(
      'Eliminar',
      `¿Eliminar ${product.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const result = await remove(product.id)
            if (result.success) {
              Alert.alert('Eliminado', 'Producto eliminado')
              await refetchProducts()
            } else {
              Alert.alert('Error', result.error)
            }
          },
        },
      ]
    )
  }

  const agotados = products.filter(p => p.stock_current <= 0).length
  const bajos = products.filter(p => p.stock_current > 0 && p.stock_current <= p.stock_minimum).length
  const valorInventario = products.reduce((s, p) => s + (Number(p.cost) || 0) * (Number(p.stock_current) || 0), 0)

  const visible = products.filter(p => {
    const q = search.toLowerCase()
    return !q || [p.name, p.sku, p.barcode, p.category].some(f => f?.toLowerCase().includes(q))
  })

  const newProduct: Partial<InventoryProduct> = {
    unit: 'pza',
    cost: 0,
    price: 0,
    stock_current: 0,
    stock_minimum: 0,
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>📦 InventarioCheck</Text>
        <Text style={styles.subtitle}>Gestión de stock</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* KPIs */}
        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Productos</Text>
            <Text style={styles.kpiValue}>{products.length}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Stock bajo</Text>
            <Text style={[styles.kpiValue, { color: '#f59e0b' }]}>{bajos}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Agotados</Text>
            <Text style={[styles.kpiValue, { color: '#ef4444' }]}>{agotados}</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['stock', 'alertas'] as const).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'stock' ? 'Productos' : `Alertas (${alerts.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'stock' ? (
          <>
            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por nombre, SKU..."
                placeholderTextColor="#64748b"
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <View style={styles.listContainer}>
              <ProductList
                products={visible}
                onEdit={setEditing}
                onDelete={handleDelete}
              />
            </View>
          </>
        ) : (
          <View style={styles.listContainer}>
            <AlertsList alerts={alerts} />
          </View>
        )}

        <View style={styles.spacer} />
      </ScrollView>

      {/* FAB */}
      <View style={styles.fab}>
        <TouchableOpacity
          onPress={() => setEditing(newProduct)}
          style={styles.fabButton}
        >
          <Text style={styles.fabText}>+ Nuevo producto</Text>
        </TouchableOpacity>
      </View>

      {/* Modal */}
      <EditModal
        product={editing}
        onClose={() => setEditing(null)}
        onSave={handleSave}
        saving={saving}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { backgroundColor: '#182535', paddingHorizontal: 16, paddingVertical: 14 },
  title: { fontSize: 24, fontWeight: '700', color: '#f1f5f9' },
  subtitle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  content: { flex: 1, paddingTop: 8 },
  kpiRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  kpi: { flex: 1, backgroundColor: '#1e293b', borderRadius: 12, padding: 10 },
  kpiLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  kpiValue: { color: '#f1f5f9', fontSize: 18, fontWeight: '700' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b', marginBottom: 14 },
  tab: { paddingVertical: 12, paddingHorizontal: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#10b981' },
  tabText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#10b981' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#f1f5f9', fontSize: 14 },
  listContainer: { paddingHorizontal: 16 },
  spacer: { height: 80 },
  fab: { position: 'absolute', bottom: 16, left: 16, right: 16 },
  fabButton: { backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 8 },
  fabText: { color: '#ffffff', textAlign: 'center', fontWeight: '700', fontSize: 14 },
})
