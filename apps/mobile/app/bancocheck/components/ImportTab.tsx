import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { formatCurrency } from '@gastocheck/shared'
import { useOCRExtraction, useBankAccountSync } from '../hooks'
import type { OCRExtractionResult } from '../types'

const PROVIDERS: { key: 'bbva' | 'santander' | 'belvo'; label: string; icon: string }[] = [
  { key: 'bbva', label: 'BBVA', icon: '🔵' },
  { key: 'santander', label: 'Santander', icon: '🔴' },
  { key: 'belvo', label: 'Otros bancos (Belvo)', icon: '🏦' },
]

interface Props {
  onImported?: () => void
  color: string
}

export function ImportTab({ onImported, color }: Props) {
  const { extract, extracting } = useOCRExtraction()
  const { syncOAuth, syncing } = useBankAccountSync()
  const [result, setResult] = useState<OCRExtractionResult | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const handlePickDocument = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      })

      if (picked.canceled || !picked.assets?.[0]) return

      const asset = picked.assets[0]
      setFileName(asset.name)
      setResult(null)

      const extraction = await extract(asset.uri)
      if (extraction) {
        setResult(extraction)
      } else {
        Alert.alert('Error', 'No se pudo procesar el documento')
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo seleccionar el archivo')
    }
  }

  const handleConfirmImport = () => {
    Alert.alert('Importado', 'Las transacciones se agregarán a tu cuenta', [
      {
        text: 'OK',
        onPress: () => {
          setResult(null)
          setFileName(null)
          onImported?.()
        },
      },
    ])
  }

  const handleOAuthConnect = async (provider: 'bbva' | 'santander' | 'belvo') => {
    const account = await syncOAuth(provider, 'mock_auth_code')
    if (account) {
      Alert.alert('Conectado', `Cuenta de ${provider.toUpperCase()} sincronizada correctamente`)
    } else {
      Alert.alert('Error', 'No se pudo conectar la cuenta')
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Importar estado de cuenta</Text>
        <Text style={styles.sectionSub}>
          Sube un PDF o imagen de tu estado de cuenta y extraemos los movimientos automáticamente.
        </Text>

        <TouchableOpacity
          style={[styles.uploadButton, { borderColor: color }]}
          onPress={handlePickDocument}
          disabled={extracting}
          activeOpacity={0.8}
        >
          <Text style={[styles.uploadButtonText, { color }]}>
            {extracting ? 'Procesando...' : '📄 Seleccionar archivo (PDF/Imagen)'}
          </Text>
        </TouchableOpacity>

        {extracting && (
          <ActivityIndicator size="small" color={color} style={{ marginTop: 12 }} />
        )}

        {fileName && !extracting && (
          <Text style={styles.fileName}>{fileName}</Text>
        )}
      </View>

      {result && (
        <View style={styles.section}>
          <View style={styles.resultHeader}>
            <Text style={styles.sectionTitle}>Movimientos detectados</Text>
            <Text style={[styles.confidence, { color: result.confidence > 0.85 ? '#10b981' : '#f59e0b' }]}>
              {(result.confidence * 100).toFixed(0)}% confianza
            </Text>
          </View>

          {result.transactions.map((t, i) => (
            <View key={i} style={styles.txnRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.txnDesc} numberOfLines={1}>{t.description}</Text>
                <Text style={styles.txnDate}>
                  {new Date(t.transaction_date).toLocaleDateString('es-MX')}
                </Text>
              </View>
              <Text style={[styles.txnAmount, { color: t.amount >= 0 ? '#10b981' : '#ef4444' }]}>
                {t.amount >= 0 ? '+' : ''}{formatCurrency(t.amount)}
              </Text>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.confirmButton, { backgroundColor: color }]}
            onPress={handleConfirmImport}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmButtonText}>
              Importar {result.transactions.length} movimiento{result.transactions.length !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>O conecta tu banco automáticamente</Text>
        <Text style={styles.sectionSub}>
          Sincroniza tus movimientos sin subir archivos manualmente.
        </Text>

        {PROVIDERS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={styles.providerRow}
            onPress={() => handleOAuthConnect(p.key)}
            disabled={syncing}
            activeOpacity={0.8}
          >
            <Text style={styles.providerIcon}>{p.icon}</Text>
            <Text style={styles.providerLabel}>{p.label}</Text>
            <Text style={styles.providerArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
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
  sectionSub: { color: '#94a3b8', fontSize: 12, marginBottom: 14, lineHeight: 17 },

  uploadButton: {
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 10,
    paddingVertical: 20, alignItems: 'center',
  },
  uploadButtonText: { fontSize: 14, fontWeight: '700' },
  fileName: { color: '#cbd5e1', fontSize: 12, marginTop: 10, textAlign: 'center' },

  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  confidence: { fontSize: 12, fontWeight: '700' },

  txnRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  txnDesc: { color: '#f1f5f9', fontSize: 13, fontWeight: '600' },
  txnDate: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  txnAmount: { fontSize: 14, fontWeight: '700' },

  confirmButton: { borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  confirmButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  providerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#0f172a', borderRadius: 10, padding: 14, marginBottom: 8,
  },
  providerIcon: { fontSize: 18 },
  providerLabel: { flex: 1, color: '#f1f5f9', fontSize: 13, fontWeight: '600' },
  providerArrow: { color: '#64748b', fontSize: 18 },
})
