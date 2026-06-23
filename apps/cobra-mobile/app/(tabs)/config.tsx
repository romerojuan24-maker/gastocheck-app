import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { LogOut, User, Building2 } from 'lucide-react-native'

export default function ConfigScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ padding: 16 }}>
      <View style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ width: 48, height: 48, backgroundColor: '#10b981', borderRadius: 24, justifyContent: 'center', alignItems: 'center' }}>
            <User size={24} color="#fff" />
          </View>
          <View>
            <Text style={{ color: '#1e293b', fontSize: 14, fontWeight: '600' }}>Juan Díaz Rodríguez</Text>
            <Text style={{ color: '#64748b', fontSize: 12 }}>Cobrador • Empresa ACME</Text>
          </View>
        </View>
      </View>

      <View style={{ backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
        <TouchableOpacity style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#1e293b', fontWeight: '500' }}>Empresa</Text>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>ACME Corp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#1e293b', fontWeight: '500' }}>Versión</Text>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>1.0.0</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#1e293b', fontWeight: '500' }}>Acerca de</Text>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>Ver detalles</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={{ backgroundColor: '#ef4444', borderRadius: 8, padding: 14, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
        <LogOut size={20} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '600' }}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
