import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { useCobrador } from '../../hooks/cobra'
import { useRouter } from 'expo-router'
import { formatCurrency } from '@gastocheck/shared'
import { supabase } from '../../lib/supabase'
import { useEffect, useState } from 'react'

interface ClienteRuta {
  id: string
  name: string
  phone?: string
  address?: string
  total_balance: number
  risk_score: number
  invoices_count: number
}

interface Ruta {
  id: string
  clients_assigned: string[]
  total_distance_km?: number
  estimated_duration_hours?: number
  status: 'planned' | 'in_progress' | 'completed'
  route_priority: 'baja' | 'media' | 'alta' | 'crítica'
}

export default function TareasDeHoyPage() {
  const router = useRouter()
  const { user } = useCobrador()
  const [ruta, setRuta] = useState<Ruta | null>(null)
  const [clientes, setClientes] = useState<ClienteRuta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.company_id || !user?.id) return

    ; (async () => {
      const today = new Date().toISOString().split('T')[0]

      // Obtener ruta de hoy
      const { data: rutaData } = await supabase
        .from('cobra_routes')
        .select('*')
        .eq('company_id', user.company_id)
        .eq('actor_id', user.id)
        .eq('assigned_date', today)
        .single()

      if (rutaData) {
        setRuta(rutaData as Ruta)

        // Obtener clientes de la ruta
        const { data: clientesData } = await supabase
          .from('cobra_clients')
          .select('id, name, phone, address, current_balance, risk_score')
          .eq('company_id', user.company_id)
          .in('id', rutaData.clients_assigned || [])

        const mapped = (clientesData || []).map(c => ({
          ...c,
          invoices_count: 0,
          total_balance: c.current_balance,
        }))

        setClientes(mapped)
      }

      setLoading(false)
    })()
  }, [user?.company_id, user?.id])

  const getRiskColor = (score: number) => {
    if (score >= 80) return '#ef4444'
    if (score >= 60) return '#f59e0b'
    return '#36BF6A'
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'crítica': return '#ef4444'
      case 'alta': return '#f59e0b'
      case 'media': return '#3b82f6'
      default: return '#36BF6A'
    }
  }

  const totalBalance = clientes.reduce((s, c) => s + c.total_balance, 0)

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Tareas de Hoy</Text>
        <Text style={styles.subtitle}>Mi Ruta de Cobranza</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando ruta...</Text>
        </View>
      ) : !ruta ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>📋 No hay ruta asignada para hoy</Text>
        </View>
      ) : (
        <>
          {/* Resumen de la ruta */}
          <View style={styles.summary}>
            <View style={[styles.summaryCard, { borderTopColor: getPriorityColor(ruta.route_priority) }]}>
              <Text style={styles.summaryLabel}>Prioridad</Text>
              <Text style={[styles.summaryValue, { color: getPriorityColor(ruta.route_priority) }]}>
                {ruta.route_priority.toUpperCase()}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Clientes</Text>
              <Text style={styles.summaryValue}>{clientes.length}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>A Cobrar</Text>
              <Text style={[styles.summaryValue, { color: '#36BF6A' }]}>{formatCurrency(totalBalance)}</Text>
            </View>
            {ruta.total_distance_km && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Km</Text>
                <Text style={styles.summaryValue}>{ruta.total_distance_km}</Text>
              </View>
            )}
          </View>

          {/* Status de la ruta */}
          <View style={styles.statusSection}>
            <TouchableOpacity
              style={[styles.statusBtn, ruta.status === 'in_progress' && styles.statusBtnActive]}
            >
              <Text style={[styles.statusBtnText, ruta.status === 'in_progress' && styles.statusBtnTextActive]}>
                {ruta.status === 'planned' ? '▶️ Iniciar Ruta' : ruta.status === 'in_progress' ? '🔄 Ruta en Progreso' : '✓ Ruta Completada'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Lista de clientes */}
          <View style={styles.clientsSection}>
            <Text style={styles.clientsTitle}>Clientes a Visitar</Text>
            {clientes.map((cliente, idx) => (
              <View key={cliente.id} style={styles.clientCard}>
                <View style={styles.clientNumber}>
                  <Text style={styles.clientNumberText}>{idx + 1}</Text>
                </View>

                <View style={styles.clientInfo}>
                  <Text style={styles.clientName}>{cliente.name}</Text>
                  {cliente.address && (
                    <Text style={styles.clientAddress}>{cliente.address.split(',')[0]}</Text>
                  )}
                  {cliente.phone && (
                    <Text style={styles.clientPhone}>{cliente.phone}</Text>
                  )}
                </View>

                <View style={styles.clientRight}>
                  <Text style={[styles.clientBalance, { color: getRiskColor(cliente.risk_score) }]}>
                    {formatCurrency(cliente.total_balance)}
                  </Text>
                  <Text style={[styles.clientRisk, { color: getRiskColor(cliente.risk_score) }]}>
                    Riesgo: {cliente.risk_score}%
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Integración con Contador */}
          <View style={styles.integrationNote}>
            <Text style={styles.integrationText}>
              📊 Todos los movimientos se reflejarán en Contador y Flujo Check
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { backgroundColor: '#182535', padding: 16 },
  backBtn: { color: '#36BF6A', fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
  title: { color: '#f1f5f9', fontSize: 20, fontWeight: 'bold' },
  subtitle: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  loadingContainer: { padding: 24, alignItems: 'center' },
  loadingText: { color: '#94a3b8' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 14 },

  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  summaryCard: { flex: 1, minWidth: '48%', backgroundColor: '#1e293b', padding: 12, borderRadius: 8, borderTopWidth: 3, borderTopColor: '#36BF6A' },
  summaryLabel: { color: '#94a3b8', fontSize: 10, marginBottom: 4 },
  summaryValue: { color: '#f1f5f9', fontSize: 16, fontWeight: 'bold' },

  statusSection: { paddingHorizontal: 12, marginVertical: 8 },
  statusBtn: { backgroundColor: '#1e3a0f', padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#36BF6A' },
  statusBtnActive: { backgroundColor: '#36BF6A' },
  statusBtnText: { color: '#36BF6A', fontWeight: 'bold' },
  statusBtnTextActive: { color: '#0f172a' },

  clientsSection: { padding: 12 },
  clientsTitle: { color: '#f1f5f9', fontWeight: 'bold', fontSize: 14, marginBottom: 8 },
  clientCard: { backgroundColor: '#1e293b', padding: 12, borderRadius: 8, marginBottom: 8, flexDirection: 'row', gap: 12, alignItems: 'center' },
  clientNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#36BF6A', justifyContent: 'center', alignItems: 'center' },
  clientNumberText: { color: '#0f172a', fontWeight: 'bold', fontSize: 14 },
  clientInfo: { flex: 1 },
  clientName: { color: '#f1f5f9', fontWeight: 'bold', fontSize: 13 },
  clientAddress: { color: '#94a3b8', fontSize: 10, marginTop: 2 },
  clientPhone: { color: '#94a3b8', fontSize: 10, marginTop: 2 },
  clientRight: { alignItems: 'flex-end' },
  clientBalance: { fontWeight: 'bold', fontSize: 13 },
  clientRisk: { fontSize: 10, marginTop: 2, fontWeight: '600' },

  integrationNote: { backgroundColor: '#1e3a0f', margin: 12, padding: 12, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#36BF6A' },
  integrationText: { color: '#22c55e', fontSize: 11, fontWeight: '600' },
})
