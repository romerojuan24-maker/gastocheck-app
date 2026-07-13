// InventarioCheck — historia de movimientos (timeline). Nunca se borra;
// para corregir un error se registra un movimiento compensatorio.
import React from 'react'
import { View, Text, FlatList, StyleSheet } from 'react-native'
import type { InventoryMovement } from '../types'

const TYPE_META: Record<string, { label: string; color: string; sign: string }> = {
  IN:              { label: 'Entró',            color: '#10b981', sign: '+' },
  ADJUSTMENT_IN:   { label: 'Ajuste (entrada)',  color: '#10b981', sign: '+' },
  RETURN_IN:       { label: 'Devolución',        color: '#10b981', sign: '+' },
  OUT:             { label: 'Salió',             color: '#ef4444', sign: '−' },
  ADJUSTMENT_OUT:  { label: 'Ajuste (salida)',   color: '#ef4444', sign: '−' },
  WASTE:           { label: 'Merma',             color: '#ef4444', sign: '−' },
  RETURN_OUT:      { label: 'Devuelto',          color: '#ef4444', sign: '−' },
  TRANSFER:        { label: 'Movido',            color: '#3b82f6', sign: '↔' },
}

const REASON_LABEL: Record<string, string> = {
  compra: 'Compra', devolucion_cliente: 'Devolución de cliente', ajuste: 'Ajuste', otro: 'Otro',
  venta: 'Venta', uso: 'Uso', cliente: 'Cliente', proyecto: 'Proyecto', merma: 'Merma',
  devolucion_proveedor: 'Devolución a proveedor', 'stock inicial': 'Stock inicial',
}

interface Props {
  movements: InventoryMovement[]
  productNames: Record<string, string>
}

export function MovementsList({ movements, productNames }: Props) {
  if (movements.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Sin movimientos todavía</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={movements}
      keyExtractor={m => m.id}
      scrollEnabled={false}
      renderItem={({ item: m }) => {
        const meta = TYPE_META[m.movement_type] ?? { label: m.movement_type, color: '#94a3b8', sign: '' }
        const reasonLabel = m.reason ? (REASON_LABEL[m.reason] ?? m.reason) : null
        return (
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: meta.color }]} />
            <View style={styles.content}>
              <Text style={styles.line}>
                <Text style={{ color: meta.color, fontWeight: '700' }}>{meta.sign}{m.quantity} {meta.label.toLowerCase()}</Text>
                {'  '}
                <Text style={styles.productName}>{productNames[m.product_id] ?? 'Producto'}</Text>
              </Text>
              <Text style={styles.meta}>
                {reasonLabel ?? ''}{reasonLabel && ' · '}{new Date(m.created_at).toLocaleDateString('es-MX')} {new Date(m.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {m.notes && <Text style={styles.notes} numberOfLines={1}>{m.notes}</Text>}
            </View>
          </View>
        )
      }}
    />
  )
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 14 },
  row: { flexDirection: 'row', marginBottom: 14 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5, marginRight: 10 },
  content: { flex: 1 },
  line: { fontSize: 13 },
  productName: { color: '#cbd5e1', fontWeight: '600' },
  meta: { color: '#64748b', fontSize: 11, marginTop: 2 },
  notes: { color: '#64748b', fontSize: 11, marginTop: 2, fontStyle: 'italic' },
})
