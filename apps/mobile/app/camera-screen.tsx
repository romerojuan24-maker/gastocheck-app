import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions, type FlashMode } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { BRAND } from '@gastocheck/shared';

export default function CameraWithFlashScreen() {
  const router = useRouter();
  const { viaticoId } = useLocalSearchParams<{ viaticoId?: string }>();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [flash,   setFlash]   = useState<FlashMode>('off');
  const [facing,  setFacing]  = useState<'back' | 'front'>('back');

  if (!permission) return <View style={{ flex: 1 }} />;

  if (!permission.granted) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', gap: 16 }]}>
        <Text style={{ color: '#fff', fontSize: 15, textAlign: 'center', paddingHorizontal: 24 }}>
          Necesitamos permiso para usar la cámara
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Dar permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const flashLabel = { off: 'Off', on: 'On', auto: 'Auto' } as Record<FlashMode, string>;
  const flashIcon  = { off: '🔦', on: '⚡', auto: '🤖' } as Record<FlashMode, string>;
  const flashCycle: FlashMode[] = ['off', 'on', 'auto'];

  async function takePicture() {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5, base64: false });
      if (!photo) return;
      router.push({
        pathname: '/capture',
        params: { photoUri: photo.uri, ...(viaticoId ? { viaticoId } : {}) },
      } as any);
    } catch {
      Alert.alert('Error', 'No se pudo capturar la foto');
    }
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        facing={facing}
        flash={flash}
        style={styles.camera}
      />

      {/* Controles superior */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => {
            const next = flashCycle[(flashCycle.indexOf(flash) + 1) % flashCycle.length];
            setFlash(next);
          }}
        >
          <Text style={styles.controlIcon}>{flashIcon[flash]}</Text>
          <Text style={styles.controlLabel}>{flashLabel[flash]}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
        >
          <Text style={styles.controlIcon}>🔄</Text>
          <Text style={styles.controlLabel}>Voltear</Text>
        </TouchableOpacity>
      </View>

      {/* Botón disparador */}
      <View style={styles.captureContainer}>
        <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
          <View style={styles.captureCircle} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#000' },
  camera:           { flex: 1 },
  controls: {
    position: 'absolute', top: 60, left: 16, right: 16,
    flexDirection: 'row', gap: 12,
  },
  controlBtn: {
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  controlIcon:      { fontSize: 20 },
  controlLabel:     { color: '#fff', fontSize: 10, fontWeight: '600' },
  captureContainer: { backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 30, alignItems: 'center' },
  captureBtn: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
  },
  captureCircle:    { width: 60, height: 60, borderRadius: 30, backgroundColor: BRAND.blue },
  permBtn: {
    backgroundColor: BRAND.blue, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
});
