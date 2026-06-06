import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useOcr } from '../hooks/useOcr';
import { BRAND } from '@gastocheck/shared';

export default function CaptureScreen() {
  const router = useRouter();
  const { extractFromImage, loading } = useOcr();

  const [photo, setPhoto] = useState<{ uri: string; base64?: string } | null>(null);
  const [extracted, setExtracted] = useState<any>(null);
  const [step, setStep] = useState<'camera' | 'confirm'>('camera');

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;

    const res = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: true,
    });

    if (res.canceled || !res.assets[0]) return;

    const asset = res.assets[0];
    setPhoto({ uri: asset.uri, base64: asset.base64 });

    // Enviar a OCR
    if (asset.base64) {
      const result = await extractFromImage(asset.base64, 'image/jpeg');
      if (result) {
        setExtracted(result);
        setStep('confirm');
      }
    }
  }

  function handleConfirm() {
    // TODO: Guardar expense en Supabase
    router.back();
  }

  if (step === 'confirm' && photo && extracted) {
    return (
      <ScrollView style={{ backgroundColor: BRAND.gray, flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Confirma los datos</Text>
          <Text style={styles.subtitle}>
            Confianza: <Text style={styles.confidence}>{extracted.confidence}</Text>
          </Text>
        </View>

        <View style={styles.photoContainer}>
          <Image source={{ uri: photo.uri }} style={styles.photo} />
        </View>

        <View style={styles.form}>
          <Field label="Proveedor" value={extracted.proveedor} editable />
          <Field label="Total" value={String(extracted.total ?? '')} editable keyboardType="decimal-pad" />
          <Field label="Subtotal" value={String(extracted.subtotal ?? '')} keyboardType="decimal-pad" />
          <Field label="IVA" value={String(extracted.iva ?? '')} keyboardType="decimal-pad" />
          <Field
            label="Fecha"
            value={extracted.fecha || ''}
            editable
            placeholder="YYYY-MM-DD"
          />

          {extracted.conceptos?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Conceptos</Text>
              {extracted.conceptos.map((c: any, i: number) => (
                <View key={i} style={styles.concepto}>
                  <Text style={styles.conceptoDesc}>{c.descripcion}</Text>
                  <Text style={styles.conceptoImporte}>$ {c.importe}</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Text style={styles.confirmBtnText}>✓ Guardar gasto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: '#ccc' }]}
            onPress={() => setStep('camera')}
          >
            <Text style={styles.confirmBtnText}>Retomar foto</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Capturar ticket</Text>
        <Text style={styles.subtitle}>Toma foto clara del ticket o recibo</Text>
      </View>

      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>📷</Text>
        <Text style={styles.placeholderLabel}>Foto no tomada</Text>
      </View>

      <TouchableOpacity
        style={[styles.cameraBtn, loading && { opacity: 0.6 }]}
        onPress={takePhoto}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.cameraBtnText}>📷 Tomar foto</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
        <Text style={styles.cancelBtnText}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
}

function Field({
  label,
  value,
  editable,
  keyboardType,
  placeholder,
}: {
  label: string;
  value: string;
  editable?: boolean;
  keyboardType?: 'default' | 'decimal-pad';
  placeholder?: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        editable={editable}
        keyboardType={keyboardType}
        placeholder={placeholder}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.gray,
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: BRAND.navy,
  },
  subtitle: {
    fontSize: 14,
    color: '#90A4AE',
    marginTop: 4,
  },
  confidence: {
    color: BRAND.orange,
    fontWeight: '700',
  },
  placeholder: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 60,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: 48,
  },
  placeholderLabel: {
    fontSize: 14,
    color: '#90A4AE',
    marginTop: 8,
  },
  photoContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  photo: {
    width: '100%',
    height: 300,
  },
  form: {
    marginBottom: 24,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#90A4AE',
    fontWeight: '600',
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: BRAND.navy,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  section: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.navy,
    marginBottom: 8,
  },
  concepto: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  conceptoDesc: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  conceptoImporte: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND.navy,
  },
  cameraBtn: {
    backgroundColor: BRAND.blue,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  cameraBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: BRAND.blue,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: BRAND.blue,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: BRAND.green,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
