import React from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView } from 'react-native'
import type { BankTransaction, ChargeCategory, DepositCategory } from '../types'
import { formatCurrency, BRAND } from '@gastocheck/shared'

const CHARGE_CATEGORIES: { key: ChargeCategory; label: string }[] = [
  { key: 'expense',  label: '🧾 Gasto de negocio' },
  { key: 'supplier', label: '🏭 Proveedor' },
  { key: 'advance',  label: '📤 Anticipo' },
  { key: 'refund',   label: '↩️ Reembolso' },
  { key: 'tax',      label: '🏛️ Impuesto' },
  { key: 'bank_fee', label: '🏦 Comisión bancaria' },
  { key: 'loan',     label: '💳 Préstamo' },
  { key: 'other',    label: '❓ Otro' },
]

const DEPOSIT_CATEGORIES: { key: DepositCategory; label: string }[] = [
  { key: 'client_payment',    label: '💰 Pago de cliente' },
  { key: 'unbilled_income',   label: '📥 Ingreso no facturado' },
  { key: 'loan',              label: '💳 Préstamo' },
  { key: 'owner_contribution', label: '🏢 Aportación del dueño' },
  { key: 'refund',            label: '↩️ Devolución' },
  { key: 'internal_transfer', label: '🔁 Transferencia interna' },
  { key: 'other',             label: '❓ Otro' },
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
  const categories = isDeposit ? DEPOSIT_CATEGORIES : CHARGE_CATEGORIES

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Explicar movimiento</Text>
          <Text style={styles.description} numberOfLines={2}>{transaction.description || 'Sin descripción'}</Text>
          <Text style={[styles.amount, { color: isDeposit ? BRAND.green : BRAND.red }]}>
            {isDeposit ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount ?? 0))}
          </Text>
          <Text style={styles.hint}>{isDeposit ? '¿De dónde vino este depósito?' : '¿A qué corresponde este cargo?'}</Text>

          <ScrollView style={styles.categories}>
            {categories.map(cat => (
              <TouchableOpacity key={cat.key} disabled={saving} onPress={() => onClassify(cat.key)} style={styles.categoryButton}>
                <Text style={styles.categoryLabel}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity disabled={saving} onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: '#fff', borderRadius: 20, padding: 22, width: '90%', maxHeight: '80%' },
  title: { fontSize: 18, fontWeight: '800', color: BRAND.navy, marginBottom: 10 },
  description: { color: '#607D8B', fontSize: 13, marginBottom: 6 },
  amount: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  hint: { color: '#90A4AE', fontSize: 12, marginBottom: 14 },
  categories: { marginBottom: 12, maxHeight: 320 },
  categoryButton: { paddingVertical: 13, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F0F4F8' },
  categoryLabel: { color: BRAND.navy, fontSize: 14, fontWeight: '600' },
  cancelButton: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#90A4AE', fontSize: 14, fontWeight: '700' },
})
