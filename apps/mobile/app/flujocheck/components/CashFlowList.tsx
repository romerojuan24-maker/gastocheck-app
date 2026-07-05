import React from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import type { CashFlowItem } from '../types'
import { formatCurrency } from '@gastocheck/shared'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  collected: 'Cobrado',
  at_risk: 'En riesgo',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
}

const SOURCE_LABEL: Record<string, string> = {
  manual: 'Manual',
  cobracheck: 'Cobra',
  gastocheck: 'Gasto',
  bancocheck: 'Banco',
  inventariocheck: 'Inventario',
}

interface Props {
  items: CashFlowItem[]
  onEdit: (item: CashFlowItem) => void
  onDelete: (item: CashFlowItem) => void
  saving?: boolean
}

export function CashFlowList({ items, onEdit, onDelete, saving }: Props) {
  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Sin movimientos proyectados</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={items}
      keyExtractor={i => i.id}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <View style={[
          styles.item,
          item.direction === 'in' ? styles.itemIncome : styles.itemExpense
        ]}>
          <View style={styles.content}>
            <Text style={styles.description} numberOfLines={1}>
              {item.description}
            </Text>
            <View style={styles.meta}>
              <Text style={styles.metaText}>
                {new Date(item.expected_date).toLocaleDateString('es-MX')}
              </Text>
              <Text style={styles.status}>{STATUS_LABEL[item.status]}</Text>
              {item.source !== 'manual' && (
                <Text style={styles.source}>{SOURCE_LABEL[item.source]}</Text>
              )}
            </View>
            {item.notes && (
              <Text style={styles.confidenceNote} numberOfLines={1}>{item.notes}</Text>
            )}
          </View>

          <View style={styles.action}>
            <Text style={[
              styles.amount,
              item.direction === 'in' ? styles.amountIncome : styles.amountExpense
            ]}>
              {item.direction === 'in' ? '+' : '-'}{formatCurrency(item.amount)}
            </Text>
            {item.source === 'manual' && (
              <View style={styles.buttons}>
                <TouchableOpacity onPress={() => onEdit(item)} disabled={saving}>
                  <Text style={[styles.buttonEdit, saving && styles.buttonDisabled]}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onDelete(item)} disabled={saving}>
                  <Text style={[styles.buttonDelete, saving && styles.buttonDisabled]}>Borrar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}
    />
  )
}

const styles = StyleSheet.create({
  empty: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  item: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemIncome: {
    backgroundColor: '#064e3b',
    borderColor: '#10b981',
    borderWidth: 1,
  },
  itemExpense: {
    backgroundColor: '#7f1d1d',
    borderColor: '#ef4444',
    borderWidth: 1,
  },
  content: {
    flex: 1,
  },
  description: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  meta: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  metaText: {
    color: '#cbd5e1',
    fontSize: 11,
  },
  status: {
    color: '#cbd5e1',
    fontSize: 11,
  },
  source: {
    color: '#94a3b8',
    fontSize: 10,
  },
  confidenceNote: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 4,
    fontStyle: 'italic',
  },
  action: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  amountIncome: {
    color: '#10b981',
  },
  amountExpense: {
    color: '#ef4444',
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
  },
  buttonEdit: {
    color: '#3b82f6',
    fontSize: 11,
    fontWeight: '600',
  },
  buttonDelete: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
})
