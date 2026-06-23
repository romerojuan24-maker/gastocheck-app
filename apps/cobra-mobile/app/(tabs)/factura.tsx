import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { Plus, AlertCircle } from 'lucide-react-native'

export default function FacturaScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ padding: 16 }}>
      <View style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <View>
            <Text style={{ color: '#64748b', fontSize: 12 }}>Facturas Timbradas (Mes)</Text>
            <Text style={{ color: '#1e293b', fontSize: 24, fontWeight: 'bold' }}>12</Text>
          </View>
          <View>
            <Text style={{ color: '#64748b', fontSize: 12 }}>Valor Total</Text>
            <Text style={{ color: '#10b981', fontSize: 20, fontWeight: 'bold' }}>$185,000</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={{ backgroundColor: '#10b981', borderRadius: 8, padding: 16, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
      >
        <Plus size={20} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '600' }}>Crear Factura</Text>
      </TouchableOpacity>

      <View style={{ marginTop: 20, backgroundColor: '#fef3c7', borderRadius: 8, padding: 12, flexDirection: 'row', gap: 8 }}>
        <AlertCircle size={20} color="#b45309" />
        <Text style={{ color: '#92400e', flex: 1, fontSize: 12 }}>FacturaCheck: Timbrado CFDI con validación SAT integrada</Text>
      </View>
    </ScrollView>
  )
}
