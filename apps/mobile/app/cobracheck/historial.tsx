import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { useCobrador } from '../../hooks/cobra'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '@gastocheck/shared'

interface HistorialItem {
  id: string
  movement_type: 'collected' | 'not_paid' | 'promise'
  collected_amount?: number
  route_point_ts: string
  client_id: string
}

export default function CobraHistorial() {
  const { user } = useCobrador()
  const today = new Date().toISOString().split('T')[0]
  const [movements, setMovements] = useState<HistorialItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    supabase
      .from('cobra_movements')
      .select('id, movement_type, collected_amount, route_point_ts, client_id')
      .eq('user_id', user.id)
      .gte('route_point_ts', `${today}T00:00:00`)
      .lte('route_point_ts', `${today}T23:59:59`)
      .order('route_point_ts', { ascending: false })
      .then(({ data }) => {
        setMovements((data as HistorialItem[]) ?? [])
        setLoading(false)
      })
  }, [user, today])

  const getIcon = (tipo: string) => {
    if (tipo === 'collected') return '💰'
    if (tipo === 'promise') return '📅'
    return '✕'
  }

  const getLabel = (tipo: string) => {
    if (tipo === 'collected') return 'Cobrado'
    if (tipo === 'promise') return 'Promesa'
    return 'No pagó'
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#36BF6A" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Historial de Hoy ({movements.length})</Text>
      </View>
      {movements.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Sin movimientos registrados hoy</Text>
        </View>
      ) : (
        <FlatList
          data={movements}
          keyExtractor={h => h.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.icon}>{getIcon(item.movement_type)}</Text>
              <View style={styles.info}>
                <Text style={styles.cliente}>{getLabel(item.movement_type)}</Text>
                <Text style={styles.fecha}>
                  {new Date(item.route_point_ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              {item.collected_amount ? (
                <Text style={styles.monto}>{formatCurrency(item.collected_amount)}</Text>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { backgroundColor: '#182535', padding: 16, alignItems: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', padding: 12, marginHorizontal: 12, marginVertical: 6, borderRadius: 8, gap: 12 },
  icon: { fontSize: 20 },
  info: { flex: 1 },
  cliente: { fontWeight: '600', color: '#f1f5f9' },
  fecha: { fontSize: 12, color: '#64748b', marginTop: 2 },
  monto: { fontWeight: 'bold', color: '#36BF6A' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 14 },
})
