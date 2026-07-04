import React from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
} from 'react-native'
import { formatCurrency } from '@gastocheck/shared'
import type { RouteClient } from '../types'

interface RouteListProps {
  clients: RouteClient[]
  onSelectClient: (client: RouteClient) => void
  loading: boolean
}

export function RouteList({ clients, onSelectClient, loading }: RouteListProps) {
  const { height } = Dimensions.get('window')

  if (loading) {
    return (
      <View style={[styles.centerContainer, { height: height * 0.5 }]}>
        <ActivityIndicator size="large" color="#36BF6A" />
      </View>
    )
  }

  if (clients.length === 0) {
    return (
      <View style={[styles.centerContainer, { height: height * 0.5 }]}>
        <Text style={styles.emptyText}>No hay clientes asignados hoy</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={clients}
      keyExtractor={(item) => item.id}
      scrollEnabled={false}
      renderItem={({ item, index }) => (
        <TouchableOpacity
          style={[
            styles.routeCard,
            item.status === 'completed' && styles.routeCardCompleted,
          ]}
          onPress={() => onSelectClient(item)}
        >
          <View style={styles.routeSequence}>
            <Text style={styles.routeNumber}>{index + 1}</Text>
          </View>

          <View style={styles.routeInfo}>
            <Text style={styles.routeName}>{item.name}</Text>
            {item.address && (
              <Text style={styles.routeAddress} numberOfLines={1}>
                📍 {item.address}
              </Text>
            )}
            {item.office_hours && (
              <Text style={styles.routeHours}>⏰ {item.office_hours}</Text>
            )}
            <View style={styles.routeMeta}>
              <Text style={styles.metaText}>
                {item.invoices_count} recibos
              </Text>
              <Text style={styles.metaText}>
                {formatCurrency(item.total_amount)}
              </Text>
            </View>
          </View>

          <View style={styles.routeRight}>
            {item.distance && (
              <Text style={styles.routeDistance}>{item.distance.toFixed(1)} km</Text>
            )}
            {item.eta && (
              <Text style={styles.routeEta}>{item.eta} min</Text>
            )}
            <View
              style={[
                styles.statusBadge,
                item.status === 'completed' && styles.statusBadgeCompleted,
                item.status === 'visited' && styles.statusBadgeVisited,
              ]}
            >
              <Text style={styles.statusText}>
                {item.status === 'completed'
                  ? '✅'
                  : item.status === 'visited'
                    ? '👁️'
                    : '⏳'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )}
    />
  )
}

const styles = StyleSheet.create({
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    marginVertical: 8,
    marginHorizontal: 12,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#36BF6A',
  },
  routeCardCompleted: {
    opacity: 0.6,
  },
  routeSequence: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#36BF6A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  routeNumber: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 14,
  },
  routeInfo: {
    flex: 1,
  },
  routeName: {
    color: '#f1f5f9',
    fontWeight: '600',
    fontSize: 14,
  },
  routeAddress: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 4,
  },
  routeHours: {
    color: '#94a3b8',
    fontSize: 11,
  },
  routeMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  metaText: {
    color: '#64748b',
    fontSize: 12,
  },
  routeRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  routeDistance: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  routeEta: {
    color: '#94a3b8',
    fontSize: 11,
  },
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  statusBadgeCompleted: {
    backgroundColor: '#10b981',
  },
  statusBadgeVisited: {
    backgroundColor: '#3b82f6',
  },
  statusText: {
    fontSize: 16,
  },
})
