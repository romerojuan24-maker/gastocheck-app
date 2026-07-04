import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useCobraClients, useCobrador } from '../../hooks/cobra'
import { useRouter } from 'expo-router'
import { formatCurrency } from '@gastocheck/shared'

export default function CobraCheckDashboard() {
  const router = useRouter()
  const { user } = useCobrador()
  const { clients } = useCobraClients(user?.company_id || '')

  const totalCartera = clients.reduce((s, c) => s + c.current_balance, 0)
  const vencidos = clients.filter(c => c.risk_score >= 70).length
  const top5 = [...clients].sort((a, b) => b.current_balance - a.current_balance).slice(0, 5)

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>CobraCheck</Text>
        <Text style={styles.kpi}>{formatCurrency(totalCartera)} por cobrar</Text>
        <Text style={styles.sub}>{vencidos} clientes en riesgo alto</Text>
      </View>

      <View style={styles.quickButtons}>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => router.push('/cobracheck/mi-ruta')}
        >
          <Text style={styles.btnText}>🗺️ Mi Ruta del Día</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => router.push('/cobracheck/historial')}
        >
          <Text style={styles.btnText}>⏰ Historial de Hoy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => router.push('/cobracheck/tareas-diarias')}
        >
          <Text style={styles.btnText}>☎️ Clientes Prioritarios</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => router.push('/cobracheck/clientes')}
        >
          <Text style={styles.btnText}>👥 Directorio de Clientes</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top {top5.length} por Saldo</Text>
        {top5.map(c => (
          <View key={c.id} style={styles.card}>
            <View style={styles.cardLeft}>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.risk}>Riesgo: {c.risk_score}/100</Text>
            </View>
            <Text style={styles.amount}>{formatCurrency(c.current_balance)}</Text>
          </View>
        ))}
        {top5.length === 0 && (
          <Text style={styles.empty}>Sin clientes activos</Text>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { backgroundColor: '#182535', padding: 20, alignItems: 'center' },
  title: { color: '#36BF6A', fontSize: 24, fontWeight: 'bold' },
  kpi: { color: '#f1f5f9', fontSize: 18, marginTop: 8, fontWeight: '700' },
  sub: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
  quickButtons: { gap: 8, padding: 12 },
  btn: { backgroundColor: '#182535', padding: 14, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  btnText: { color: '#36BF6A', fontWeight: 'bold', fontSize: 14 },
  section: { padding: 12 },
  sectionTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 8, color: '#f1f5f9' },
  card: { backgroundColor: '#1e293b', padding: 12, borderRadius: 8, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#36BF6A', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLeft: { flex: 1 },
  name: { fontWeight: '600', color: '#f1f5f9' },
  amount: { fontWeight: 'bold', color: '#36BF6A', fontSize: 15 },
  risk: { fontSize: 12, marginTop: 4, color: '#94a3b8' },
  empty: { color: '#64748b', textAlign: 'center', paddingVertical: 24 },
})
