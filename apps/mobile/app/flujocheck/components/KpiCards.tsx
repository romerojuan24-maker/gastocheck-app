import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { formatCurrency, CASH_FLOW_RISK_META } from '@gastocheck/shared'

interface Props {
  currentBalance: number
  income: number
  expense: number
  projected: number
  risk: 'green' | 'yellow' | 'red'
}

export function KpiCards({ currentBalance, income, expense, projected, risk }: Props) {
  const riskMeta = CASH_FLOW_RISK_META[risk]

  return (
    <View style={styles.container}>
      <View style={styles.kpiRow}>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Saldo anterior</Text>
          <Text style={styles.kpiValue}>{formatCurrency(currentBalance)}</Text>
          <Text style={styles.kpiHint}>en bancos hoy</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Ingresos</Text>
          <Text style={[styles.kpiValue, styles.incomeValue]}>+{formatCurrency(income)}</Text>
          <Text style={styles.kpiHint}>por cobrar</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Egresos</Text>
          <Text style={[styles.kpiValue, styles.expenseValue]}>-{formatCurrency(expense)}</Text>
          <Text style={styles.kpiHint}>por pagar</Text>
        </View>
      </View>

      <View style={styles.projectionCard}>
        <Text style={styles.projectionLabel}>SALDO FINAL · PROYECTADO 7 DÍAS</Text>
        <View style={styles.projectionContent}>
          <Text style={styles.projectionValue}>{formatCurrency(projected)}</Text>
          <Text style={[styles.riskLabel, { color: riskMeta.color }]}>
            {riskMeta.label}
          </Text>
        </View>
        <Text style={styles.formula}>
          Saldo anterior {formatCurrency(currentBalance)} + Ingresos {formatCurrency(income)} − Egresos {formatCurrency(expense)}
        </Text>
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
  kpiHint: {
    color: '#64748b',
    fontSize: 9,
    marginTop: 2,
  },
  formula: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    marginTop: 8,
    textAlign: 'center',
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
