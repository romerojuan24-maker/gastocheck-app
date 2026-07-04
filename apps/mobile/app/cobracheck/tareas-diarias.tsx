import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useCobraClients, useCobrador } from '../../hooks/cobra'
import { useRouter } from 'expo-router'

export default function TareasDiarias() {
  const router = useRouter()
  const { user } = useCobrador()
  const { clients } = useCobraClients(user?.company_id || '')
  const tareas = clients.filter(c => c.risk_score >= 70).slice(0, 10)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tareas Hoy ({tareas.length})</Text>
      </View>
      <FlatList
        data={tareas}
        keyExtractor={t => t.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/cobracheck/mi-ruta')}
          >
            <View style={styles.left}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.balance}>${item.current_balance.toLocaleString('es-MX')}</Text>
            </View>
            <View style={styles.right}>
              <View style={styles.swipeBtn}><Text style={styles.swipeBtnText}>→ ✓</Text></View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { backgroundColor: '#182535', padding: 16, alignItems: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', padding: 12, marginHorizontal: 12, marginVertical: 6, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#36BF6A' },
  left: { flex: 1 },
  name: { fontWeight: '600', color: '#f1f5f9' },
  balance: { fontWeight: 'bold', color: '#36BF6A', marginTop: 4 },
  right: { gap: 8 },
  swipeBtn: { backgroundColor: '#36BF6A', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  swipeBtnText: { color: '#0f172a', fontWeight: 'bold' },
})
