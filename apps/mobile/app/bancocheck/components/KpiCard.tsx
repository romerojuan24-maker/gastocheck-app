import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

interface Props {
  label: string
  value: string | number
  color?: string
}

export function KpiCard({ label, value, color = '#f1f5f9' }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
  },
  label: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
  },
})
