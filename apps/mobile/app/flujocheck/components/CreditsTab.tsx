import React, { useCallback, useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Modal, ScrollView, ActivityIndicator,
} from 'react-native'
import { formatCurrency } from '@gastocheck/shared'
import { supabase } from '../../../lib/supabase'
import { useAmortizationCalculation } from '../hooks'
import type { Credit, AmortizationType } from '../types'

const AMORT_LABEL: Record<AmortizationType, string> = {
  fixed_payment: 'Cuota fija',
  amortized_balance: 'Cuota creciente',
  last_payment_balloon: 'Pago global final',
  interest_only: 'Solo interés',
}

interface Props {
  companyId: string
  color: string
}

export function CreditsTab({ companyId, color }: Props) {
  const [credits, setCredits] = useState<Credit[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Credit | null>(null)

  const { schedule, calculating, calculate } = useAmortizationCalculation()

  const load = useCallback(async () => {
    if (!companyId) { setLoading(false); return }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('credits')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (!error && data) setCredits(data as Credit[])
    } catch {
      // Tabla aún no migrada — se muestra estado vacío sin romper la app
      setCredits([])
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { load() }, [load])

  const openSchedule = async (credit: Credit) => {
    setSelected(credit)
    const typeMap: Record<AmortizationType, 'fixed' | 'graduated' | 'balloon' | 'interest_only'> = {
      fixed_payment: 'fixed',
      amortized_balance: 'graduated',
      last_payment_balloon: 'balloon',
      interest_only: 'interest_only',
    }
    const months = credit.payments_remaining ?? 12
    await calculate(
      typeMap[credit.amortization_type],
      credit.current_balance,
      credit.interest_rate,
      months,
      new Date(credit.start_date)
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={color} />
      </View>
    )
  }

  if (credits.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>💳</Text>
        <Text style={styles.emptyTitle}>Sin créditos registrados</Text>
        <Text style={styles.emptySub}>
          Los créditos y financiamientos aparecerán aquí con su plan de pagos.
        </Text>
      </View>
    )
  }

  return (
    <>
      <FlatList
        data={credits}
        keyExtractor={c => c.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openSchedule(item)} activeOpacity={0.8}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={[styles.cardType, { color }]}>{AMORT_LABEL[item.amortization_type]}</Text>
            </View>
            <View style={styles.cardRow}>
              <View>
                <Text style={styles.cardLabel}>Saldo actual</Text>
                <Text style={styles.cardValue}>{formatCurrency(item.current_balance)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.cardLabel}>Tasa anual</Text>
                <Text style={styles.cardValue}>{(item.interest_rate * 100).toFixed(2)}%</Text>
              </View>
            </View>
            {item.monthly_payment != null && (
              <Text style={styles.cardPayment}>
                Pago mensual: {formatCurrency(item.monthly_payment)}
                {item.payments_remaining != null ? ` · ${item.payments_remaining} pagos restantes` : ''}
              </Text>
            )}
          </TouchableOpacity>
        )}
      />

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected?.name}</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {calculating ? (
              <ActivityIndicator size="large" color={color} style={{ marginTop: 24 }} />
            ) : (
              <ScrollView>
                {schedule.map(p => (
                  <View key={p.id} style={styles.scheduleRow}>
                    <Text style={styles.scheduleNum}>#{p.payment_number}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.scheduleDate}>
                        {new Date(p.due_date).toLocaleDateString('es-MX')}
                      </Text>
                      <Text style={styles.scheduleBreakdown}>
                        Capital {formatCurrency(p.principal_payment)} + Interés {formatCurrency(p.interest_payment)}
                      </Text>
                    </View>
                    <Text style={styles.scheduleTotal}>{formatCurrency(p.total_payment)}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cardName: { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
  cardType: { fontSize: 11, fontWeight: '600' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  cardValue: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
  cardPayment: { color: '#cbd5e1', fontSize: 12, marginTop: 10 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0f172a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: '#f1f5f9', fontSize: 17, fontWeight: '700' },
  modalClose: { color: '#94a3b8', fontSize: 20 },

  scheduleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  scheduleNum: { color: '#64748b', fontSize: 12, width: 28 },
  scheduleDate: { color: '#f1f5f9', fontSize: 13, fontWeight: '600' },
  scheduleBreakdown: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  scheduleTotal: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
})
