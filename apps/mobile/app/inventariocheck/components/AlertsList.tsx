import React from 'react'
import { View, Text, FlatList, StyleSheet } from 'react-native'
import type { InventoryAlert } from '../types'

interface Props {
  alerts: InventoryAlert[]
}

export function AlertsList({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Sin alertas de stock</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={alerts}
      keyExtractor={a => a.id}
      scrollEnabled={false}
      renderItem={({ item: a }) => (
        <View style={styles.alert}>
          <Text style={styles.message}>{a.message}</Text>
          <Text style={styles.type}>{a.alert_type}</Text>
        </View>
      )}
    />
  )
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 14 },
  alert: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  message: { color: '#f1f5f9', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  type: { color: '#94a3b8', fontSize: 11 },
})
