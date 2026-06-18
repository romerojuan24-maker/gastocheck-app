import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useCobraClients } from '../../hooks/cobra'
import { useCobrador } from '../../hooks/cobra'

export default function CobraCheckDashboard() {
  const { user } = useCobrador()
  const { clients } = useCobraClients(user?.company_id || '')

  const totalCartera = clients.reduce((s, c) => s + c.current_balance, 0)
  const vencidos = clients.filter(c => c.risk_score >= 70).length

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>CobraCheck</Text>
        <Text style={styles.kpi}>${(totalCartera / 1000).toFixed(1)}k por cobrar</Text>
      </View>

      <View style={styles.quickButtons}>
        <TouchableOpacity style={styles.btn}>
          <Text style={styles.btnText}>📋 Contactar Hoy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn}>
          <Text style={styles.btnText}>⏰ Promesas Vencidas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn}>
          <Text style={styles.btnText}>☎️ Llamadas Pendientes</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top {Math.min(5, clients.length)} Vencidos</Text>
        {clients.slice(0, 5).map(c => (
          <View key={c.id} style={styles.card}>
            <Text style={styles.name}>{c.name}</Text>
            <Text style={styles.amount}>${c.current_balance.toLocaleString('es-MX')}</Text>
            <Text style={styles.risk}>⚠️ {c.risk_score}/100</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#182535', padding: 20, alignItems: 'center' },
  title: { color: '#36BF6A', fontSize: 24, fontWeight: 'bold' },
  kpi: { color: '#fff', fontSize: 18, marginTop: 8 },
  quickButtons: { gap: 8, padding: 12 },
  btn: { backgroundColor: '#36BF6A', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  section: { padding: 12 },
  sectionTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 8 },
  card: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#36BF6A' },
  name: { fontWeight: '600', color: '#182535' },
  amount: { fontWeight: 'bold', color: '#36BF6A', marginTop: 4 },
  risk: { fontSize: 12, marginTop: 4 },
})
