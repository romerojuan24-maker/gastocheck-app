import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import type { BankAccount } from '../types'
import { formatCurrency, BRAND } from '@gastocheck/shared'

interface Props {
  accounts: BankAccount[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function AccountSelector({ accounts, selectedId, onSelect }: Props) {
  if (accounts.length === 0) return null

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
      <TouchableOpacity
        onPress={() => onSelect(null)}
        style={[styles.chip, selectedId === null && styles.chipActive]}
      >
        <Text style={[styles.chipText, selectedId === null && styles.chipTextActive]}>Todas</Text>
      </TouchableOpacity>
      {accounts.map(acc => (
        <TouchableOpacity
          key={acc.id}
          onPress={() => onSelect(acc.id)}
          style={[styles.chip, selectedId === acc.id && styles.chipActive]}
        >
          <Text style={[styles.chipText, selectedId === acc.id && styles.chipTextActive]}>{acc.name}</Text>
          <Text style={[styles.chipBalance, selectedId === acc.id && styles.chipBalanceActive]}>
            {formatCurrency(acc.current_balance)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    backgroundColor: '#fff', marginRight: 8, borderWidth: 1, borderColor: '#EEF2F7',
  },
  chipActive: { backgroundColor: BRAND.blue, borderColor: BRAND.blue },
  chipText: { color: BRAND.navy, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#fff' },
  chipBalance: { color: '#90A4AE', fontSize: 11, marginTop: 2 },
  chipBalanceActive: { color: 'rgba(255,255,255,0.85)' },
})
