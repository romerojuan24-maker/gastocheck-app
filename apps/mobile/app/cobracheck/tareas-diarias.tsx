import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { useCobraClients } from '../../hooks/cobra'
import { useCobrador } from '../../hooks/cobra'

export default function TareasDiarias() {
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
          <TouchableOpacity style={styles.card}>
            <View style={styles.left}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.balance}>${item.current_balance.toLocaleString('es-MX')}</Text>
            </View>
            <View style={styles.right}>
              <TouchableOpacity style={styles.swipeBtn}><Text style={styles.swipeBtnText}>→ ✓</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#182535', padding: 16, alignItems: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 12, marginHorizontal: 12, marginVertical: 6, borderRadius: 8 },
  left: { flex: 1 },
  name: { fontWeight: '600', color: '#182535' },
  balance: { fontWeight: 'bold', color: '#36BF6A', marginTop: 4 },
  right: { gap: 8 },
  swipeBtn: { backgroundColor: '#36BF6A', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  swipeBtnText: { color: '#fff', fontWeight: 'bold' },
})
