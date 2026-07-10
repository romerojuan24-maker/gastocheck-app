import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { useCobrador } from '../../hooks/cobra'
import { useRouter } from 'expo-router'
import { formatCurrency } from '@gastocheck/shared'
import { supabase } from '../../lib/supabase'
import { useEffect, useState } from 'react'

interface Factura {
  id: string
  folio: string
  client_name: string
  amount: number
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled'
  days_overdue: number
  payment_date?: string
  photo_evidence?: string
}

export default function ComprobantesPage() {
  const router = useRouter()
  const { user } = useCobrador()
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    if (!user?.company_id) return

    ; (async () => {
      const { data } = await supabase
        .from('cobra_invoices')
        .select(`
          id,
          folio,
          amount,
          status,
          days_overdue,
          payment_date,
          cobra_clients(name),
          cobra_movements(photo_uri)
        `)
        .eq('company_id', user.company_id)
        .order('updated_at', { ascending: false })

      const mapped = (data || []).map((f: any) => ({
        id: f.id,
        folio: f.folio,
        client_name: f.cobra_clients?.name || 'Desconocido',
        amount: f.amount,
        status: f.status,
        days_overdue: f.days_overdue,
        payment_date: f.payment_date,
        photo_evidence: f.cobra_movements?.[0]?.photo_uri,
      }))

      setFacturas(mapped)
      setLoading(false)
    })()
  }, [user?.company_id])

  const filtered = filterStatus === 'all' ? facturas : facturas.filter(f => f.status === filterStatus)

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid': return '✓ Pagada'
      case 'partial': return '⊘ Parcial'
      case 'pending': return '○ Pendiente'
      case 'overdue': return '🔴 Vencida'
      case 'cancelled': return '✕ Cancelada'
      default: return status
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Relación de Facturas</Text>
        <Text style={styles.sub}>{filtered.length} de {facturas.length} facturas</Text>
      </View>

      {/* Filtros */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
        {['all', 'pending', 'partial', 'overdue', 'paid', 'cancelled'].map(status => (
          <TouchableOpacity
            key={status}
            style={[styles.filterBtn, filterStatus === status && styles.filterBtnActive]}
            onPress={() => setFilterStatus(status)}
          >
            <Text style={[styles.filterBtnText, filterStatus === status && styles.filterBtnTextActive]}>
              {status === 'all' ? 'Todas' : getStatusLabel(status).split(' ')[1] || status}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Sin facturas en este estado</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map(f => (
            <View key={f.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <Text style={styles.folio}>{f.folio}</Text>
                  <Text style={styles.client}>{f.client_name}</Text>
                </View>
                <Text style={styles.amount}>{formatCurrency(f.amount)}</Text>
              </View>

              <View style={styles.cardMid}>
                <Text style={[styles.status, { color: getStatusColor(f.status) }]}>
                  {getStatusLabel(f.status)}
                </Text>
                {f.days_overdue > 0 && (
                  <Text style={styles.overdue}>{f.days_overdue}d vencida</Text>
                )}
              </View>

              <View style={styles.cardBottom}>
                {f.photo_evidence ? (
                  <View style={styles.photoEvidenceBox}>
                    <Text style={styles.photoLabel}>📸 Con comprobante</Text>
                  </View>
                ) : f.status === 'paid' ? (
                  <View style={styles.photoMissingBox}>
                    <Text style={styles.photoMissingLabel}>⚠️ Sin foto</Text>
                  </View>
                ) : null}
                <TouchableOpacity style={styles.detailBtn}>
                  <Text style={styles.detailBtnText}>Ver detalle →</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'paid': return '#22c55e'
    case 'partial': return '#3b82f6'
    case 'pending': return '#f59e0b'
    case 'overdue': return '#ef4444'
    case 'cancelled': return '#64748b'
    default: return '#f1f5f9'
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { backgroundColor: '#182535', padding: 16 },
  backBtn: { color: '#36BF6A', fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
  title: { color: '#f1f5f9', fontSize: 20, fontWeight: 'bold' },
  sub: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  filters: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  filterBtnActive: { backgroundColor: '#36BF6A', borderColor: '#36BF6A' },
  filterBtnText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  filterBtnTextActive: { color: '#0f172a', fontWeight: 'bold' },
  loadingContainer: { padding: 24, alignItems: 'center' },
  loadingText: { color: '#94a3b8' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#94a3b8' },
  list: { padding: 12 },
  card: { backgroundColor: '#1e293b', padding: 12, borderRadius: 8, marginBottom: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardLeft: { flex: 1 },
  folio: { fontWeight: 'bold', color: '#f1f5f9', fontSize: 13 },
  client: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  amount: { fontWeight: 'bold', color: '#f1f5f9', fontSize: 14 },
  cardMid: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  status: { fontSize: 11, fontWeight: '600' },
  overdue: { fontSize: 10, color: '#ef4444', fontWeight: 'bold' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  photoEvidenceBox: { backgroundColor: '#1e3a0f', padding: 6, borderRadius: 4, flex: 1 },
  photoLabel: { color: '#22c55e', fontSize: 10, fontWeight: 'bold' },
  photoMissingBox: { backgroundColor: '#3f0f0f', padding: 6, borderRadius: 4, flex: 1 },
  photoMissingLabel: { color: '#ef4444', fontSize: 10, fontWeight: 'bold' },
  detailBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  detailBtnText: { color: '#36BF6A', fontSize: 10, fontWeight: 'bold' },
})
