import { View, Text, ScrollView } from 'react-native'

export default function DashboardScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: '#1e293b', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Dashboard Unificado</Text>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
        <View style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 12, padding: 16, borderLeftWidth: 4, borderLeftColor: '#10b981' }}>
          <Text style={{ color: '#64748b', fontSize: 11 }}>Cobrado Hoy</Text>
          <Text style={{ color: '#10b981', fontSize: 18, fontWeight: 'bold' }}>$18,500</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 12, padding: 16, borderLeftWidth: 4, borderLeftColor: '#f59e0b' }}>
          <Text style={{ color: '#64748b', fontSize: 11 }}>Promesas</Text>
          <Text style={{ color: '#f59e0b', fontSize: 18, fontWeight: 'bold' }}>$28,000</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 12, padding: 16, borderLeftWidth: 4, borderLeftColor: '#ef4444' }}>
          <Text style={{ color: '#64748b', fontSize: 11 }}>Sin Pagar</Text>
          <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: 'bold' }}>$12,300</Text>
        </View>
      </View>

      <View style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: 16 }}>
        <Text style={{ color: '#1e293b', fontSize: 14, fontWeight: '600', marginBottom: 12 }}>Resumen de Módulos</Text>
        {['Mi Ruta', 'FlujoCheck', 'BancoCheck', 'FacturaCheck'].map((m, i) => (
          <View key={i} style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: i < 3 ? 1 : 0, borderBottomColor: '#e2e8f0', justifyContent: 'space-between' }}>
            <Text style={{ color: '#1e293b' }}>{m}</Text>
            <Text style={{ color: '#10b981', fontWeight: '600' }}>✓ Activo</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}
