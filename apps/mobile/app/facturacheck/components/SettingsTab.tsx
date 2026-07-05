import React from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native'
import { formatCurrency } from '@gastocheck/shared'
import { useCFDICredit, usePacProviderConfig } from '../hooks'

interface Props {
  companyId: string
  color: string
}

const PLAN_LABEL: Record<string, string> = {
  fixed: 'Plan fijo mensual',
  payperuse: 'Pago por uso',
  hybrid: 'Híbrido',
}

export function SettingsTab({ companyId, color }: Props) {
  const { credit, loading, refetch } = useCFDICredit(companyId)
  const { config: pacConfig, loading: pacLoading } = usePacProviderConfig(companyId)

  if (loading || !credit) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={color} />
      </View>
    )
  }

  const remaining = credit.total_balance - credit.consumed_this_month
  const usagePercent = credit.total_balance > 0
    ? Math.min(100, (credit.consumed_this_month / credit.total_balance) * 100)
    : 0

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Créditos de facturación</Text>
        <Text style={styles.planLabel}>{PLAN_LABEL[credit.credit_plan] || credit.credit_plan}</Text>

        <View style={styles.usageBar}>
          <View style={[styles.usageFill, { width: `${usagePercent}%`, backgroundColor: color }]} />
        </View>

        <View style={styles.usageRow}>
          <View>
            <Text style={styles.usageLabel}>Consumido este mes</Text>
            <Text style={styles.usageValue}>{formatCurrency(credit.consumed_this_month)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.usageLabel}>Disponible</Text>
            <Text style={[styles.usageValue, { color: remaining > 0 ? '#10b981' : '#ef4444' }]}>
              {formatCurrency(remaining)}
            </Text>
          </View>
        </View>

        {credit.overage_allowed && (
          <Text style={styles.overageNote}>
            Sobrecupo permitido hasta {credit.overage_percentage}% adicional
          </Text>
        )}

        <TouchableOpacity style={[styles.rechargeButton, { borderColor: color }]} onPress={refetch}>
          <Text style={[styles.rechargeButtonText, { color }]}>🔄 Actualizar saldo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Proveedor de timbrado (PAC)</Text>
        <Text style={styles.sectionSub}>
          Configura las credenciales de tu PAC para timbrar facturas automáticamente.
        </Text>
        <View style={styles.pacRow}>
          {pacLoading ? (
            <ActivityIndicator size="small" color={color} />
          ) : pacConfig ? (
            <>
              <Text style={[styles.pacStatus, { color: pacConfig.is_active ? '#10b981' : '#94A3B8' }]}>
                {pacConfig.is_active ? '🟢' : '⚪'} {pacConfig.provider.toUpperCase()}
                {pacConfig.mode === 'sandbox' ? ' (pruebas)' : ''}
              </Text>
              <Text style={styles.pacSub}>{pacConfig.razon_social || pacConfig.rfc}</Text>
            </>
          ) : (
            <Text style={styles.pacStatus}>⚪ No configurado</Text>
          )}
        </View>
        <TouchableOpacity style={[styles.configButton, { backgroundColor: color }]}>
          <Text style={styles.configButtonText}>{pacConfig ? 'Actualizar PAC' : 'Configurar PAC'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Plantillas de envío</Text>
        <Text style={styles.sectionSub}>
          Personaliza los mensajes de correo y WhatsApp usados al distribuir facturas.
        </Text>
        <TouchableOpacity style={[styles.linkRow]}>
          <Text style={styles.linkText}>📧 Plantilla de correo</Text>
          <Text style={styles.linkArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.linkRow]}>
          <Text style={styles.linkText}>💬 Plantilla de WhatsApp</Text>
          <Text style={styles.linkArrow}>›</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  section: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  sectionSub: { fontSize: 12, color: '#94A3B8', marginBottom: 12, lineHeight: 17 },
  planLabel: { fontSize: 13, color: '#64748B', marginBottom: 12 },

  usageBar: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  usageFill: { height: 8, borderRadius: 4 },

  usageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  usageLabel: { fontSize: 10, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 2 },
  usageValue: { fontSize: 16, fontWeight: '700', color: '#0F172A' },

  overageNote: { fontSize: 11, color: '#94A3B8', marginBottom: 12 },

  rechargeButton: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  rechargeButtonText: { fontSize: 13, fontWeight: '700' },

  pacRow: { marginBottom: 12 },
  pacStatus: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  pacSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  configButton: { borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  configButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  linkRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  linkText: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  linkArrow: { fontSize: 18, color: '#CBD5E1' },
})
