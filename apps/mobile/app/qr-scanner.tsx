// QR Scanner completo con expo-camera
import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BRAND } from '@gastocheck/shared';

const QR_UUID_PATTERN = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;

export default function QrScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [detected, setDetected] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  function handleQrScanned(data: string) {
    if (scanned) return;

    const match = data.match(QR_UUID_PATTERN);
    if (match) {
      setScanned(true);
      setDetected(match[0]);

      Alert.alert(
        '✅ UUID detectado',
        match[0],
        [
          { text: 'Cancelar', onPress: () => setScanned(false) },
          {
            text: 'Usar',
            onPress: () => {
              router.push({
                pathname: '/capture',
                params: { fiscal_uuid: match[0] },
              });
            },
          },
        ],
      );
    } else {
      Alert.alert('⚠️ No se detectó UUID', 'QR no contiene UUID fiscal válido');
    }
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Permiso de cámara requerido</Text>
        </View>
        <View style={styles.message}>
          <Text style={styles.messageText}>
            GastoCheck necesita acceso a la cámara para escanear códigos QR.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={requestPermission}>
            <Text style={styles.btnText}>Permitir cámara</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={({ data }) => handleQrScanned(data)}
      />

      {/* Overlay con instrucciones */}
      <View style={styles.overlay}>
        <View style={styles.header}>
          <Text style={styles.title}>Escanear QR CFDI</Text>
        </View>

        <View style={styles.guide}>
          <View style={styles.guideScanArea} />
          <Text style={styles.guideText}>Apunta al código QR del ticket</Text>
        </View>

        {detected && (
          <View style={styles.detectedBox}>
            <Text style={styles.detectedLabel}>UUID: {detected.slice(0, 8)}...</Text>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#000' },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  camera:         { flex: 1 },
  overlay:        { position: 'absolute', inset: 0, justifyContent: 'space-between', padding: 16 },
  header:         { backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 12, padding: 12 },
  title:          { fontSize: 18, fontWeight: '700', color: '#fff' },
  guide:          { alignItems: 'center', justifyContent: 'center' },
  guideScanArea:  {
    width: 250, height: 250, borderWidth: 2, borderColor: BRAND.blue,
    borderRadius: 12, marginBottom: 16,
  },
  guideText:      { fontSize: 14, color: '#fff', fontWeight: '600' },
  detectedBox:    { backgroundColor: 'rgba(67, 160, 71, 0.9)', borderRadius: 8, padding: 12, marginBottom: 16 },
  detectedLabel:  { fontSize: 12, color: '#fff', fontWeight: '700' },
  actions:        { flexDirection: 'row', gap: 8 },
  cancelBtn:      { flex: 1, backgroundColor: 'rgba(229, 57, 53, 0.8)', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  cancelText:     { color: '#fff', fontSize: 14, fontWeight: '700' },
  manualBtn:      { flex: 1, backgroundColor: 'rgba(21, 101, 192, 0.8)', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  manualText:     { color: '#fff', fontSize: 14, fontWeight: '700' },
  message:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 12, padding: 24, justifyContent: 'center', alignItems: 'center' },
  messageText:    { color: '#fff', fontSize: 14, marginBottom: 16, textAlign: 'center', lineHeight: 20 },
  btn:            { backgroundColor: BRAND.blue, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24 },
  btnText:        { color: '#fff', fontSize: 14, fontWeight: '700' },
});
