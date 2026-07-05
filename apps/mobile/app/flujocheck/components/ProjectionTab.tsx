import React, { useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { formatCurrency } from '@gastocheck/shared'
import { useAnnualProjection } from '../hooks'
import { ScenariosSection } from './ScenariosSection'
import type { CashFlowItem } from '../types'

interface Props {
  companyId: string
  currentBalance: number
  monthlyIncomeAvg: number
  monthlyExpenseAvg: number
  baselineItems: CashFlowItem[]
  color: string
}

const HEALTH_COLOR: Record<string, string> = {
  green: '#10b981',
  yellow: '#f59e0b',
  red: '#ef4444',
}

const HEALTH_LABEL: Record<string, string> = {
  green: 'Saludable',
  yellow: 'Atención',
  red: 'Crítico',
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function ProjectionTab({ companyId, currentBalance, monthlyIncomeAvg, monthlyExpenseAvg, baselineItems, color }: Props) {
  const { projections, calculating, calculate } = useAnnualProjection()

  useEffect(() => {
    if (currentBalance > 0 || monthlyIncomeAvg > 0 || monthlyExpenseAvg > 0) {
      calculate(currentBalance || 1, monthlyIncomeAvg, monthlyExpenseAvg)
    }
  }, [currentBalance, monthlyIncomeAvg, monthlyExpenseAvg])

  if (calculating) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={color} />
      </View>
    )
  }

  if (projections.length === 0) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.centerInline}>
          <Text style={styles.emptyIcon}>📈</Text>
          <Text style={styles.emptyTitle}>Sin datos suficientes</Text>
          <Text style={styles.emptySub}>
            Registra movimientos para ver la proyección de 12 meses.
          </Text>
        </View>
        <ScenariosSection
          companyId={companyId}
          currentBalance={currentBalance}
          baselineItems={baselineItems}
          color={color}
        />
      </ScrollView>
    )
  }

  let runningBalance = currentBalance
  const maxAbs = Math.max(
    ...projections.map(p => Math.abs((p.projected_net_cash ?? 0))),
    1
  )

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>SALDO PROYECTADO A 12 MESES</Text>
        <Text style={styles.summaryValue}>
          {formatCurrency(currentBalance + projections.reduce((s, p) => s + (p.projected_net_cash ?? 0), 0))}
        </Text>
      </View>

      {projections.map((p) => {
        runningBalance += p.projected_net_cash ?? 0
        const isPositive = (p.projected_net_cash ?? 0) >= 0
        const barWidth = Math.abs((p.projected_net_cash ?? 0)) / maxAbs

        return (
          <View key={p.id} style={styles.monthRow}>
            <View style={styles.monthHeader}>
              <Text style={styles.monthLabel}>
                {MONTH_NAMES[(p.projection_month - 1) % 12]} {p.projection_year}
              </Text>
              <View style={[styles.healthPill, { backgroundColor: HEALTH_COLOR[p.health_status] + '20' }]}>
                <Text style={[styles.healthText, { color: HEALTH_COLOR[p.health_status] }]}>
                  {HEALTH_LABEL[p.health_status]}
                </Text>
              </View>
            </View>

            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.max(barWidth * 100, 3)}%`,
                    backgroundColor: isPositive ? '#10b981' : '#ef4444',
                  },
                ]}
              />
            </View>

            <View style={styles.monthDetail}>
              <Text style={styles.monthNet}>
                {isPositive ? '+' : ''}{formatCurrency(p.projected_net_cash ?? 0)}
              </Text>
              <Text style={styles.monthBalance}>Saldo est: {formatCurrency(runningBalance)}</Text>
            </View>
          </View>
        )
      })}

      <ScenariosSection
        companyId={companyId}
        currentBalance={currentBalance}
        baselineItems={baselineItems}
        color={color}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 8 },
  centerInline: { justifyContent: 'center', alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyIcon: { fontSize: 40, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#f1f5f9' },
  emptySub: { fontSize: 13, color: '#94a3b8', textAlign: 'center' },

  summaryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  summaryLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
  summaryValue: { color: '#f1f5f9', fontSize: 24, fontWeight: '800' },

  monthRow: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  monthLabel: { color: '#f1f5f9', fontSize: 13, fontWeight: '700' },
  healthPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  healthText: { fontSize: 10, fontWeight: '700' },

  barTrack: { height: 6, backgroundColor: '#0f172a', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  barFill: { height: 6, borderRadius: 3 },

  monthDetail: { flexDirection: 'row', justifyContent: 'space-between' },
  monthNet: { color: '#f1f5f9', fontSize: 13, fontWeight: '700' },
  monthBalance: { color: '#94a3b8', fontSize: 11 },
})
