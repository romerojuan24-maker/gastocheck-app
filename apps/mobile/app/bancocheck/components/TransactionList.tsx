import React from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import type { BankTransaction, BankTransactionStatus } from '../types'
import { formatCurrency, BRAND } from '@gastocheck/shared'

// Nunca "póliza/asiento/debe/haber" — vocabulario del módulo (regla UX).
const STATUS_META: Record<BankTransactionStatus, { label: string; bg: string; fg: string }> = {
  new:              { label: 'Sin explicar',        bg: '#F0F4F8', fg: '#607D8B' },
  matched:          { label: 'Sugerencia',           bg: '#FFF3E0', fg: '#FF9800' },
  explained:        { label: 'Explicado',            bg: '#E6F7ED', fg: BRAND.green },
  personal:         { label: 'Personal',             bg: '#F3E5F5', fg: BRAND.purple },
  ignored:          { label: 'Ignorado',             bg: '#F0F4F8', fg: '#90A4AE' },
  pending_document:  { label: 'Falta comprobante',    bg: '#FFEBEE', fg: BRAND.red },
  pending_invoice:   { label: 'Falta factura',        bg: '#FFEBEE', fg: BRAND.red },
  unidentified:      { label: 'Revisar con contador',  bg: '#FFF8E1', fg: '#F57F17' },
}

interface Props {
  transactions: BankTransaction[]
  onExplain: (t: BankTransaction) => void
  onPersonal: (t: BankTransaction) => void
  onIgnore: (t: BankTransaction) => void
}

export function TransactionList({ transactions, onExplain, onPersonal, onIgnore }: Props) {
  if (transactions.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={{ fontSize: 32, marginBottom: 8 }}>🏦</Text>
        <Text style={styles.emptyText}>Sin movimientos</Text>
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
        const meta = STATUS_META[t.status]
        const actionable = t.status !== 'explained' && t.status !== 'ignored'

        return (
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.description} numberOfLines={1}>{t.description || 'Sin descripción'}</Text>
                <Text style={styles.date}>{new Date(t.transaction_date).toLocaleDateString('es-MX')}</Text>
              </View>
              <Text style={[styles.amount, { color: isDeposit ? BRAND.green : BRAND.red }]}>
                {isDeposit ? '+' : '-'}{formatCurrency(Math.abs(t.amount ?? 0))}
              </Text>
            </View>

            <View style={styles.row}>
              <View style={[styles.pill, { backgroundColor: meta.bg }]}>
                <Text style={[styles.pillText, { color: meta.fg }]}>{meta.label}</Text>
              </View>
              {t.is_personal && (
                <View style={[styles.pill, { backgroundColor: '#F3E5F5', marginLeft: 6 }]}>
                  <Text style={[styles.pillText, { color: BRAND.purple }]}>👤 Personal</Text>
                </View>
              )}
            </View>

            {actionable && (
              <View style={[styles.row, { marginTop: 10, gap: 8 }]}>
                <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary]} onPress={() => onExplain(t)}>
                  <Text style={styles.actionPrimaryText}>Explicar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => onPersonal(t)}>
                  <Text style={styles.actionText}>Personal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => onIgnore(t)}>
                  <Text style={styles.actionText}>Ignorar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )
      }}
    />
  )
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { color: '#90A4AE', fontSize: 14 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#F0F0F0', elevation: 1, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  description: { fontSize: 14, fontWeight: '700', color: BRAND.navy },
  date: { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '800' },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '700' },
  actionBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#F0F4F8',
  },
  actionText: { fontSize: 12, fontWeight: '700', color: BRAND.navy },
  actionPrimary: { backgroundColor: BRAND.blue },
  actionPrimaryText: { fontSize: 12, fontWeight: '700', color: '#fff' },
})
