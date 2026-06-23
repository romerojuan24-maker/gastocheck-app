import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
} from 'react-native'
import * as Location from 'expo-location'
import * as ImagePicker from 'expo-image-picker'
import * as Linking from 'expo-linking'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCobraClients, useCobraInvoices, useCobrador } from '../../../hooks/cobra'
import { supabase } from '../../../lib/supabase'
import { formatCurrency } from '@gastocheck/shared'

// ============================================================================
// TYPES
// ============================================================================

interface RouteClient {
  id: string
  name: string
  lat: number
  lng: number
  address?: string
  phone?: string
  office_hours?: string
  distance?: number
  eta?: number
  status: 'pending' | 'visited' | 'completed'
  invoices_count: number
  total_amount: number
}

interface ScannerResult {
  amount?: number
  date?: string
  provider?: string
  confidence?: number
}

interface Movement {
  id: string
  client_id: string
  invoice_id?: string
  actor_id: string
  movement_date: string
  status: 'paid' | 'unpaid' | 'promise'
  amount: number
  method?: 'cash' | 'transfer' | 'check' | 'card'
  payment_date?: string
  unpaid_reason?: string
  promise_date?: string
  notes?: string
}

interface DailyCash {
  amount: number
  deposit_date?: string
  reference?: string
}

interface DailyReport {
  actor_id: string
  report_date: string
  clients_visited: number
  total_collected: number
  cash_deposits: DailyCash[]
  promises_made: number
  movements: Movement[]
  created_at: string
}

// ============================================================================
// HOOKS
// ============================================================================

// useRoute: Obtener ruta del día optimizada
function useRoute(actorId: string, date: string) {
  const [route, setRoute] = useState<RouteClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRoute = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: err } = await supabase
        .from('daily_routes')
        .select(
          `
          id,
          client_id,
          sequence,
          distance_km,
          eta_minutes,
          status,
          cobra_clients (
            id,
            name,
            lat,
            lng,
            address,
            phone,
            office_hours
          ),
          cobra_invoices (
            id,
            amount,
            status
          )
        `
        )
        .eq('actor_id', actorId)
        .eq('route_date', date)
        .order('sequence', { ascending: true })

      if (err) throw err

      const clients: RouteClient[] = (data || []).map((route: any) => ({
        id: route.cobra_clients.id,
        name: route.cobra_clients.name,
        lat: route.cobra_clients.lat,
        lng: route.cobra_clients.lng,
        address: route.cobra_clients.address,
        phone: route.cobra_clients.phone,
        office_hours: route.cobra_clients.office_hours,
        distance: route.distance_km,
        eta: route.eta_minutes,
        status: route.status,
        invoices_count: route.cobra_invoices.length,
        total_amount: route.cobra_invoices.reduce(
          (sum: number, inv: any) => sum + inv.amount,
          0
        ),
      }))

      setRoute(clients)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [actorId, date])

  useEffect(() => {
    if (actorId && date) fetchRoute()
  }, [actorId, date, fetchRoute])

  return { route, loading, error, refetch: fetchRoute }
}

// useScanner: Analizar foto con Gemini (simulado)
function useScanner(imageUri: string | null) {
  const [result, setResult] = useState<ScannerResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scanImage = useCallback(async (uri: string) => {
    try {
      setLoading(true)
      setError(null)

      // TODO: Llamar a Gemini API con vision
      // Por ahora simular respuesta
      setTimeout(() => {
        setResult({
          amount: 1500,
          date: new Date().toISOString(),
          provider: 'PROVEEDOR EJEMPLO',
          confidence: 0.95,
        })
      }, 1500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (imageUri) scanImage(imageUri)
  }, [imageUri, scanImage])

  return { result, loading, error }
}

// useMovementCapture: Registrar intento de cobro
function useMovementCapture() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const capture = useCallback(
    async (data: Omit<Movement, 'id' | 'created_at'>) => {
      try {
        setLoading(true)
        setError(null)

        const { data: movement, error: err } = await supabase
          .from('cobra_movements')
          .insert([
            {
              ...data,
              movement_date: new Date().toISOString(),
            },
          ])
          .select()
          .single()

        if (err) throw err
        return movement
      } catch (err: any) {
        setError(err.message)
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { capture, loading, error }
}

// useDailyReport: Generar reporte diario
function useDailyReport() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(
    async (actorId: string, date: string): Promise<DailyReport | null> => {
      try {
        setLoading(true)
        setError(null)

        const { data, error: err } = await supabase
          .from('cobra_daily_reports')
          .select(
            `
            *,
            cobra_movements (
              id,
              status,
              amount,
              method,
              unpaid_reason,
              promise_date
            )
          `
          )
          .eq('actor_id', actorId)
          .eq('report_date', date)
          .single()

        if (err && err.code !== 'PGRST116') throw err

        if (!data) {
          // Crear reporte nuevo
          const { data: newReport, error: createErr } = await supabase
            .from('cobra_daily_reports')
            .insert([
              {
                actor_id: actorId,
                report_date: date,
                clients_visited: 0,
                total_collected: 0,
                promises_made: 0,
              },
            ])
            .select()
            .single()

          if (createErr) throw createErr
          return newReport as DailyReport
        }

        return data as DailyReport
      } catch (err: any) {
        setError(err.message)
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { generate, loading, error }
}

// ============================================================================
// COMPONENTS
// ============================================================================

// RouteList: Listar clientes de la ruta
interface RouteListProps {
  clients: RouteClient[]
  onSelectClient: (client: RouteClient) => void
  loading: boolean
}

function RouteList({ clients, onSelectClient, loading }: RouteListProps) {
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

// ClientDetail: Detalles del cliente con acciones
interface ClientDetailProps {
  client: RouteClient
  visible: boolean
  onClose: () => void
  onOpenMaps: (lat: number, lng: number) => void
  onStartMovement: () => void
  onScanTicket: () => void
}

function ClientDetail({
  client,
  visible,
  onClose,
  onOpenMaps,
  onStartMovement,
  onScanTicket,
}: ClientDetailProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.clientDetailContainer}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.detailTitle}>Detalles Cliente</Text>
            <View style={{ width: 30 }} />
          </View>

          <ScrollView style={styles.detailContent}>
            <Text style={styles.clientNameLarge}>{client.name}</Text>

            {client.address && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Dirección</Text>
                <Text style={styles.detailText}>{client.address}</Text>
              </View>
            )}

            {client.phone && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Teléfono</Text>
                <TouchableOpacity>
                  <Text style={[styles.detailText, styles.linkText]}>
                    {client.phone}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {client.office_hours && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Horarios</Text>
                <Text style={styles.detailText}>{client.office_hours}</Text>
              </View>
            )}

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Documentos Pendientes</Text>
              <Text style={styles.detailText}>
                {client.invoices_count} recibo(s) · {formatCurrency(client.total_amount)}
              </Text>
            </View>

            {client.distance && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Distancia</Text>
                <Text style={styles.detailText}>
                  {client.distance.toFixed(1)} km • {client.eta} min
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.detailActions}>
            <TouchableOpacity
              style={[styles.largeButton, styles.buttonSecondary]}
              onPress={() => onOpenMaps(client.lat, client.lng)}
            >
              <Text style={styles.largeButtonText}>📍 Google Maps</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.largeButton, styles.buttonSecondary]}
              onPress={onScanTicket}
            >
              <Text style={styles.largeButtonText}>📸 Escanear Ticket</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.largeButton, styles.buttonPrimary]}
              onPress={() => {
                onStartMovement()
                onClose()
              }}
            >
              <Text style={styles.largeButtonTextPrimary}>💳 Registrar Intento</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ScannerModal: Tomar foto y extraer datos con Gemini
interface ScannerModalProps {
  visible: boolean
  onClose: () => void
  onScanResult: (result: ScannerResult) => void
}

function ScannerModal({ visible, onClose, onScanResult }: ScannerModalProps) {
  const [imageUri, setImageUri] = useState<string | null>(null)
  const { result, loading } = useScanner(imageUri)

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      })

      if (!result.canceled) {
        setImageUri(result.assets[0].uri)
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo acceder a la cámara')
    }
  }

  const handleConfirm = () => {
    if (result) {
      onScanResult(result)
      setImageUri(null)
      onClose()
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.scannerContainer}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.detailTitle}>Escanear Ticket</Text>
            <View style={{ width: 30 }} />
          </View>

          <ScrollView style={styles.detailContent}>
            {imageUri ? (
              <>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.previewImage}
                />
                {loading && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator
                      size="large"
                      color="#36BF6A"
                    />
                    <Text style={styles.loadingText}>
                      Analizando imagen...
                    </Text>
                  </View>
                )}
                {result && !loading && (
                  <View style={styles.scanResultContainer}>
                    <Text style={styles.resultTitle}>Datos Extraídos</Text>
                    {result.amount && (
                      <View style={styles.resultField}>
                        <Text style={styles.resultLabel}>Monto</Text>
                        <Text style={styles.resultValue}>
                          {formatCurrency(result.amount)}
                        </Text>
                      </View>
                    )}
                    {result.date && (
                      <View style={styles.resultField}>
                        <Text style={styles.resultLabel}>Fecha</Text>
                        <Text style={styles.resultValue}>
                          {new Date(result.date).toLocaleDateString('es-MX')}
                        </Text>
                      </View>
                    )}
                    {result.provider && (
                      <View style={styles.resultField}>
                        <Text style={styles.resultLabel}>Proveedor</Text>
                        <Text style={styles.resultValue}>{result.provider}</Text>
                      </View>
                    )}
                    {result.confidence && (
                      <View style={styles.resultField}>
                        <Text style={styles.resultLabel}>Confianza</Text>
                        <Text style={styles.resultValue}>
                          {(result.confidence * 100).toFixed(0)}%
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            ) : (
              <View style={styles.cameraMissingContainer}>
                <Text style={styles.cameraText}>📷</Text>
                <Text style={styles.cameraMissingText}>
                  Toma una foto del ticket para extraer datos automáticamente
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.detailActions}>
            {!imageUri ? (
              <TouchableOpacity
                style={[styles.largeButton, styles.buttonPrimary]}
                onPress={pickImage}
              >
                <Text style={styles.largeButtonTextPrimary}>
                  📸 Tomar Foto
                </Text>
              </TouchableOpacity>
            ) : result && !loading ? (
              <>
                <TouchableOpacity
                  style={[styles.largeButton, styles.buttonSecondary]}
                  onPress={() => setImageUri(null)}
                >
                  <Text style={styles.largeButtonText}>⟲ Otra Foto</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.largeButton, styles.buttonPrimary]}
                  onPress={handleConfirm}
                >
                  <Text style={styles.largeButtonTextPrimary}>
                    ✓ Confirmar
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  )
}

// MovementForm: Registrar intento de cobro
interface MovementFormProps {
  client: RouteClient
  scanResult?: ScannerResult
  visible: boolean
  onClose: () => void
  onSubmit: (data: Partial<Movement>) => void
}

function MovementForm({
  client,
  scanResult,
  visible,
  onClose,
  onSubmit,
}: MovementFormProps) {
  const [status, setStatus] = useState<'paid' | 'unpaid' | 'promise'>('paid')
  const [amount, setAmount] = useState(
    scanResult?.amount ? scanResult.amount.toString() : ''
  )
  const [method, setMethod] = useState<'cash' | 'transfer' | 'check' | 'card'>(
    'cash'
  )
  const [reason, setReason] = useState('')
  const [promiseDate, setPromiseDate] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = () => {
    if (!amount) {
      Alert.alert('Error', 'Ingresa el monto')
      return
    }

    const data: Partial<Movement> = {
      client_id: client.id,
      status,
      amount: parseFloat(amount),
      method: status === 'paid' ? method : undefined,
      unpaid_reason: status === 'unpaid' ? reason : undefined,
      promise_date: status === 'promise' ? promiseDate : undefined,
      notes: notes || undefined,
    }

    onSubmit(data)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.formContainer}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.detailTitle}>Registrar Intento</Text>
            <View style={{ width: 30 }} />
          </View>

          <ScrollView style={styles.detailContent}>
            <Text style={styles.formLabel}>Cliente</Text>
            <Text style={styles.formValue}>{client.name}</Text>

            <Text style={styles.formLabel}>Monto</Text>
            <TextInput
              style={styles.largeInput}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />

            <Text style={styles.formLabel}>Estado</Text>
            <View style={styles.statusButtonGroup}>
              <TouchableOpacity
                style={[
                  styles.statusButton,
                  status === 'paid' && styles.statusButtonActive,
                ]}
                onPress={() => setStatus('paid')}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    status === 'paid' && styles.statusButtonTextActive,
                  ]}
                >
                  ✓ Pagó
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusButton,
                  status === 'unpaid' && styles.statusButtonActive,
                ]}
                onPress={() => setStatus('unpaid')}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    status === 'unpaid' && styles.statusButtonTextActive,
                  ]}
                >
                  ✕ No Pagó
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusButton,
                  status === 'promise' && styles.statusButtonActive,
                ]}
                onPress={() => setStatus('promise')}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    status === 'promise' && styles.statusButtonTextActive,
                  ]}
                >
                  🤝 Promesa
                </Text>
              </TouchableOpacity>
            </View>

            {status === 'paid' && (
              <>
                <Text style={styles.formLabel}>Método de Pago</Text>
                <View style={styles.methodButtonGroup}>
                  {(['cash', 'transfer', 'check', 'card'] as const).map(
                    (m) => (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.methodButton,
                          method === m && styles.methodButtonActive,
                        ]}
                        onPress={() => setMethod(m)}
                      >
                        <Text
                          style={[
                            styles.methodButtonText,
                            method === m &&
                              styles.methodButtonTextActive,
                          ]}
                        >
                          {m === 'cash'
                            ? '💵'
                            : m === 'transfer'
                              ? '💳'
                              : m === 'check'
                                ? '📄'
                                : '🏦'}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </>
            )}

            {status === 'unpaid' && (
              <>
                <Text style={styles.formLabel}>Motivo</Text>
                <TextInput
                  style={styles.largeInput}
                  placeholder="Motivo de no pago"
                  multiline
                  numberOfLines={3}
                  value={reason}
                  onChangeText={setReason}
                />
              </>
            )}

            {status === 'promise' && (
              <>
                <Text style={styles.formLabel}>Fecha de Promesa</Text>
                <TextInput
                  style={styles.largeInput}
                  placeholder="YYYY-MM-DD"
                  value={promiseDate}
                  onChangeText={setPromiseDate}
                />
              </>
            )}

            <Text style={styles.formLabel}>Notas</Text>
            <TextInput
              style={styles.largeInput}
              placeholder="Notas adicionales (opcional)"
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
            />
          </ScrollView>

          <View style={styles.detailActions}>
            <TouchableOpacity
              style={[styles.largeButton, styles.buttonSecondary]}
              onPress={onClose}
            >
              <Text style={styles.largeButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.largeButton, styles.buttonPrimary]}
              onPress={handleSubmit}
            >
              <Text style={styles.largeButtonTextPrimary}>
                Guardar Intento
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ReportSummary: Resumen diario
interface ReportSummaryProps {
  visible: boolean
  onClose: () => void
  onSubmit: () => void
  stats: {
    clientsVisited: number
    totalCollected: number
    cashDeposits: number
    promises: number
  }
  loading?: boolean
}

function ReportSummary({
  visible,
  onClose,
  onSubmit,
  stats,
  loading,
}: ReportSummaryProps) {
  const [depositAmount, setDepositAmount] = useState('')
  const [depositReference, setDepositReference] = useState('')

  const handleSubmit = () => {
    if (depositAmount && !depositReference) {
      Alert.alert('Error', 'Ingresa referencia del depósito')
      return
    }
    onSubmit()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.reportContainer}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.detailTitle}>Reporte Diario</Text>
            <View style={{ width: 30 }} />
          </View>

          <ScrollView style={styles.detailContent}>
            <View style={styles.reportStatsGrid}>
              <View style={styles.reportStatCard}>
                <Text style={styles.reportStatLabel}>Clientes Visitados</Text>
                <Text style={styles.reportStatValue}>
                  {stats.clientsVisited}
                </Text>
              </View>

              <View style={styles.reportStatCard}>
                <Text style={styles.reportStatLabel}>Total Cobrado</Text>
                <Text style={styles.reportStatValue}>
                  {formatCurrency(stats.totalCollected)}
                </Text>
              </View>

              <View style={styles.reportStatCard}>
                <Text style={styles.reportStatLabel}>Depósitos</Text>
                <Text style={styles.reportStatValue}>
                  {formatCurrency(stats.cashDeposits)}
                </Text>
              </View>

              <View style={styles.reportStatCard}>
                <Text style={styles.reportStatLabel}>Promesas</Text>
                <Text style={styles.reportStatValue}>{stats.promises}</Text>
              </View>
            </View>

            <View style={styles.reportSection}>
              <Text style={styles.formLabel}>Depósito de Efectivo</Text>
              <TextInput
                style={styles.largeInput}
                placeholder="Monto depositado"
                keyboardType="decimal-pad"
                value={depositAmount}
                onChangeText={setDepositAmount}
              />
              <TextInput
                style={styles.largeInput}
                placeholder="Referencia depósito (comprobante)"
                value={depositReference}
                onChangeText={setDepositReference}
              />
            </View>
          </ScrollView>

          <View style={styles.detailActions}>
            <TouchableOpacity
              style={[styles.largeButton, styles.buttonSecondary]}
              onPress={onClose}
            >
              <Text style={styles.largeButtonText}>Volver</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.largeButton,
                styles.buttonPrimary,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.largeButtonTextPrimary}>
                  📤 Enviar a Supervisor
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ============================================================================
// MAIN SCREEN: Mi Ruta (GastoCheck)
// ============================================================================

export default function GastoCheckScreen() {
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

const { width } = Dimensions.get('window')

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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerDate: {
    fontSize: 13,
    color: '#99a3af',
    marginTop: 4,
  },
  headerStats: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
  },
  headerStat: {
    alignItems: 'center',
  },
  headerStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#36BF6A',
  },
  headerStatLabel: {
    fontSize: 11,
    color: '#99a3af',
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e0e7ff',
    marginBottom: 12,
  },
  routeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#36BF6A',
  },
  routeCardCompleted: {
    opacity: 0.6,
    borderLeftColor: '#6b7280',
  },
  routeSequence: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#36BF6A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  routeNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  routeInfo: {
    flex: 1,
  },
  routeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  routeAddress: {
    fontSize: 12,
    color: '#cbd5e1',
    marginTop: 4,
  },
  routeHours: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  routeMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  metaText: {
    fontSize: 11,
    color: '#64748b',
  },
  routeRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  routeDistance: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e0e7ff',
  },
  routeEta: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  statusBadge: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#334155',
    borderRadius: 12,
  },
  statusBadgeVisited: {
    backgroundColor: '#fbbf24',
  },
  statusBadgeCompleted: {
    backgroundColor: '#22c55e',
  },
  statusText: {
    fontSize: 12,
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  spacer: {
    height: 24,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  clientDetailContainer: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  scannerContainer: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  formContainer: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  reportContainer: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  closeButton: {
    fontSize: 24,
    color: '#94a3b8',
    fontWeight: '300',
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  detailContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  detailActions: {
    paddingHorizontal: 12,
    gap: 8,
  },
  clientNameLarge: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginBottom: 16,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#36BF6A',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  detailText: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
  },
  linkText: {
    color: '#36BF6A',
  },

  // Buttons
  largeButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 50,
  },
  buttonPrimary: {
    backgroundColor: '#36BF6A',
  },
  buttonSecondary: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  largeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  largeButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },

  // Forms
  largeInput: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#f1f5f9',
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#36BF6A',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  formValue: {
    fontSize: 16,
    color: '#f1f5f9',
    marginBottom: 16,
  },

  // Status buttons
  statusButtonGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: '#36BF6A',
    borderColor: '#36BF6A',
  },
  statusButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  statusButtonTextActive: {
    color: '#0f172a',
  },

  // Method buttons
  methodButtonGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  methodButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  methodButtonActive: {
    backgroundColor: '#36BF6A',
    borderColor: '#36BF6A',
  },
  methodButtonText: {
    fontSize: 18,
    color: '#94a3b8',
  },
  methodButtonTextActive: {
    color: '#0f172a',
  },

  // Scanner
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 16,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 12,
  },
  cameraMissingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  cameraText: {
    fontSize: 48,
    marginBottom: 12,
  },
  cameraMissingText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  scanResultContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#36BF6A',
    marginBottom: 12,
  },
  resultField: {
    marginBottom: 10,
  },
  resultLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
  },

  // Report
  reportSection: {
    marginBottom: 16,
  },
  reportStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  reportStatCard: {
    width: (width - 44) / 2,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  reportStatLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 6,
    textAlign: 'center',
  },
  reportStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#36BF6A',
    textAlign: 'center',
  },
})
