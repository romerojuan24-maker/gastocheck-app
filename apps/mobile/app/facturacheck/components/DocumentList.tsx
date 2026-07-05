import React from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { formatCurrency } from '@gastocheck/shared'
import type { CfdiDocument } from '../types'

interface Props {
  documents: CfdiDocument[]
  onPress?: (doc: CfdiDocument) => void
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  vigente: { label: 'Vigente', color: '#10b981' },
  cancelado: { label: 'Cancelada', color: '#ef4444' },
  not_found: { label: 'No en SAT', color: '#f59e0b' },
  duplicate: { label: 'Duplicada', color: '#a855f7' },
  unmatched: { label: 'Sin relacionar', color: '#94a3b8' },
  matched: { label: 'Relacionada', color: '#3b82f6' },
  pending_complement: { label: 'Falta complemento', color: '#f59e0b' },
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
      renderItem={({ item: d }) => {
        const meta = STATUS_META[d.status] ?? { label: d.status, color: '#94a3b8' }
        const counterparty = d.direction === 'issued'
          ? (d.razon_social_receptor || d.rfc_receptor)
          : (d.razon_social_emisor || d.rfc_emisor)

        return (
          <TouchableOpacity
            onPress={() => onPress?.(d)}
            style={styles.card}
            activeOpacity={0.8}
          >
            <View style={styles.content}>
              <Text style={styles.uuid} numberOfLines={1}>{d.uuid_cfdi}</Text>
              <Text style={styles.counterparty} numberOfLines={1}>{counterparty}</Text>
              <View style={styles.metaRow}>
                {d.fecha_emision && (
                  <Text style={styles.date}>
                    {new Date(d.fecha_emision).toLocaleDateString('es-MX')}
                  </Text>
                )}
                <View style={[styles.statusPill, { backgroundColor: meta.color + '20' }]}>
                  <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                </View>
                {d.related_bank_txn_id && <Text style={styles.linkedIcon}>🔗</Text>}
              </View>
            </View>
            <Text style={styles.amount}>{formatCurrency(d.total || 0)}</Text>
          </TouchableOpacity>
        )
      }}
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
  content: { flex: 1, marginRight: 10 },
  uuid: { color: '#f1f5f9', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  counterparty: { color: '#cbd5e1', fontSize: 12, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  date: { color: '#94a3b8', fontSize: 11 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700' },
  linkedIcon: { fontSize: 11 },
  amount: { color: '#10b981', fontSize: 15, fontWeight: '700' },
})
