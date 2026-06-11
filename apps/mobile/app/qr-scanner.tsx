// QR Scanner para CFDI — extrae UUID fiscal rápidamente
import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND } from '@gastocheck/shared';

// TODO: Integrar expo-camera para preview real
// Por ahora: placeholder con explicación del flujo

const QR_UUID_PATTERN = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;

export default function QrScannerScreen() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [detected, setDetected] = useState<string | null>(null);

  function handleQrDetected(data: string) {
    // Extraer UUID si está en el QR
    const match = data.match(QR_UUID_PATTERN);
    if (match) {
      setDetected(match[0]);
      Alert.alert(
        '✅ UUID detectado',
        match[0],
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Usar este UUID',
            onPress: () => {
              // Navegar a capture con UUID pre-llenado
              router.push({
                pathname: '/capture',
                params: { fiscal_uuid: match[0] },
              });
            },
          },
        ],
      );
    } else {
      Alert.alert('⚠️ No se detectó UUID', 'El código QR no contiene un UUID fiscal válido');
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Escanear QR CFDI</Text>
        <Text style={styles.subtitle}>Apunta a la esquina del ticket con QR fiscal</Text>
      </View>

      {/* Placeholder: en producción sería Camera de expo-camera */}
      <View style={styles.cameraPlaceholder}>
        <Text style={styles.placeholderIcon}>📷</Text>
        <Text style={styles.placeholderText}>Cámara QR</Text>
        <Text style={styles.placeholderHint}>
          Integración con expo-camera — extrae UUID del QR en 100ms
        </Text>

        {detected && (
          <View style={styles.detectedBox}>
            <Text style={styles.detectedLabel}>UUID detectado:</Text>
            <Text style={styles.detectedUuid}>{detected}</Text>
          </View>
        )}
      </View>

      {scanning && (
        <View style={styles.scanningOverlay}>
          <ActivityIndicator size="large" color={BRAND.blue} />
          <Text style={styles.scanningText}>Escaneando...</Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.manualBtn} onPress={() => router.back()}>
          <Text style={styles.manualText}>Capturar manual</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.info}>
        <Text style={styles.infoTitle}>ℹ️ ¿Cómo usar?</Text>
        <Text style={styles.infoText}>
          1. Abre el ticket con el código QR fiscal{'\n'}
          2. Apunta la cámara al QR{'\n'}
          3. El sistema extrae el UUID automáticamente{'\n'}
          4. Confirma y el resto se llena solo
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: BRAND.gray, padding: 16 },
  header:            { marginBottom: 20 },
  title:             { fontSize: 24, fontWeight: '800', color: BRAND.navy },
  subtitle:          { fontSize: 14, color: '#90A4AE', marginTop: 4 },
  cameraPlaceholder: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    alignItems: 'center', justifyContent: 'center', minHeight: 300,
    marginBottom: 16, borderWidth: 2, borderColor: BRAND.blue, borderDashPattern: [5, 5],
  },
  placeholderIcon:   { fontSize: 64, marginBottom: 12 },
  placeholderText:   { fontSize: 16, fontWeight: '700', color: BRAND.navy },
  placeholderHint:   { fontSize: 12, color: '#90A4AE', marginTop: 8, textAlign: 'center' },
  detectedBox:       { backgroundColor: '#E8F5E9', borderRadius: 12, padding: 12, marginTop: 16, width: '100%' },
  detectedLabel:     { fontSize: 12, fontWeight: '700', color: '#2E7D32' },
  detectedUuid:      { fontSize: 13, color: '#388E3C', marginTop: 4, fontFamily: 'monospace' },
  scanningOverlay:   { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', borderRadius: 16 },
  scanningText:      { marginTop: 12, color: '#fff', fontSize: 14, fontWeight: '600' },
  actions:           { flexDirection: 'row', gap: 8, marginBottom: 16 },
  cancelBtn:         { flex: 1, backgroundColor: '#FFEBEE', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelText:        { color: BRAND.red, fontSize: 15, fontWeight: '700' },
  manualBtn:         { flex: 1, backgroundColor: BRAND.blue, borderRadius: 12, padding: 14, alignItems: 'center' },
  manualText:        { color: '#fff', fontSize: 15, fontWeight: '700' },
  info:              { backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  infoTitle:         { fontSize: 13, fontWeight: '700', color: BRAND.navy, marginBottom: 8 },
  infoText:          { fontSize: 12, color: '#90A4AE', lineHeight: 18 },
});
