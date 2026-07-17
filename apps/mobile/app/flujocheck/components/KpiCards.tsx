import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { formatCurrency, CASH_FLOW_RISK_META } from '@gastocheck/shared'
import type { RiskStatus } from '../types'

interface Props {
  currentBalance: number
  income: number
  expense: number
  projected: number
  risk: RiskStatus
}

export function KpiCards({ currentBalance, income, expense, projected, risk }: Props) {
  const riskMeta = CASH_FLOW_RISK_META[risk]

  return (
    <View style={styles.container}>
      <View style={styles.kpiRow}>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Saldo hoy</Text>
          <Text style={styles.kpiValue}>{formatCurrency(currentBalance)}</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Ingresos</Text>
          <Text style={[styles.kpiValue, styles.incomeValue]}>+{formatCurrency(income)}</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Egresos</Text>
          <Text style={[styles.kpiValue, styles.expenseValue]}>-{formatCurrency(expense)}</Text>
        </View>
      </View>

      <View style={styles.projectionCard}>
        <Text style={styles.projectionLabel}>PROYECCIÓN 7 DÍAS</Text>
        <View style={styles.projectionContent}>
          <Text style={styles.projectionValue}>{formatCurrency(projected)}</Text>
          <Text style={[styles.riskLabel, { color: riskMeta.color }]}>
            {riskMeta.label}
          </Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  kpi: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 10,
  },
  kpiLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  kpiValue: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '700',
  },
  incomeValue: {
    color: '#10b981',
  },
  expenseValue: {
    color: '#ef4444',
  },
  projectionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
  },
  projectionLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  projectionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectionValue: {
    color: '#f1f5f9',
    fontSize: 22,
    fontWeight: '700',
  },
  riskLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
})
