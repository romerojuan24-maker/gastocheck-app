import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import type { BankAccount } from '../types'
import { formatCurrency } from '@gastocheck/shared'

interface Props {
  accounts: BankAccount[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function AccountSelector({ accounts, selectedId, onSelect }: Props) {
  if (accounts.length === 0) return null

  return (
    <View>
      <Text style={styles.label}>Cuentas</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
        {accounts.map(acc => (
          <TouchableOpacity
            key={acc.id}
            onPress={() => onSelect(acc.id)}
            style={[
              styles.button,
              selectedId === acc.id && styles.buttonActive
            ]}
          >
            <Text style={[
              styles.buttonText,
              selectedId === acc.id && styles.buttonTextActive
            ]}>
              {acc.name}
            </Text>
            <Text style={[
              styles.buttonBalance,
              selectedId === acc.id && styles.buttonBalanceActive
            ]}>
              {formatCurrency(acc.current_balance)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  label: {
    color: '#f1f5f9',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  container: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    marginRight: 8,
  },
  buttonActive: {
    backgroundColor: '#00a650',
  },
  buttonText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonTextActive: {
    color: '#ffffff',
  },
  buttonBalance: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  buttonBalanceActive: {
    color: '#e0f2fe',
  },
})
