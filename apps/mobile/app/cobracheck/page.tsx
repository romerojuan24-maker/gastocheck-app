import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useCobraClients, useCobrador } from '../../hooks/cobra'
import { useRouter } from 'expo-router'
import { formatCurrency } from '@gastocheck/shared'
import { supabase } from '../../lib/supabase'
import { useEffect, useState } from 'react'

export default function CobraCheckDashboard() {
  const router = useRouter()
  const { user } = useCobrador()
  const { clients } = useCobraClients(user?.company_id || '')
  const [facturasVencidas, setFacturasVencidas] = useState(0)
  const [clientesEnRiesgo, setClientesEnRiesgo] = useState(0)

  useEffect(() => {
    if (!user?.company_id) return

    ; (async () => {
      // Facturas vencidas
      const { count: vencidas } = await supabase
        .from('cobra_invoices')
        .select('*', { count: 'exact' })
        .eq('company_id', user.company_id)
        .eq('status', 'overdue')

      // Clientes en riesgo (risk_score >= 70)
      const { count: riesgo } = await supabase
        .from('cobra_clients')
        .select('*', { count: 'exact' })
        .eq('company_id', user.company_id)
        .gte('risk_score', 70)

      setFacturasVencidas(vencidas || 0)
      setClientesEnRiesgo(riesgo || 0)
    })()
  }, [user?.company_id])

  const totalCartera = clients.reduce((s, c) => s + c.current_balance, 0)

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>CobraCheck</Text>
        <Text style={styles.kpi}>{formatCurrency(totalCartera)}</Text>
        <Text style={styles.sub}>por cobrar • {clientesEnRiesgo} en riesgo</Text>
      </View>

      {/* 4 Botones Principales */}
      <View style={styles.mainButtons}>
        {/* CARTERA TOTAL */}
        <TouchableOpacity
          style={[styles.mainBtn, styles.mainBtnCartera]}
          onPress={() => router.push('/cobracheck/cartera-total')}
        >
          <Text style={styles.mainBtnEmoji}>💰</Text>
          <Text style={styles.mainBtnTitle}>CARTERA TOTAL</Text>
          <Text style={styles.mainBtnValue}>{formatCurrency(totalCartera)}</Text>
          <Text style={styles.mainBtnSub}>{clients.length} clientes</Text>
        </TouchableOpacity>

        {/* COMPROBANTES */}
        <TouchableOpacity
          style={[styles.mainBtn, styles.mainBtnComprobantes]}
          onPress={() => router.push('/cobracheck/comprobantes')}
        >
          <Text style={styles.mainBtnEmoji}>📄</Text>
          <Text style={styles.mainBtnTitle}>COMPROBANTES</Text>
          <Text style={styles.mainBtnValue}>{facturasVencidas}</Text>
          <Text style={styles.mainBtnSub}>facturas vencidas</Text>
        </TouchableOpacity>

        {/* TAREAS DE HOY */}
        <TouchableOpacity
          style={[styles.mainBtn, styles.mainBtnTareas]}
          onPress={() => router.push('/cobracheck/tareas-de-hoy')}
        >
          <Text style={styles.mainBtnEmoji}>📋</Text>
          <Text style={styles.mainBtnTitle}>TAREAS DE HOY</Text>
          <Text style={styles.mainBtnValue}>Mi Ruta</Text>
          <Text style={styles.mainBtnSub}>cobranza de hoy</Text>
        </TouchableOpacity>

        {/* PAGOS */}
        <TouchableOpacity
          style={[styles.mainBtn, styles.mainBtnPagos]}
          onPress={() => router.push('/cobracheck/pagos')}
        >
          <Text style={styles.mainBtnEmoji}>💳</Text>
          <Text style={styles.mainBtnTitle}>PAGOS</Text>
          <Text style={styles.mainBtnValue}>Registrar</Text>
          <Text style={styles.mainBtnSub}>movimientos</Text>
        </TouchableOpacity>
      </View>

      {/* Clientes en Riesgo */}
      {clientesEnRiesgo > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ {clientesEnRiesgo} Clientes en Riesgo</Text>
          {clients
            .filter(c => c.risk_score >= 70)
            .sort((a, b) => b.risk_score - a.risk_score)
            .slice(0, 5)
            .map(c => (
              <View key={c.id} style={styles.riskCard}>
                <View style={styles.riskCardLeft}>
                  <Text style={styles.name}>{c.name}</Text>
                  <Text style={styles.riskBadge}>⚠️ Riesgo: {c.risk_score}/100</Text>
                </View>
                <Text style={styles.riskAmount}>{formatCurrency(c.current_balance)}</Text>
              </View>
            ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { backgroundColor: '#182535', padding: 20, alignItems: 'center' },
  title: { color: '#36BF6A', fontSize: 24, fontWeight: 'bold' },
  kpi: { color: '#f1f5f9', fontSize: 28, marginTop: 12, fontWeight: '800' },
  sub: { color: '#94a3b8', fontSize: 13, marginTop: 4 },

  mainButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 12,
    justifyContent: 'space-between',
  },
  mainBtn: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  mainBtnCartera: { backgroundColor: '#1e3a0f', borderColor: '#22c55e' },
  mainBtnComprobantes: { backgroundColor: '#3f0f0f', borderColor: '#ef4444' },
  mainBtnTareas: { backgroundColor: '#1e3a5f', borderColor: '#3b82f6' },
  mainBtnPagos: { backgroundColor: '#4c0f2a', borderColor: '#ec4899' },
  mainBtnEmoji: { fontSize: 32, marginBottom: 8 },
  mainBtnTitle: { fontSize: 12, fontWeight: 'bold', color: '#f1f5f9', textAlign: 'center' },
  mainBtnValue: { fontSize: 16, fontWeight: '800', color: '#f1f5f9', marginTop: 4, textAlign: 'center' },
  mainBtnSub: { fontSize: 10, color: '#94a3b8', marginTop: 2, textAlign: 'center' },

  section: { padding: 12 },
  sectionTitle: { fontWeight: 'bold', fontSize: 14, marginBottom: 8, color: '#ef4444' },
  riskCard: { backgroundColor: '#3f0f0f', padding: 12, borderRadius: 8, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#ef4444', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  riskCardLeft: { flex: 1 },
  name: { fontWeight: '600', color: '#f1f5f9' },
  riskBadge: { fontSize: 11, marginTop: 4, color: '#ef4444', fontWeight: 'bold' },
  riskAmount: { fontWeight: 'bold', color: '#ef4444', fontSize: 14 },
})
