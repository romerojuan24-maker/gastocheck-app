import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { useCobraClients, useCobrador } from '../../hooks/cobra'
import { useRouter } from 'expo-router'
import { formatCurrency } from '@gastocheck/shared'
import { supabase } from '../../lib/supabase'
import { useEffect, useState } from 'react'

interface FacturaPendiente {
  id: string
  folio: string
  client_id: string
  client_name: string
  amount: number
  days_overdue: number
  status: 'pending' | 'partial' | 'overdue'
  due_date: string
}

export default function CarteraTotalPage() {
  const router = useRouter()
  const { user } = useCobrador()
  const { clients } = useCobraClients(user?.company_id || '')
  const [facturas, setFacturas] = useState<FacturaPendiente[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.company_id) return

    ; (async () => {
      const { data } = await supabase
        .from('cobra_invoices')
        .select(`
          id,
          folio,
          client_id,
          amount,
          days_overdue,
          status,
          due_date,
          cobra_clients(name)
        `)
        .eq('company_id', user.company_id)
        .in('status', ['pending', 'partial', 'overdue'])
        .order('days_overdue', { ascending: false })

      const mapped = (data || []).map((f: any) => ({
        id: f.id,
        folio: f.folio,
        client_id: f.client_id,
        client_name: f.cobra_clients?.name || 'Desconocido',
        amount: f.amount,
        days_overdue: f.days_overdue,
        status: f.status,
        due_date: f.due_date,
      }))

      setFacturas(mapped)
      setLoading(false)
    })()
  }, [user?.company_id])

  const totalCartera = facturas.reduce((s, f) => s + f.amount, 0)
  const vencidas = facturas.filter(f => f.status === 'overdue').length

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'overdue': return '#ef4444'
      case 'partial': return '#3b82f6'
      default: return '#f59e0b'
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Cartera Total</Text>
        <Text style={styles.kpi}>{formatCurrency(totalCartera)}</Text>
        <Text style={styles.sub}>{vencidas} vencidas • {facturas.length} facturas</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando facturas...</Text>
        </View>
      ) : facturas.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>✓ No hay facturas pendientes</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {facturas.map(f => (
            <View key={f.id} style={[styles.card, { borderLeftColor: getStatusColor(f.status) }]}>
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <Text style={styles.folio}>{f.folio}</Text>
                  <Text style={styles.client}>{f.client_name}</Text>
                </View>
                <Text style={[styles.amount, { color: getStatusColor(f.status) }]}>
                  {formatCurrency(f.amount)}
                </Text>
              </View>
              <View style={styles.cardBottom}>
                <Text style={[styles.status, { color: getStatusColor(f.status) }]}>
                  {f.status === 'overdue' ? `🔴 Vencida ${f.days_overdue}d` : f.status === 'partial' ? '🔵 Parcial' : '🟡 Pendiente'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { backgroundColor: '#182535', padding: 16, paddingTop: 12 },
  backBtn: { color: '#36BF6A', fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
  title: { color: '#f1f5f9', fontSize: 20, fontWeight: 'bold' },
  kpi: { color: '#36BF6A', fontSize: 24, marginTop: 8, fontWeight: '800' },
  sub: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  loadingContainer: { padding: 24, alignItems: 'center' },
  loadingText: { color: '#94a3b8' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#36BF6A', fontSize: 14 },
  list: { padding: 12 },
  card: { backgroundColor: '#1e293b', padding: 12, borderRadius: 8, marginBottom: 8, borderLeftWidth: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardLeft: { flex: 1 },
  folio: { fontWeight: 'bold', color: '#f1f5f9', fontSize: 13 },
  client: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  amount: { fontWeight: 'bold', fontSize: 15 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { fontSize: 11, fontWeight: '600' },
})
