import React from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { getStockStatus } from '@gastocheck/shared'
import type { InventoryProduct } from '../types'
import { formatCurrency } from '@gastocheck/shared'

interface Props {
  products: InventoryProduct[]
  onEdit: (product: InventoryProduct) => void
  onDelete: (product: InventoryProduct) => void
}

export function ProductList({ products, onEdit, onDelete }: Props) {
  if (products.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Sin productos en inventario</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={products}
      keyExtractor={p => p.id}
      scrollEnabled={false}
      renderItem={({ item: p }) => {
        const status = getStockStatus(p)
        return (
          <View style={styles.card}>
            <View style={styles.content}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.meta}>
                {p.sku ? `SKU ${p.sku}` : ''} {p.category ? ` • ${p.category}` : ''}
              </Text>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Costo: {formatCurrency(p.cost)}</Text>
                <Text style={styles.priceLabel}>Venta: {formatCurrency(p.price)}</Text>
              </View>
            </View>
            <View style={styles.stockBox}>
              <Text style={[styles.stockValue, { color: status.color }]}>
                {Number(p.stock_current).toFixed(1)}
              </Text>
              <Text style={styles.stockUnit}>{p.unit}</Text>
              <Text style={[styles.stockStatus, { color: status.color }]}>
                {status.label}
              </Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => onEdit(p)}>
                <Text style={styles.buttonEdit}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onDelete(p)}>
                <Text style={styles.buttonDelete}>Borrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      }}
    />
  )
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 14 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  content: { marginBottom: 10 },
  name: { color: '#f1f5f9', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  meta: { color: '#94a3b8', fontSize: 11, marginBottom: 6 },
  priceRow: { flexDirection: 'row', gap: 12 },
  priceLabel: { color: '#cbd5e1', fontSize: 11 },
  stockBox: { alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 8, padding: 8, marginBottom: 8 },
  stockValue: { fontSize: 16, fontWeight: '700' },
  stockUnit: { color: '#94a3b8', fontSize: 10 },
  stockStatus: { fontSize: 10, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12 },
  buttonEdit: { color: '#3b82f6', fontSize: 11, fontWeight: '600' },
  buttonDelete: { color: '#ef4444', fontSize: 11, fontWeight: '600' },
})
