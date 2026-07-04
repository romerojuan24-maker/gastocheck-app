import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Linking,
  Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCobrador } from '../../hooks/cobra'
import { formatCurrency } from '@gastocheck/shared'

// Hooks
import { useRoute, useMovementCapture, useDailyReport } from './hooks'

// Componentes
import {
  RouteList,
  ClientDetail,
  ScannerModal,
  MovementForm,
  ReportSummary,
} from './components'

// Tipos
import type { RouteClient, Movement, ScannerResult } from './types'

// ============================================================================
// MAIN SCREEN: CobraCheck — Mi Ruta de Cobranza
// ============================================================================

export default function CobraCheckScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useCobrador()
  const today = new Date().toISOString().split('T')[0]
  const { route, loading: routeLoading } = useRoute(user?.id || '', today)
  const { capture } = useMovementCapture()
  const { generate } = useDailyReport()

  const [selectedClient, setSelectedClient] = useState<RouteClient | null>(null)
  const [showClientDetail, setShowClientDetail] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [showMovementForm, setShowMovementForm] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [scanResult, setScanResult] = useState<ScannerResult | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [reportLoading, setReportLoading] = useState(false)

  // Estadísticas
  const stats = {
    clientsVisited: movements.filter((m) => m.status !== 'pending').length,
    totalCollected: movements
      .filter((m) => m.status === 'paid')
      .reduce((sum, m) => sum + m.amount, 0),
    cashDeposits: movements
      .filter((m) => m.status === 'paid' && m.method === 'cash')
      .reduce((sum, m) => sum + m.amount, 0),
    promises: movements.filter((m) => m.status === 'promise').length,
  }

  const handleSelectClient = (client: RouteClient) => {
    setSelectedClient(client)
    setShowClientDetail(true)
  }

  const handleOpenMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'No se pudo abrir Google Maps')
    })
  }

  const handleScanResult = (result: ScannerResult) => {
    setScanResult(result)
    setShowScanner(false)
    setShowMovementForm(true)
  }

  const handleSubmitMovement = async (data: Partial<Movement>) => {
    const movement = await capture({
      ...data,
      actor_id: user?.id || '',
    } as Omit<Movement, 'id' | 'created_at'>)

    if (movement) {
      setMovements([...movements, movement])
      setScanResult(null)
      Alert.alert('Éxito', 'Intento registrado')
    }
  }

  const handleSubmitReport = async () => {
    if (!user) return
    setReportLoading(true)
    try {
      const report = await generate(user.id, today)
      if (report) {
        Alert.alert('Éxito', 'Reporte enviado al supervisor')
        setShowReport(false)
        setMovements([])
      }
    } finally {
      setReportLoading(false)
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Mi Ruta</Text>
          <Text style={styles.headerDate}>
            {new Date().toLocaleDateString('es-MX', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>
        <View style={styles.headerStats}>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>{stats.clientsVisited}</Text>
            <Text style={styles.headerStatLabel}>Visitados</Text>
          </View>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>
              {formatCurrency(stats.totalCollected)}
            </Text>
            <Text style={styles.headerStatLabel}>Cobrado</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Clientes Hoy ({route.length})</Text>
        <RouteList
          clients={route}
          onSelectClient={handleSelectClient}
          loading={routeLoading}
        />

        <View style={styles.spacer} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.largeButton, styles.buttonSecondary]}
          onPress={() => setShowReport(true)}
        >
          <Text style={styles.largeButtonText}>📊 Reporte Diario</Text>
        </TouchableOpacity>
      </View>

      {selectedClient && (
        <ClientDetail
          client={selectedClient}
          visible={showClientDetail}
          onClose={() => setShowClientDetail(false)}
          onOpenMaps={handleOpenMaps}
          onStartMovement={() => setShowMovementForm(true)}
          onScanTicket={() => setShowScanner(true)}
        />
      )}

      <ScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScanResult={handleScanResult}
      />

      {selectedClient && (
        <MovementForm
          client={selectedClient}
          scanResult={scanResult}
          visible={showMovementForm}
          onClose={() => {
            setShowMovementForm(false)
            setScanResult(null)
          }}
          onSubmit={handleSubmitMovement}
        />
      )}

      <ReportSummary
        visible={showReport}
        onClose={() => setShowReport(false)}
        onSubmit={handleSubmitReport}
        stats={stats}
        loading={reportLoading}
      />
    </View>
  )
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    backgroundColor: '#182535',
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  headerDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  headerStats: {
    flexDirection: 'row',
    gap: 12,
  },
  headerStat: {
    alignItems: 'center',
  },
  headerStatValue: {
    color: '#36BF6A',
    fontSize: 18,
    fontWeight: '700',
  },
  headerStatLabel: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingVertical: 8,
  },
  sectionTitle: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  spacer: {
    height: 16,
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  largeButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#1e293b',
  },
  largeButtonText: {
    color: '#cbd5e1',
    fontWeight: '600',
    fontSize: 14,
  },
})
