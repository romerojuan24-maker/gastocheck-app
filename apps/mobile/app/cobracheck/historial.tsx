import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'

export default function CobraHistorial() {
  const historial = [
    { id: '1', tipo: 'llamada', cliente: 'Cliente 1', fecha: 'Hoy 10:15', monto: '$2,500' },
    { id: '2', tipo: 'promesa', cliente: 'Cliente 2', fecha: 'Hoy 11:30', monto: '$1,200' },
    { id: '3', tipo: 'pago', cliente: 'Cliente 3', fecha: 'Hoy 14:00', monto: '$500' },
  ]

  const getIcon = (tipo: string) => tipo === 'llamada' ? '☎️' : tipo === 'promesa' ? '📅' : '💰'

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Historial de Hoy</Text>
      </View>
      <FlatList
        data={historial}
        keyExtractor={h => h.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.icon}>{getIcon(item.tipo)}</Text>
            <View style={styles.info}>
              <Text style={styles.cliente}>{item.cliente}</Text>
              <Text style={styles.fecha}>{item.fecha}</Text>
            </View>
            <Text style={styles.monto}>{item.monto}</Text>
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#182535', padding: 16, alignItems: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, marginHorizontal: 12, marginVertical: 6, borderRadius: 8, gap: 12 },
  icon: { fontSize: 20 },
  info: { flex: 1 },
  cliente: { fontWeight: '600', color: '#182535' },
  fecha: { fontSize: 12, color: '#999', marginTop: 2 },
  monto: { fontWeight: 'bold', color: '#36BF6A' },
})
