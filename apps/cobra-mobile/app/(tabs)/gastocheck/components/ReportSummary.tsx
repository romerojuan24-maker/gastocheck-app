import React, { useState } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native'
import { formatCurrency } from '@gastocheck/shared'

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

export function ReportSummary({
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
                placeholderTextColor="#475569"
              />
              <TextInput
                style={styles.largeInput}
                placeholder="Referencia depósito (comprobante)"
                value={depositReference}
                onChangeText={setDepositReference}
                placeholderTextColor="#475569"
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

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  reportContainer: {
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
  reportStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  reportStatCard: {
    width: '48%',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  reportStatLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  reportStatValue: {
    color: '#36BF6A',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 6,
  },
  reportSection: {
    marginBottom: 16,
  },
  formLabel: {
    color: '#36BF6A',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  largeInput: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f1f5f9',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
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
  buttonDisabled: {
    opacity: 0.6,
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
