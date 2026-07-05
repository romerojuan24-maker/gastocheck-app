import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { formatCurrency } from '@gastocheck/shared'
import { usePaymentCapacity } from '../hooks'

interface Props {
  companyId: string
  currentBalance: number
  color: string
}

const BUFFER_KEY_PREFIX = 'flujocheck_buffer_'

export function SettingsTab({ companyId, currentBalance, color }: Props) {
  const [bufferInput, setBufferInput] = useState('')
  const [savedBuffer, setSavedBuffer] = useState(0)
  const [saving, setSaving] = useState(false)

  const { capacity, calculate, calculating } = usePaymentCapacity()

  useEffect(() => {
    (async () => {
      if (!companyId) return
      const stored = await AsyncStorage.getItem(BUFFER_KEY_PREFIX + companyId)
      const value = stored ? Number(stored) : 0
      setSavedBuffer(value)
      setBufferInput(value ? String(value) : '')
    })()
  }, [companyId])

  useEffect(() => {
    if (companyId) {
      calculate(currentBalance, savedBuffer, 0, 0)
    }
  }, [companyId, currentBalance, savedBuffer])

  const handleSave = async () => {
    const value = Number(bufferInput.replace(/[^0-9.]/g, ''))
    if (isNaN(value) || value < 0) {
      Alert.alert('Valor inválido', 'Ingresa un monto de buffer válido')
      return
    }
    setSaving(true)
    try {
      await AsyncStorage.setItem(BUFFER_KEY_PREFIX + companyId, String(value))
      setSavedBuffer(value)
      Alert.alert('Guardado', 'Buffer mínimo actualizado')
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Buffer mínimo (colchón de seguridad)</Text>
          <Text style={styles.sectionSub}>
            Monto que siempre quieres mantener disponible antes de considerar pagos adicionales.
          </Text>

          <TextInput
            style={styles.input}
            value={bufferInput}
            onChangeText={setBufferInput}
            placeholder="Ej. 20000"
            placeholderTextColor="#64748b"
            keyboardType="decimal-pad"
          />

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: color }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>{saving ? 'Guardando...' : 'Guardar buffer'}</Text>
          </TouchableOpacity>
        </View>

        {!calculating && capacity && savedBuffer > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Capacidad de pago actual</Text>
            <View style={styles.capacityRow}>
              <View>
                <Text style={styles.capacityLabel}>Disponible para pagar</Text>
                <Text style={[styles.capacityValue, { color: capacity.is_sufficient ? '#10b981' : '#ef4444' }]}>
                  {formatCurrency(capacity.available_to_pay)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.capacityLabel}>Buffer restante</Text>
                <Text style={styles.capacityValue}>{formatCurrency(capacity.buffer_remaining)}</Text>
              </View>
            </View>
            {capacity.recommendations.map((r, i) => (
              <Text key={i} style={styles.recommendation}>{r}</Text>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acerca de FlujoCheck</Text>
          <Text style={styles.infoLine}>Saldo actual: {formatCurrency(currentBalance)}</Text>
          <Text style={styles.infoLine}>
            FlujoCheck sincroniza automáticamente con GastoCheck, CobraCheck y BancoCheck
            para mantener tu proyección de flujo de caja actualizada.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { color: '#f1f5f9', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  sectionSub: { color: '#94a3b8', fontSize: 12, marginBottom: 12, lineHeight: 17 },

  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f1f5f9',
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  saveButton: { borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  capacityRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  capacityLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  capacityValue: { color: '#f1f5f9', fontSize: 16, fontWeight: '700' },
  recommendation: { color: '#cbd5e1', fontSize: 12, marginTop: 4 },

  infoLine: { color: '#cbd5e1', fontSize: 13, marginBottom: 8, lineHeight: 18 },
})
