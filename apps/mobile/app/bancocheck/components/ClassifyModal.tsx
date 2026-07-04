import React from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView } from 'react-native'
import type { BankTransaction } from '../types'
import { formatCurrency } from '@gastocheck/shared'

const CATEGORIES = [
  { key: 'collection', label: '💰 Cobranza (cliente)' },
  { key: 'expense', label: '🧾 Gasto' },
  { key: 'supplier', label: '🏭 Pago a proveedor' },
  { key: 'advance', label: '📤 Anticipo' },
  { key: 'transfer', label: '🔁 Traspaso' },
  { key: 'personal', label: '👤 Personal' },
  { key: 'ignore', label: '🚫 Ignorar' },
]

interface Props {
  transaction: BankTransaction | null
  onClose: () => void
  onClassify: (category: string) => Promise<void>
  saving: boolean
}

export function ClassifyModal({ transaction, onClose, onClassify, saving }: Props) {
  if (!transaction) return null

  const isDeposit = (transaction.amount ?? 0) >= 0

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Clasificar movimiento</Text>

          <Text style={styles.description} numberOfLines={1}>
            {transaction.description || 'Sin descripción'}
          </Text>

          <Text style={[
            styles.amount,
            isDeposit ? styles.amountPositive : styles.amountNegative
          ]}>
            {isDeposit ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount ?? 0))}
          </Text>

          <ScrollView style={styles.categories}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.key}
                disabled={saving}
                onPress={() => onClassify(cat.key)}
                style={styles.categoryButton}
              >
                <Text style={styles.categoryLabel}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            disabled={saving}
            onPress={onClose}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  title: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  description: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 8,
  },
  amount: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  amountPositive: {
    color: '#00a650',
  },
  amountNegative: {
    color: '#ff4757',
  },
  categories: {
    marginBottom: 12,
    maxHeight: 300,
  },
  categoryButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  categoryLabel: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '500',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
})
