import React, { useState } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  StyleSheet,
} from 'react-native'
import type { RouteClient, Movement, ScannerResult } from '../types'
import DatePickerField from '../../../components/DatePickerField'

interface MovementFormProps {
  client: RouteClient
  scanResult?: ScannerResult
  visible: boolean
  onClose: () => void
  onSubmit: (data: Partial<Movement>) => void
}

export function MovementForm({
  client,
  scanResult,
  visible,
  onClose,
  onSubmit,
}: MovementFormProps) {
  const [movementType, setMovementType] = useState<'collected' | 'not_paid' | 'promise'>('collected')
  const [collectedAmount, setCollectedAmount] = useState(
    scanResult?.amount ? scanResult.amount.toString() : ''
  )
  const [method, setMethod] = useState<'cash' | 'transfer' | 'check' | 'card'>(
    'cash'
  )
  const [reasonNotPaid, setReasonNotPaid] = useState('')
  const [promiseDate, setPromiseDate] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = () => {
    if (movementType === 'collected' && !collectedAmount) {
      Alert.alert('Error', 'Ingresa el monto cobrado')
      return
    }

    const data: Partial<Movement> = {
      client_id: client.id,
      movement_type: movementType,
      collected_amount: collectedAmount ? parseFloat(collectedAmount) : undefined,
      method: movementType === 'collected' ? method : undefined,
      reason_not_paid: movementType === 'not_paid' ? reasonNotPaid : undefined,
      promise_date: movementType === 'promise' ? promiseDate : undefined,
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

            <Text style={styles.formLabel}>Resultado</Text>
            <View style={styles.statusButtonGroup}>
              <TouchableOpacity
                style={[styles.statusButton, movementType === 'collected' && styles.statusButtonActive]}
                onPress={() => setMovementType('collected')}
              >
                <Text style={[styles.statusButtonText, movementType === 'collected' && styles.statusButtonTextActive]}>
                  ✓ Pagó
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusButton, movementType === 'not_paid' && styles.statusButtonActive]}
                onPress={() => setMovementType('not_paid')}
              >
                <Text style={[styles.statusButtonText, movementType === 'not_paid' && styles.statusButtonTextActive]}>
                  ✕ No Pagó
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusButton, movementType === 'promise' && styles.statusButtonActive]}
                onPress={() => setMovementType('promise')}
              >
                <Text style={[styles.statusButtonText, movementType === 'promise' && styles.statusButtonTextActive]}>
                  🤝 Promesa
                </Text>
              </TouchableOpacity>
            </View>

            {movementType === 'collected' && (
              <>
                <Text style={styles.formLabel}>Monto Cobrado</Text>
                <TextInput
                  style={styles.largeInput}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={collectedAmount}
                  onChangeText={setCollectedAmount}
                  placeholderTextColor="#475569"
                />

                <Text style={styles.formLabel}>Método de Pago</Text>
                <View style={styles.methodButtonGroup}>
                  {(['cash', 'transfer', 'check', 'card'] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.methodButton, method === m && styles.methodButtonActive]}
                      onPress={() => setMethod(m)}
                    >
                      <Text style={[styles.methodButtonText, method === m && styles.methodButtonTextActive]}>
                        {m === 'cash' ? '💵' : m === 'transfer' ? '💳' : m === 'check' ? '📄' : '🏦'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {movementType === 'not_paid' && (
              <>
                <Text style={styles.formLabel}>Motivo</Text>
                <TextInput
                  style={styles.largeInput}
                  placeholder="Motivo de no pago"
                  multiline
                  numberOfLines={3}
                  value={reasonNotPaid}
                  onChangeText={setReasonNotPaid}
                  placeholderTextColor="#475569"
                />
              </>
            )}

            {movementType === 'promise' && (
              <DatePickerField
                label="Fecha de Promesa"
                value={promiseDate}
                onChange={setPromiseDate}
              />
            )}

            <Text style={styles.formLabel}>Notas</Text>
            <TextInput
              style={styles.largeInput}
              placeholder="Notas adicionales (opcional)"
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
              placeholderTextColor="#475569"
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

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  formContainer: {
    flex: 1,
    marginTop: 40,
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  closeButton: {
    fontSize: 24,
    color: '#64748b',
    fontWeight: '600',
  },
  detailTitle: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: '700',
  },
  detailContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  formLabel: {
    color: '#36BF6A',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 12,
  },
  formValue: {
    color: '#cbd5e1',
    fontSize: 16,
    marginBottom: 12,
  },
  largeInput: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f1f5f9',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusButtonGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusButtonActive: {
    backgroundColor: '#36BF6A',
    borderColor: '#36BF6A',
  },
  statusButtonText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  statusButtonTextActive: {
    color: '#0f172a',
  },
  methodButtonGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  methodButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  methodButtonActive: {
    backgroundColor: '#36BF6A',
    borderColor: '#36BF6A',
  },
  methodButtonText: {
    fontSize: 18,
  },
  methodButtonTextActive: {
    color: '#0f172a',
  },
  detailActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  largeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#1e293b',
  },
  buttonPrimary: {
    backgroundColor: '#36BF6A',
  },
  largeButtonText: {
    color: '#cbd5e1',
    fontWeight: '600',
    fontSize: 14,
  },
  largeButtonTextPrimary: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 14,
  },
})
