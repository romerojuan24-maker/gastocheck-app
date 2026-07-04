import React from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { formatCurrency } from '@gastocheck/shared'
import type { CfdiDocument } from '../types'

interface Props {
  documents: CfdiDocument[]
  onPress?: (doc: CfdiDocument) => void
}

export function DocumentList({ documents, onPress }: Props) {
  if (documents.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Sin facturas</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={documents}
      keyExtractor={d => d.id}
      scrollEnabled={false}
      renderItem={({ item: d }) => (
        <TouchableOpacity
          onPress={() => onPress?.(d)}
          style={styles.card}
        >
          <View style={styles.content}>
            <Text style={styles.uuid} numberOfLines={1}>
              {d.uuid_cfdi}
            </Text>
            <Text style={styles.rfc}>{d.rfc_emisor}</Text>
          </View>
          <Text style={styles.amount}>
            {formatCurrency(d.total || 0)}
          </Text>
        </TouchableOpacity>
      )}
    />
  )
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 14 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  content: { flex: 1 },
  uuid: { color: '#f1f5f9', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  rfc: { color: '#94a3b8', fontSize: 11 },
  amount: { color: '#10b981', fontSize: 15, fontWeight: '700' },
})
