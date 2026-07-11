// Relación de Cuentas por Cobrar — cartera pendiente, filtrable por
// cliente o rango de fecha de vencimiento.
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native'
import { useCobraClients, useCobrador } from '../../hooks/cobra'
import { useRouter } from 'expo-router'
import { formatCurrency, BRAND } from '@gastocheck/shared'
import { supabase } from '../../lib/supabase'
import { useEffect, useState, useMemo } from 'react'
import DatePickerField from '../../components/DatePickerField'

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

  const [showClientFilter, setShowClientFilter] = useState(false)
  const [clientFilter, setClientFilter] = useState<string | null>(null)
  const [dueFrom, setDueFrom] = useState('')
  const [dueTo, setDueTo] = useState('')

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

  const filtered = useMemo(() => {
    return facturas.filter(f => {
      if (clientFilter && f.client_id !== clientFilter) return false
      if (dueFrom && f.due_date < dueFrom) return false
      if (dueTo && f.due_date > dueTo) return false
      return true
    })
  }, [facturas, clientFilter, dueFrom, dueTo])

  const totalCartera = filtered.reduce((s, f) => s + f.amount, 0)
  const vencidas = filtered.filter(f => f.status === 'overdue').length
  const clientFilterName = clientFilter ? clients.find(c => c.id === clientFilter)?.name : null
  const hasFilters = !!clientFilter || !!dueFrom || !!dueTo

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
        <Text style={styles.title}>Relación CxC</Text>
        <Text style={styles.kpi}>{formatCurrency(totalCartera)}</Text>
        <Text style={styles.sub}>{vencidas} vencidas • {filtered.length} facturas</Text>
      </View>

      {/* Filtros */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterChip, clientFilter && styles.filterChipActive]}
          onPress={() => setShowClientFilter(true)}
        >
          <Text style={[styles.filterChipText, clientFilter && styles.filterChipTextActive]} numberOfLines={1}>
            👤 {clientFilterName ?? 'Cliente'}
          </Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <DatePickerField label="Vence desde" value={dueFrom} onChange={setDueFrom} style={styles.dateField as object} />
        </View>
        <View style={{ flex: 1 }}>
          <DatePickerField label="Vence hasta" value={dueTo} onChange={setDueTo} style={styles.dateField as object} />
        </View>
      </View>
      {hasFilters && (
        <TouchableOpacity
          style={styles.clearFilters}
          onPress={() => { setClientFilter(null); setDueFrom(''); setDueTo('') }}
        >
          <Text style={styles.clearFiltersText}>✕ Quitar filtros</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando facturas...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{hasFilters ? 'Sin resultados para este filtro' : '✓ No hay facturas pendientes'}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map(f => (
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
                <Text style={styles.dueDate}>Vence {f.due_date}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Modal filtro de cliente */}
      <Modal visible={showClientFilter} animationType="slide" transparent onRequestClose={() => setShowClientFilter(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Filtrar por cliente</Text>
            <TouchableOpacity style={styles.clientRow} onPress={() => { setClientFilter(null); setShowClientFilter(false) }}>
              <Text style={styles.clientRowText}>Todos los clientes</Text>
              {!clientFilter && <Text style={{ color: BRAND.cobra }}>✓</Text>}
            </TouchableOpacity>
            <FlatList
              data={clients}
              keyExtractor={c => c.id}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.clientRow}
                  onPress={() => { setClientFilter(item.id); setShowClientFilter(false) }}
                >
                  <Text style={styles.clientRowText}>{item.name}</Text>
                  {clientFilter === item.id && <Text style={{ color: BRAND.cobra }}>✓</Text>}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowClientFilter(false)}>
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  filterBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 12, alignItems: 'flex-end' },
  filterChip: { backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#334155', maxWidth: 110 },
  filterChipActive: { borderColor: '#36BF6A', backgroundColor: '#1e3a0f' },
  filterChipText: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  filterChipTextActive: { color: '#36BF6A' },
  dateField: { backgroundColor: '#1e293b' },
  clearFilters: { alignSelf: 'flex-end', marginRight: 12, marginTop: 6 },
  clearFiltersText: { color: '#ef4444', fontSize: 11, fontWeight: '700' },

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
  dueDate: { fontSize: 10, color: '#64748b' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#182535', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalTitle: { color: '#f1f5f9', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  clientRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
  clientRowText: { color: '#f1f5f9', fontSize: 14 },
  modalCloseBtn: { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  modalCloseText: { color: '#94a3b8', fontWeight: '700' },
})
