import React from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { formatCurrency } from '@gastocheck/shared'
import { useBancoReconciliation } from '../hooks'
import type { BankReconciliation } from '../types'

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const STATUS_META: Record<BankReconciliation['status'], { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: '#f59e0b' },
  reconciled: { label: 'Reconciliada', color: '#10b981' },
  needs_review: { label: 'Requiere revisión', color: '#ef4444' },
}

interface Props {
  companyId: string
  color: string
}

export function ReconciliationTab({ companyId, color }: Props) {
  const { reconciliations, loading, refetch, reconcile } = useBancoReconciliation(companyId)

  const handleReconcile = (item: BankReconciliation) => {
    Alert.alert(
      'Confirmar reconciliación',
      `¿Marcar ${MONTH_NAMES[item.period_month - 1]} ${item.period_year} como reconciliado?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            const result = await reconcile(item.id)
            if (result.success) {
              Alert.alert('Éxito', 'Periodo reconciliado')
              refetch()
            } else {
              Alert.alert('Error', result.error || 'No se pudo reconciliar')
            }
          },
        },
      ]
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={color} />
      </View>
    )
  }

  if (reconciliations.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>🔄</Text>
        <Text style={styles.emptyTitle}>Sin periodos de reconciliación</Text>
        <Text style={styles.emptySub}>
          Los periodos mensuales aparecerán aquí conforme se generen movimientos bancarios.
        </Text>
      </View>
    )
  }

  return (
    <FlatList
      data={reconciliations}
      keyExtractor={r => r.id}
      contentContainerStyle={{ padding: 16 }}
      renderItem={({ item }) => {
        const meta = STATUS_META[item.status] ?? STATUS_META.pending
        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardMonth}>
                {MONTH_NAMES[item.period_month - 1]} {item.period_year}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: meta.color + '20' }]}>
                <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            </View>

            <View style={styles.cardRow}>
              <View>
                <Text style={styles.cardLabel}>Saldo estado de cuenta</Text>
                <Text style={styles.cardValue}>{formatCurrency(item.bank_statement_balance)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.cardLabel}>Saldo sistema</Text>
                <Text style={styles.cardValue}>{formatCurrency(item.system_balance)}</Text>
              </View>
            </View>

            <View style={styles.diffRow}>
              <Text style={styles.diffLabel}>Diferencia</Text>
              <Text style={[styles.diffValue, { color: item.difference === 0 ? '#10b981' : '#ef4444' }]}>
                {formatCurrency(item.difference)}
              </Text>
            </View>

            {item.status !== 'reconciled' && (
              <TouchableOpacity
                style={[styles.reconcileButton, { backgroundColor: color }]}
                onPress={() => handleReconcile(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.reconcileButtonText}>Marcar como reconciliado</Text>
              </TouchableOpacity>
            )}
          </View>
        )
      }}
    />
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 8 },
  emptyIcon: { fontSize: 40, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#f1f5f9' },
  emptySub: { fontSize: 13, color: '#94a3b8', textAlign: 'center' },

  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardMonth: { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },

  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cardLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  cardValue: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },

  diffRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155', marginBottom: 10,
  },
  diffLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  diffValue: { fontSize: 16, fontWeight: '800' },

  reconcileButton: { borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  reconcileButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
})
