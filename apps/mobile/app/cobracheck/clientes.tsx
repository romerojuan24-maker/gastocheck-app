import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { useCobraClients, useCobrador } from '../hooks/cobra'

export default function CobraClientes() {
  const { user } = useCobrador()
  const { clients } = useCobraClients(user?.company_id || '')

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Clientes ({clients.length})</Text>
      </View>
      <FlatList
        data={clients}
        keyExtractor={c => c.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card}>
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.rfc}>{item.rfc}</Text>
            </View>
            <View style={styles.right}>
              <Text style={styles.amount}>${item.current_balance.toLocaleString('es-MX')}</Text>
              <Text style={styles.score}>Score: {item.risk_score}</Text>
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
  card: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 12, marginHorizontal: 12, marginVertical: 6, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#36BF6A' },
  info: { flex: 1 },
  name: { fontWeight: '600', color: '#182535' },
  rfc: { fontSize: 12, color: '#999', marginTop: 2 },
  right: { alignItems: 'flex-end' },
  amount: { fontWeight: 'bold', color: '#36BF6A' },
  score: { fontSize: 12, color: '#999', marginTop: 2 },
})
