import React from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native'
import { formatCurrency } from '@gastocheck/shared'
import type { RouteClient } from '../types'

interface ClientDetailProps {
  client: RouteClient
  visible: boolean
  onClose: () => void
  onOpenMaps: (lat: number, lng: number) => void
  onStartMovement: () => void
  onScanTicket: () => void
}

export function ClientDetail({
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

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  clientDetailContainer: {
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
  clientNameLarge: {
    color: '#f1f5f9',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailSectionTitle: {
    color: '#36BF6A',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailText: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  linkText: {
    color: '#36BF6A',
    textDecorationLine: 'underline',
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
