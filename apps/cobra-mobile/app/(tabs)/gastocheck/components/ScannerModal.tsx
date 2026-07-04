import React, { useState } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useScanner } from '../hooks'
import type { ScannerResult } from '../types'
import { formatCurrency } from '@gastocheck/shared'

interface ScannerModalProps {
  visible: boolean
  onClose: () => void
  onScanResult: (result: ScannerResult) => void
}

export function ScannerModal({ visible, onClose, onScanResult }: ScannerModalProps) {
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

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  scannerContainer: {
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
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    color: '#cbd5e1',
    marginTop: 12,
  },
  scanResultContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 16,
  },
  resultTitle: {
    color: '#36BF6A',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  resultField: {
    marginBottom: 12,
  },
  resultLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
  resultValue: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '600',
  },
  cameraMissingContainer: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  cameraText: {
    fontSize: 48,
    marginBottom: 12,
  },
  cameraMissingText: {
    color: '#cbd5e1',
    textAlign: 'center',
    fontSize: 14,
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
