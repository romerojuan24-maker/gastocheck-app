import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native'
import { useCobrador } from '../../hooks/cobra'
import { useRouter } from 'expo-router'
import { formatCurrency } from '@gastocheck/shared'
import { supabase } from '../../lib/supabase'
import { useEffect, useState } from 'react'
import * as ImagePicker from 'expo-image-picker'

interface ClientePago {
  id: string
  name: string
  phone?: string
  current_balance: number
  risk_score: number
  total_pending_invoices: number
  last_payment_date?: string
}

interface MovimientoRegistro {
  client_id: string
  amount: number
  expected_amount: number
  method: 'cash' | 'transfer' | 'check' | 'credit_card'
  notes: string
  photo_uri?: string
  require_photo: boolean
}

export default function PagosPage() {
  const router = useRouter()
  const { user } = useCobrador()
  const [clientes, setClientes] = useState<ClientePago[]>([])
  const [selectedClient, setSelectedClient] = useState<ClientePago | null>(null)
  const [movimiento, setMovimiento] = useState<MovimientoRegistro>({
    client_id: '',
    amount: 0,
    expected_amount: 0,
    method: 'cash',
    notes: '',
    require_photo: false,
  })
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)

  useEffect(() => {
    if (!user?.company_id) return

    ; (async () => {
      const { data } = await supabase
        .from('cobra_clients')
        .select(`
          id,
          name,
          phone,
          current_balance,
          risk_score,
          cobra_invoices(id)
        `)
        .eq('company_id', user.company_id)
        .eq('status', 'active')
        .order('risk_score', { ascending: false })

      const mapped = (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        current_balance: c.current_balance,
        risk_score: c.risk_score,
        total_pending_invoices: c.cobra_invoices?.length || 0,
      }))

      setClientes(mapped)
      setLoading(false)
    })()
  }, [user?.company_id])

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    })

    if (!result.canceled) {
      setMovimiento({ ...movimiento, photo_uri: result.assets[0].uri })
    }
  }

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    })

    if (!result.canceled) {
      setMovimiento({ ...movimiento, photo_uri: result.assets[0].uri })
    }
  }

  const handleClientSelect = (client: ClientePago) => {
    setSelectedClient(client)
    setMovimiento({
      ...movimiento,
      client_id: client.id,
      expected_amount: client.current_balance,
    })
  }

  const handleAmountChange = (amount: string) => {
    const num = parseFloat(amount) || 0
    const expectedAmount = movimiento.expected_amount
    const isDifferent = Math.abs(num - expectedAmount) > 0.01

    setMovimiento({
      ...movimiento,
      amount: num,
      require_photo: isDifferent,
    })
  }

  const registerPayment = async () => {
    if (!user?.company_id || !selectedClient) {
      Alert.alert('Error', 'Selecciona un cliente')
      return
    }

    if (movimiento.amount <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido')
      return
    }

    if (movimiento.require_photo && !movimiento.photo_uri) {
      Alert.alert('Foto requerida', 'Como el pago difiere del saldo, debes tomar una foto del comprobante')
      return
    }

    setRegistering(true)

    try {
      let photoUrl = null

      // Subir foto si existe
      if (movimiento.photo_uri) {
        const fileName = `cobra_payments/${user.id}/${Date.now()}.jpg`
        const response = await fetch(movimiento.photo_uri)
        const blob = await response.blob()

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, blob, { upsert: true })

        if (uploadError) throw uploadError
        photoUrl = uploadData?.path
      }

      // Registrar movimiento
      const { error: movError } = await supabase.from('cobra_movements').insert({
        company_id: user.company_id,
        user_id: user.id,
        client_id: selectedClient.id,
        route_point_ts: new Date().toISOString(),
        movement_type: 'collected',
        collected_amount: movimiento.amount,
        amount_original: selectedClient.current_balance,
        method: movimiento.method,
        notes: movimiento.notes,
        photo_uri: photoUrl,
      })

      if (movError) throw movError

      // Actualizar cliente en Contador si la cantidad pagada es diferente
      if (movimiento.require_photo) {
        await supabase.from('contador_movements').insert({
          company_id: user.company_id,
          source_module: 'cobracheck',
          source_id: selectedClient.id,
          amount: movimiento.amount,
          movement_type: 'income',
          description: `Pago de ${selectedClient.name} - Diferencia detectada: ${formatCurrency(movimiento.amount)} vs ${formatCurrency(movimiento.expected_amount)}`,
          reference_photo: photoUrl,
        }).catch(() => {
          // Si no existe la tabla, continuar sin error
        })
      }

      Alert.alert('✓ Pago registrado', 'El movimiento se ha registrado exitosamente')
      setSelectedClient(null)
      setMovimiento({
        client_id: '',
        amount: 0,
        expected_amount: 0,
        method: 'cash',
        notes: '',
        require_photo: false,
      })
    } catch (error) {
      console.error('Error registering payment:', error)
      Alert.alert('Error', 'No se pudo registrar el pago')
    } finally {
      setRegistering(false)
    }
  }

  const getRiskColor = (score: number) => {
    if (score >= 80) return '#ef4444'
    if (score >= 60) return '#f59e0b'
    return '#36BF6A'
  }

  const clientesEnRiesgo = clientes.filter(c => c.risk_score >= 70)

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Registrar Pagos</Text>
        <Text style={styles.sub}>{clientesEnRiesgo.length} clientes en riesgo</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando clientes...</Text>
        </View>
      ) : (
        <>
          {/* Clientes en riesgo (notificación en rojo) */}
          {clientesEnRiesgo.length > 0 && (
            <View style={styles.riskSection}>
              <Text style={styles.riskTitle}>🔴 {clientesEnRiesgo.length} Clientes en Riesgo</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.riskClients}>
                {clientesEnRiesgo.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.riskClientCard, selectedClient?.id === c.id && styles.riskClientCardSelected]}
                    onPress={() => handleClientSelect(c)}
                  >
                    <Text style={styles.riskClientName}>{c.name}</Text>
                    <Text style={styles.riskClientAmount}>{formatCurrency(c.current_balance)}</Text>
                    <Text style={styles.riskClientScore}>Riesgo: {c.risk_score}%</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Resto de clientes */}
          {!selectedClient && (
            <View style={styles.clientsSection}>
              <Text style={styles.clientsTitle}>Selecciona un cliente</Text>
              {clientes.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.clientCard, selectedClient?.id === c.id && styles.clientCardSelected]}
                  onPress={() => handleClientSelect(c)}
                >
                  <View style={styles.clientCardLeft}>
                    <Text style={styles.clientName}>{c.name}</Text>
                    {c.phone && <Text style={styles.clientPhone}>{c.phone}</Text>}
                    <Text style={styles.clientInvoices}>{c.total_pending_invoices} facturas</Text>
                  </View>
                  <View style={styles.clientCardRight}>
                    <Text style={[styles.clientAmount, { color: getRiskColor(c.risk_score) }]}>
                      {formatCurrency(c.current_balance)}
                    </Text>
                    <Text style={[styles.clientRisk, { color: getRiskColor(c.risk_score) }]}>
                      Riesgo: {c.risk_score}%
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Formulario de pago */}
          {selectedClient && (
            <View style={styles.formSection}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>{selectedClient.name}</Text>
                <TouchableOpacity onPress={() => setSelectedClient(null)}>
                  <Text style={styles.formClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Saldo esperado</Text>
                <Text style={styles.fieldValue}>{formatCurrency(movimiento.expected_amount)}</Text>
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Monto cobrado</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={movimiento.amount > 0 ? movimiento.amount.toString() : ''}
                  onChangeText={handleAmountChange}
                />
              </View>

              {movimiento.require_photo && (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    ⚠️ El monto difiere del saldo. Se requiere FOTO del comprobante como evidencia.
                  </Text>
                </View>
              )}

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Método de pago</Text>
                <View style={styles.methodButtons}>
                  {(['cash', 'transfer', 'check', 'credit_card'] as const).map(method => (
                    <TouchableOpacity
                      key={method}
                      style={[styles.methodBtn, movimiento.method === method && styles.methodBtnActive]}
                      onPress={() => setMovimiento({ ...movimiento, method })}
                    >
                      <Text style={[styles.methodBtnText, movimiento.method === method && styles.methodBtnTextActive]}>
                        {method === 'cash' ? '💵' : method === 'transfer' ? '🏦' : method === 'check' ? '📋' : '💳'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Notas</Text>
                <TextInput
                  style={[styles.fieldInput, styles.notesInput]}
                  placeholder="Observaciones del pago..."
                  value={movimiento.notes}
                  onChangeText={text => setMovimiento({ ...movimiento, notes: text })}
                  multiline
                />
              </View>

              {/* Foto */}
              {movimiento.require_photo && (
                <View style={styles.photoSection}>
                  <Text style={styles.fieldLabel}>Comprobante de Pago</Text>
                  {movimiento.photo_uri ? (
                    <View style={styles.photoPreview}>
                      <Text style={styles.photoPreviewText}>📸 Foto capturada</Text>
                      <TouchableOpacity
                        style={styles.photoChangeBtn}
                        onPress={takePhoto}
                      >
                        <Text style={styles.photoBtnText}>Cambiar foto</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.photoButtons}>
                      <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                        <Text style={styles.photoBtnText}>📷 Tomar foto</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
                        <Text style={styles.photoBtnText}>🖼️ Galería</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* Botón registrar */}
              <TouchableOpacity
                style={[styles.submitBtn, registering && styles.submitBtnDisabled]}
                onPress={registerPayment}
                disabled={registering}
              >
                <Text style={styles.submitBtnText}>
                  {registering ? 'Registrando...' : '✓ Registrar Pago'}
                </Text>
              </TouchableOpacity>

              {/* Nota de integración */}
              <View style={styles.integrationNote}>
                <Text style={styles.integrationText}>
                  📊 Este movimiento se reflejará automáticamente en Contador y Flujo Check
                </Text>
              </View>
            </View>
          )}
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
  sub: { color: '#ef4444', fontSize: 12, marginTop: 4, fontWeight: 'bold' },

  loadingContainer: { padding: 24, alignItems: 'center' },
  loadingText: { color: '#94a3b8' },

  riskSection: { padding: 12, backgroundColor: '#3f0f0f', marginHorizontal: 12, marginTop: 12, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#ef4444' },
  riskTitle: { color: '#ef4444', fontWeight: 'bold', marginBottom: 8, fontSize: 13 },
  riskClients: { gap: 8 },
  riskClientCard: { backgroundColor: '#1e293b', padding: 10, borderRadius: 8, minWidth: 130, borderWidth: 1, borderColor: '#334155' },
  riskClientCardSelected: { borderColor: '#ef4444', borderWidth: 2, backgroundColor: '#1e293b' },
  riskClientName: { color: '#f1f5f9', fontWeight: 'bold', fontSize: 12 },
  riskClientAmount: { color: '#ef4444', fontWeight: 'bold', fontSize: 12, marginTop: 4 },
  riskClientScore: { color: '#ef4444', fontSize: 10, marginTop: 2 },

  clientsSection: { padding: 12 },
  clientsTitle: { color: '#f1f5f9', fontWeight: 'bold', fontSize: 14, marginBottom: 8 },
  clientCard: { backgroundColor: '#1e293b', padding: 12, borderRadius: 8, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  clientCardSelected: { borderColor: '#36BF6A', borderWidth: 2 },
  clientCardLeft: { flex: 1 },
  clientName: { color: '#f1f5f9', fontWeight: 'bold', fontSize: 13 },
  clientPhone: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  clientInvoices: { color: '#94a3b8', fontSize: 10, marginTop: 2 },
  clientCardRight: { alignItems: 'flex-end' },
  clientAmount: { fontWeight: 'bold', fontSize: 13 },
  clientRisk: { fontSize: 10, marginTop: 2 },

  formSection: { padding: 12, backgroundColor: '#1e293b', margin: 12, borderRadius: 8 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
  formTitle: { color: '#f1f5f9', fontSize: 16, fontWeight: 'bold' },
  formClose: { color: '#94a3b8', fontSize: 20, fontWeight: 'bold' },

  formField: { marginBottom: 16 },
  fieldLabel: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold', marginBottom: 6 },
  fieldValue: { color: '#36BF6A', fontSize: 16, fontWeight: 'bold' },
  fieldInput: { backgroundColor: '#0f172a', color: '#f1f5f9', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#334155', fontSize: 14 },
  notesInput: { minHeight: 60, textAlignVertical: 'top' },

  warningBox: { backgroundColor: '#3f0f0f', padding: 12, borderRadius: 6, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#ef4444' },
  warningText: { color: '#ef4444', fontSize: 12, fontWeight: '600' },

  methodButtons: { flexDirection: 'row', gap: 8 },
  methodBtn: { flex: 1, padding: 10, borderRadius: 6, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  methodBtnActive: { backgroundColor: '#36BF6A', borderColor: '#36BF6A' },
  methodBtnText: { fontSize: 18 },
  methodBtnTextActive: { color: '#0f172a' },

  photoSection: { marginBottom: 16 },
  photoButtons: { flexDirection: 'row', gap: 8 },
  photoBtn: { flex: 1, backgroundColor: '#334155', padding: 12, borderRadius: 6, alignItems: 'center' },
  photoBtnText: { color: '#f1f5f9', fontWeight: 'bold', fontSize: 12 },
  photoPreview: { backgroundColor: '#1e3a0f', padding: 12, borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#36BF6A' },
  photoPreviewText: { color: '#22c55e', fontWeight: 'bold', marginBottom: 8 },
  photoChangeBtn: { backgroundColor: '#36BF6A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 },

  submitBtn: { backgroundColor: '#36BF6A', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },

  integrationNote: { backgroundColor: '#1e3a0f', padding: 12, borderRadius: 6, borderLeftWidth: 3, borderLeftColor: '#36BF6A' },
  integrationText: { color: '#22c55e', fontSize: 11, fontWeight: '600' },
})
