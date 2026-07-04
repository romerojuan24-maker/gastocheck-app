import React from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import type { BankTransaction } from '../types'
import { formatCurrency } from '@gastocheck/shared'

const CATEGORY_LABEL: Record<string, string> = {
  'collection': '💰 Cobranza',
  'expense': '🧾 Gasto',
  'supplier': '🏭 Proveedor',
  'advance': '📤 Anticipo',
  'transfer': '🔁 Traspaso',
  'personal': '👤 Personal',
  'ignore': '🚫 Ignorar',
}

interface Props {
  transactions: BankTransaction[]
  onSelect: (transaction: BankTransaction) => void
  onReset: (transaction: BankTransaction) => void
}

export function TransactionList({ transactions, onSelect, onReset }: Props) {
  if (transactions.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Sin transacciones</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={transactions}
      keyExtractor={t => t.id}
      scrollEnabled={false}
      renderItem={({ item: t }) => {
        const isDeposit = (t.amount ?? 0) >= 0
        const categoryLabel = t.category ? CATEGORY_LABEL[t.category] || t.category : null

        return (
          <View style={styles.transaction}>
            <View style={styles.content}>
              <Text style={styles.description} numberOfLines={1}>
                {t.description || 'Sin descripción'}
              </Text>
              <View style={styles.meta}>
                <Text style={styles.date}>
                  {new Date(t.transaction_date).toLocaleDateString('es-MX')}
                </Text>
                {categoryLabel && (
                  <Text style={styles.category}>{categoryLabel}</Text>
                )}
              </View>
            </View>

            <View style={styles.action}>
              <Text style={[styles.amount, isDeposit ? styles.amountPositive : styles.amountNegative]}>
                {isDeposit ? '+' : '-'}{formatCurrency(Math.abs(t.amount ?? 0))}
              </Text>
              {t.status === 'new' ? (
                <TouchableOpacity
                  onPress={() => onSelect(t)}
                  style={styles.buttonClassify}
                >
                  <Text style={styles.buttonText}>Clasificar</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => onReset(t)}>
                  <Text style={styles.buttonReset}>Reabrir</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )
      }}
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
  transaction: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  content: {
    flex: 1,
    marginRight: 12,
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
  date: {
    color: '#94a3b8',
    fontSize: 11,
  },
  category: {
    color: '#64748b',
    fontSize: 11,
  },
  action: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  amountPositive: {
    color: '#00a650',
  },
  amountNegative: {
    color: '#ff4757',
  },
  buttonClassify: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  buttonText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  buttonReset: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
})
