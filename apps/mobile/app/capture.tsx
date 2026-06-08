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
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useOcr } from '../hooks/useOcr';
import { supabase } from '../lib/supabase';
import { BRAND } from '@gastocheck/shared';

export default function CaptureScreen() {
  const router = useRouter();
  const { extractFromImage, loading: ocrLoading } = useOcr();

  const [photo, setPhoto] = useState<{ uri: string; base64?: string } | null>(null);
  const [extracted, setExtracted] = useState<any>(null);
  const [step, setStep] = useState<'camera' | 'confirm'>('camera');
  const [saving, setSaving] = useState(false);

  // Campos editables en el paso "confirm"
  const [proveedor, setProveedor] = useState('');
  const [total, setTotal] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [iva, setIva] = useState('');
  const [fecha, setFecha] = useState('');

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara para tomar fotos');
      return;
    }

    const res = await ImagePicker.launchCameraAsync({ quality: 0.8, base64: true });
    if (res.canceled || !res.assets[0]) return;

    const asset = res.assets[0];
    setPhoto({ uri: asset.uri, base64: asset.base64 });

    if (asset.base64) {
      const result = await extractFromImage(asset.base64, 'image/jpeg');
      if (result) {
        setExtracted(result);
        setProveedor(result.proveedor ?? '');
        setTotal(String(result.total ?? ''));
        setSubtotal(String(result.subtotal ?? ''));
        setIva(String(result.iva ?? ''));
        setFecha(result.fecha ?? '');
        setStep('confirm');
      }
    }
  }

  async function handleConfirm() {
    if (!photo?.base64) return;
    setSaving(true);

    try {
      // 1. Obtener usuario autenticado
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error('No autenticado');

      // 2. Obtener la póliza abierta más reciente del usuario
      const { data: policies, error: polErr } = await supabase
        .from('policies')
        .select('id, company_id, name')
        .eq('holder_id', user.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1);

      if (polErr) throw new Error('Error obteniendo póliza: ' + polErr.message);
      if (!policies || policies.length === 0) {
        Alert.alert(
          'Sin póliza activa',
          'No tienes una póliza abierta. Pide a tu supervisor que cree una.',
        );
        setSaving(false);
        return;
      }

      const policy = policies[0];

      // 3. Insertar gasto en BD
      const { data: expense, error: expErr } = await supabase
        .from('expenses')
        .insert({
          company_id: policy.company_id,
          policy_id: policy.id,
          spender_id: user.id,
          provider_name: proveedor || null,
          subtotal: subtotal ? parseFloat(subtotal) : null,
          iva: iva ? parseFloat(iva) : null,
          total: parseFloat(total) || 0,
          expense_date: fecha || new Date().toISOString().slice(0, 10),
          status: 'captured',
        })
        .select('id')
        .single();

      if (expErr || !expense) throw new Error('Error guardando gasto: ' + expErr?.message);

      // 4. Subir foto a Supabase Storage
      const fileName = `${Date.now()}.jpg`;
      const storagePath = `${policy.company_id}/${expense.id}/${fileName}`;
      const arrayBuffer = decode(photo.base64);

      const { error: storErr } = await supabase.storage
        .from('expense-attachments')
        .upload(storagePath, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

      // 5. Registrar attachment (aunque falle el storage, el gasto ya fue guardado)
      if (!storErr) {
        await supabase.from('expense_attachments').insert({
          company_id: policy.company_id,
          expense_id: expense.id,
          kind: 'ticket',
          storage_path: storagePath,
          mime: 'image/jpeg',
          ocr_raw: extracted,
        });
      }

      // 6. Audit: registrar creación
      await supabase.from('expense_audit').insert({
        company_id: policy.company_id,
        expense_id: expense.id,
        actor_id: user.id,
        action: 'created',
        to_status: 'captured',
        payload: { source: 'mobile_camera', ocr_confidence: extracted?.confidence },
      });

      Alert.alert(
        '✓ Gasto guardado',
        `Ticket de ${proveedor || 'proveedor'} por $${total} registrado correctamente.`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo guardar el gasto');
    } finally {
      setSaving(false);
    }
  }

  const busy = ocrLoading || saving;

  // ── Paso: Confirmar datos ────────────────────────────────────
  if (step === 'confirm' && photo) {
    return (
      <ScrollView style={{ backgroundColor: BRAND.gray, flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Confirma los datos</Text>
          <Text style={styles.subtitle}>
            Confianza OCR:{' '}
            <Text style={[styles.confidence, {
              color: extracted?.confidence === 'high'
                ? BRAND.green
                : extracted?.confidence === 'medium' ? BRAND.orange : BRAND.red,
            }]}>
              {extracted?.confidence ?? '—'}
            </Text>
          </Text>
        </View>

        <View style={styles.photoContainer}>
          <Image source={{ uri: photo.uri }} style={styles.photo} />
        </View>

        <View style={styles.form}>
          <Field label="Proveedor" value={proveedor} onChangeText={setProveedor} />
          <Field label="Total" value={total} onChangeText={setTotal} keyboardType="decimal-pad" />
          <Field label="Subtotal" value={subtotal} onChangeText={setSubtotal} keyboardType="decimal-pad" />
          <Field label="IVA" value={iva} onChangeText={setIva} keyboardType="decimal-pad" />
          <Field label="Fecha (YYYY-MM-DD)" value={fecha} onChangeText={setFecha} placeholder="2026-06-08" />

          {extracted?.conceptos?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Conceptos detectados</Text>
              {extracted.conceptos.map((c: any, i: number) => (
                <View key={i} style={styles.concepto}>
                  <Text style={styles.conceptoDesc}>{c.descripcion}</Text>
                  <Text style={styles.conceptoImporte}>$ {c.importe}</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.confirmBtn, busy && { opacity: 0.6 }]}
            onPress={handleConfirm}
            disabled={busy}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.confirmBtnText}>✓ Guardar gasto</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: '#ccc' }]}
            onPress={() => { setStep('camera'); setPhoto(null); setExtracted(null); }}
            disabled={busy}
          >
            <Text style={styles.confirmBtnText}>Retomar foto</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ── Paso: Cámara ─────────────────────────────────────────────
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
        style={[styles.cameraBtn, busy && { opacity: 0.6 }]}
        onPress={takePhoto}
        disabled={busy}
      >
        {ocrLoading
          ? <><ActivityIndicator color="#fff" /><Text style={[styles.cameraBtnText, { marginLeft: 8 }]}>Analizando...</Text></>
          : <Text style={styles.cameraBtnText}>📷 Tomar foto</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} disabled={busy}>
        <Text style={styles.cancelBtnText}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
}

function Field({
  label, value, onChangeText, keyboardType, placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'decimal-pad';
  placeholder?: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#B0BEC5"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.gray, padding: 16 },
  header: { marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', color: BRAND.navy },
  subtitle: { fontSize: 14, color: '#90A4AE', marginTop: 4 },
  confidence: { fontWeight: '700' },
  placeholder: {
    backgroundColor: '#fff', borderRadius: 16, paddingVertical: 60,
    alignItems: 'center', marginBottom: 24, borderWidth: 2,
    borderColor: '#E0E0E0', borderStyle: 'dashed',
  },
  placeholderText: { fontSize: 48 },
  placeholderLabel: { fontSize: 14, color: '#90A4AE', marginTop: 8 },
  photoContainer: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 24 },
  photo: { width: '100%', height: 260 },
  form: { marginBottom: 24 },
  fieldGroup: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, color: '#90A4AE', fontWeight: '600', marginBottom: 4 },
  fieldInput: {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 14, color: BRAND.navy,
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  section: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: BRAND.navy, marginBottom: 8 },
  concepto: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  conceptoDesc: { fontSize: 13, color: '#666', flex: 1 },
  conceptoImporte: { fontSize: 13, fontWeight: '600', color: BRAND.navy },
  cameraBtn: {
    backgroundColor: BRAND.blue, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 10, flexDirection: 'row', justifyContent: 'center',
  },
  cameraBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: {
    borderWidth: 1, borderColor: BRAND.blue, borderRadius: 14,
    paddingVertical: 12, alignItems: 'center',
  },
  cancelBtnText: { color: BRAND.blue, fontSize: 16, fontWeight: '600' },
  confirmBtn: {
    backgroundColor: BRAND.green, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginBottom: 10,
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
