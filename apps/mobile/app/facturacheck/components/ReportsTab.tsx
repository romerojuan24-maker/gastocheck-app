import React from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { formatCurrency } from '@gastocheck/shared'
import type { CfdiDocument } from '../types'

interface Props {
  documents: CfdiDocument[]
  color: string
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  pending: 'Pendiente',
  timbrado: 'Timbrada',
  valid: 'Vigente',
  cancelled: 'Cancelada',
  cancelado: 'Cancelada',
  error: 'Error',
  not_found: 'No encontrada',
  duplicate: 'Duplicada',
}

export function ReportsTab({ documents, color }: Props) {
  const totalAmount = documents.reduce((s, d) => s + (d.total || 0), 0)
  const issuedAmount = documents.filter(d => d.direction === 'issued').reduce((s, d) => s + (d.total || 0), 0)
  const receivedAmount = documents.filter(d => d.direction === 'received').reduce((s, d) => s + (d.total || 0), 0)

  const byStatus = documents.reduce<Record<string, { count: number; amount: number }>>((acc, d) => {
    const key = d.status
    if (!acc[key]) acc[key] = { count: 0, amount: 0 }
    acc[key].count += 1
    acc[key].amount += d.total || 0
    return acc
  }, {})

  if (documents.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyTitle}>Sin datos para reportar</Text>
        <Text style={styles.emptySub}>Los reportes aparecerán conforme se registren facturas.</Text>
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>TOTAL FACTURADO</Text>
        <Text style={[styles.summaryValue, { color }]}>{formatCurrency(totalAmount)}</Text>
        <Text style={styles.summarySub}>{documents.length} documentos</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.halfCard}>
          <Text style={styles.halfLabel}>Emitidas</Text>
          <Text style={styles.halfValue}>{formatCurrency(issuedAmount)}</Text>
        </View>
        <View style={styles.halfCard}>
          <Text style={styles.halfLabel}>Recibidas</Text>
          <Text style={styles.halfValue}>{formatCurrency(receivedAmount)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Por estado</Text>
      {Object.entries(byStatus).map(([status, data]) => (
        <View key={status} style={styles.statusRow}>
          <Text style={styles.statusLabel}>{STATUS_LABEL[status] || status}</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.statusCount}>{data.count} docs</Text>
            <Text style={styles.statusAmount}>{formatCurrency(data.amount)}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 8 },
  emptyIcon: { fontSize: 40, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },

  summaryCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 12,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2,
  },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: '#94A3B8', letterSpacing: 0.5, marginBottom: 6 },
  summaryValue: { fontSize: 26, fontWeight: '800' },
  summarySub: { fontSize: 12, color: '#94A3B8', marginTop: 4 },

  row: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  halfCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2,
  },
  halfLabel: { fontSize: 11, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 },
  halfValue: { fontSize: 16, fontWeight: '700', color: '#0F172A' },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, marginTop: 4 },
  statusRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2,
  },
  statusLabel: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  statusCount: { fontSize: 11, color: '#94A3B8' },
  statusAmount: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginTop: 2 },
})
