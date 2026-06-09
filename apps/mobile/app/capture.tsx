// Captura de comprobante: foto → OCR → verificación duplicados → guardar
import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  ScrollView, Image, TextInput, Alert, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useOcr } from '../hooks/useOcr';
import { supabase } from '../lib/supabase';
import {
  BRAND, DUPLICATE_STATUS_META,
  type DuplicateStatus,
} from '@gastocheck/shared';

// ── Tipos locales ─────────────────────────────────────────────────────────────

interface DuplicateMatch {
  receipt_id:    string;
  match_type:    string;
  score:         number;
  reason:        string;
  provider_name: string | null;
  receipt_date:  string | null;
  total_amount:  number | null;
}

interface DuplicateResult {
  duplicate_status: DuplicateStatus;
  should_block:     boolean;
  message:          string;
  matches:          DuplicateMatch[];
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function CaptureScreen() {
  const router = useRouter();
  const { extractFromImage, loading: ocrLoading } = useOcr();

  const [photo,      setPhoto]      = useState<{ uri: string; base64?: string } | null>(null);
  const [extracted,  setExtracted]  = useState<any>(null);
  const [step,       setStep]       = useState<'camera' | 'confirm'>('camera');
  const [saving,     setSaving]     = useState(false);

  // Campos editables
  const [proveedor,  setProveedor]  = useState('');
  const [rfc,        setRfc]        = useState('');
  const [total,      setTotal]      = useState('');
  const [subtotal,   setSubtotal]   = useState('');
  const [iva,        setIva]        = useState('');
  const [fecha,      setFecha]      = useState('');
  const [folio,      setFolio]      = useState('');

  // Anti-duplicados
  const [dupResult,  setDupResult]  = useState<DuplicateResult | null>(null);
  const [showDupModal, setShowDupModal] = useState(false);
  const [forceReason,  setForceReason] = useState('');

  // ── Tomar foto ─────────────────────────────────────────────────────────────

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara para tomar fotos');
      return;
    }

    const res = await ImagePicker.launchCameraAsync({ quality: 0.85, base64: true });
    if (res.canceled || !res.assets[0]) return;

    const asset = res.assets[0];
    setPhoto({ uri: asset.uri, base64: asset.base64 });

    if (asset.base64) {
      const result = await extractFromImage(asset.base64, 'image/jpeg');
      if (result) {
        setExtracted(result);
        setProveedor(result.providerName   ?? '');
        setRfc(      result.providerRfc    ?? '');
        setTotal(    String(result.total   ?? ''));
        setSubtotal( String(result.subtotal ?? ''));
        setIva(      String(result.tax     ?? ''));
        setFecha(    result.receiptDate    ?? '');
        setFolio(    result.internalFolio  ?? '');
        setStep('confirm');
      }
    }
  }

  // ── Verificar duplicados antes de guardar ─────────────────────────────────

  async function checkDuplicate(): Promise<DuplicateResult | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: policies } = await supabase
        .from('policies')
        .select('company_id')
        .eq('holder_id', user.id)
        .eq('status', 'open')
        .limit(1);

      if (!policies?.length) return null;

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return null;

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/check-duplicate`,
        {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            company_id:    policies[0].company_id,
            fiscal_uuid:   extracted?.fiscalUuid  ?? null,
            provider_name: proveedor               || null,
            provider_rfc:  rfc                     || null,
            receipt_date:  fecha                   || null,
            total_amount:  parseFloat(total)       || null,
          }),
        },
      );

      if (!res.ok) return null;
      const data = await res.json();
      return data as DuplicateResult;
    } catch {
      return null;
    }
  }

  // ── Guardar comprobante ────────────────────────────────────────────────────

  async function handleConfirm(forceSave = false, forceRsn = '') {
    if (!photo?.base64) return;
    setSaving(true);
    setShowDupModal(false);

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error('No autenticado');

      const { data: policies, error: polErr } = await supabase
        .from('policies')
        .select('id, company_id')
        .eq('holder_id', user.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1);

      if (polErr) throw new Error('Error obteniendo póliza: ' + polErr.message);
      if (!policies?.length) {
        Alert.alert('Sin póliza activa', 'Pide a tu supervisor que cree una póliza para ti.');
        return;
      }

      const policy = policies[0];

      // Subir foto a Storage
      const fileName    = `${Date.now()}.jpg`;
      const storagePath = `${policy.company_id}/${Date.now()}/${fileName}`;
      const arrayBuffer = decode(photo.base64);

      const { error: storErr } = await supabase.storage
        .from('expense-attachments')
        .upload(storagePath, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

      if (storErr) console.warn('Storage upload warn:', storErr.message);

      // Llamar a submit-receipt (crea receipt + expense + supplier + purchase_items)
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';

      const submitRes = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/submit-receipt`,
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            company_id:       policy.company_id,
            policy_id:        policy.id,
            employee_id:      user.id,
            source_type:      'photo',
            file_storage_path: storErr ? null : storagePath,
            provider_name:    proveedor   || null,
            provider_rfc:     rfc         || null,
            receipt_date:     fecha       || new Date().toISOString().slice(0, 10),
            total_amount:     parseFloat(total)    || null,
            subtotal_amount:  parseFloat(subtotal) || null,
            tax_amount:       parseFloat(iva)      || null,
            fiscal_uuid:      extracted?.fiscalUuid ?? null,
            internal_folio:   folio      || null,
            payment_method:   extracted?.paymentMethod ?? null,
            ocr_text:         extracted?.fullText ?? null,
            ocr_confidence:   extracted?.confidence === 'high' ? 90
                            : extracted?.confidence === 'medium' ? 65 : 40,
            extracted_json:   extracted ?? null,
            line_items:       extracted?.lineItems ?? [],
            force_save:       forceSave,
            force_reason:     forceRsn || null,
          }),
        },
      );

      const submitData = await submitRes.json();

      // Si está bloqueado por duplicado exacto (UUID o hash)
      if (!submitRes.ok && submitData.blocked) {
        setDupResult(submitData as DuplicateResult);

        if (submitData.duplicate_status === 'blocked_duplicate') {
          // No se puede forzar — mostrar alerta permanente
          Alert.alert(
            '🚫 Comprobante bloqueado',
            submitData.message,
            [{ text: 'Entendido' }],
          );
        } else {
          // Se puede forzar con motivo — mostrar modal
          setShowDupModal(true);
        }
        return;
      }

      if (!submitRes.ok) {
        throw new Error(submitData.error ?? 'Error al guardar');
      }

      // Éxito
      const dupStatus = submitData.duplicate_status;
      const dupMeta   = DUPLICATE_STATUS_META[dupStatus as DuplicateStatus];

      Alert.alert(
        '✓ Comprobante guardado',
        `${proveedor || 'Proveedor'} · $${total}\n${
          dupStatus !== 'no_duplicate'
            ? `\n⚠ ${dupMeta?.label ?? 'Duplicado probable'} — revisará el supervisor`
            : ''
        }`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo guardar el comprobante');
    } finally {
      setSaving(false);
    }
  }

  // ── Antes de guardar: verificar duplicados ────────────────────────────────

  async function handlePressConfirm() {
    setSaving(true);
    const dup = await checkDuplicate();
    setSaving(false);

    if (dup && dup.duplicate_status !== 'no_duplicate') {
      setDupResult(dup);
      setShowDupModal(true);
    } else {
      handleConfirm(false);
    }
  }

  const busy = ocrLoading || saving;

  // ── Modal de duplicado ─────────────────────────────────────────────────────

  if (showDupModal && dupResult) {
    const isBlocked = dupResult.duplicate_status === 'blocked_duplicate';
    const dupMeta   = DUPLICATE_STATUS_META[dupResult.duplicate_status];

    return (
      <Modal visible animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={[styles.modalIcon]}>{dupMeta?.icon ?? '⚠'}</Text>
            <Text style={[styles.modalTitle, { color: dupMeta?.color ?? BRAND.orange }]}>
              {dupMeta?.label ?? 'Duplicado detectado'}
            </Text>
            <Text style={styles.modalBody}>{dupResult.message}</Text>

            {dupResult.matches.slice(0, 2).map((m, i) => (
              <View key={i} style={styles.matchRow}>
                <Text style={styles.matchText}>
                  {m.provider_name ?? 'Proveedor'} · {m.receipt_date ?? ''} ·{' '}
                  {m.total_amount != null
                    ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(m.total_amount)
                    : ''}
                </Text>
              </View>
            ))}

            {!isBlocked && (
              <>
                <Text style={styles.forceLabel}>Motivo para guardar de todas formas:</Text>
                <TextInput
                  style={styles.forceInput}
                  value={forceReason}
                  onChangeText={setForceReason}
                  placeholder="Ej: Es un comprobante diferente del mismo proveedor"
                  placeholderTextColor="#B0BEC5"
                  multiline
                />
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: BRAND.blue, borderWidth: 1 }]}
                onPress={() => { setShowDupModal(false); setForceReason(''); }}
              >
                <Text style={[styles.modalBtnText, { color: BRAND.blue }]}>
                  {isBlocked ? 'Entendido' : 'Cancelar'}
                </Text>
              </TouchableOpacity>

              {!isBlocked && (
                <TouchableOpacity
                  style={[
                    styles.modalBtn,
                    { backgroundColor: BRAND.orange },
                    !forceReason.trim() && { opacity: 0.5 },
                  ]}
                  onPress={() => handleConfirm(true, forceReason)}
                  disabled={!forceReason.trim()}
                >
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>
                    Guardar con advertencia
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Paso: Confirmar datos ─────────────────────────────────────────────────

  if (step === 'confirm' && photo) {
    return (
      <ScrollView style={{ backgroundColor: BRAND.gray, flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Confirma los datos</Text>
          <Text style={styles.subtitle}>
            Confianza OCR:{' '}
            <Text style={[styles.confidence, {
              color: extracted?.confidence === 'high'   ? BRAND.green
                   : extracted?.confidence === 'medium' ? BRAND.orange
                   : BRAND.red,
            }]}>
              {extracted?.confidence === 'high' ? 'Alta'
               : extracted?.confidence === 'medium' ? 'Media' : 'Baja'}
            </Text>
          </Text>
          {extracted?.warnings?.length > 0 && (
            <View style={styles.warningBox}>
              {extracted.warnings.map((w: string, i: number) => (
                <Text key={i} style={styles.warningText}>⚠ {w}</Text>
              ))}
            </View>
          )}
        </View>

        <View style={styles.photoContainer}>
          <Image source={{ uri: photo.uri }} style={styles.photo} />
        </View>

        <View style={styles.form}>
          <Field label="Proveedor / Emisor"       value={proveedor}  onChangeText={setProveedor} />
          <Field label="RFC Emisor (si lo tiene)"  value={rfc}        onChangeText={setRfc} />
          <Field label="Total"          value={total}    onChangeText={setTotal}   keyboardType="decimal-pad" />
          <Field label="Subtotal"       value={subtotal} onChangeText={setSubtotal} keyboardType="decimal-pad" />
          <Field label="IVA"            value={iva}      onChangeText={setIva}     keyboardType="decimal-pad" />
          <Field label="Fecha (YYYY-MM-DD)" value={fecha} onChangeText={setFecha}
                 placeholder={new Date().toISOString().slice(0, 10)} />
          <Field label="Folio (si aplica)" value={folio} onChangeText={setFolio} />

          {extracted?.fiscalUuid && (
            <View style={styles.cfdiBox}>
              <Text style={styles.cfdiLabel}>✅ CFDI detectado</Text>
              <Text style={styles.cfdiUuid} numberOfLines={1}>{extracted.fiscalUuid}</Text>
            </View>
          )}

          {extracted?.lineItems?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Productos / conceptos detectados</Text>
              {extracted.lineItems.slice(0, 6).map((c: any, i: number) => (
                <View key={i} style={styles.concepto}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.conceptoDesc}>{c.name}</Text>
                    {c.quantity != null && (
                      <Text style={styles.conceptoQty}>
                        {c.quantity} {c.unit ?? ''} × ${c.unitPrice ?? '—'}
                      </Text>
                    )}
                  </View>
                  {c.totalPrice != null && (
                    <Text style={styles.conceptoImporte}>
                      ${c.totalPrice}
                    </Text>
                  )}
                </View>
              ))}
              {extracted.lineItems.length > 6 && (
                <Text style={styles.moreItems}>
                  +{extracted.lineItems.length - 6} conceptos más...
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.confirmBtn, busy && { opacity: 0.6 }]}
            onPress={handlePressConfirm}
            disabled={busy}
          >
            {saving
              ? <><ActivityIndicator color="#fff" />
                  <Text style={[styles.confirmBtnText, { marginLeft: 8 }]}>Verificando...</Text></>
              : <Text style={styles.confirmBtnText}>✓ Guardar comprobante</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn]}
            onPress={() => { setStep('camera'); setPhoto(null); setExtracted(null); setDupResult(null); }}
            disabled={busy}
          >
            <Text style={styles.secondaryBtnText}>Retomar foto</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ── Paso: Cámara ───────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Capturar comprobante</Text>
        <Text style={styles.subtitle}>Toma foto clara del ticket o recibo</Text>
      </View>

      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>📷</Text>
        <Text style={styles.placeholderLabel}>Foto no tomada</Text>
        <Text style={styles.placeholderHint}>La IA detectará proveedor, monto y productos</Text>
      </View>

      <TouchableOpacity style={[styles.cameraBtn, busy && { opacity: 0.6 }]}
        onPress={takePhoto} disabled={busy}>
        {ocrLoading
          ? <><ActivityIndicator color="#fff" />
              <Text style={[styles.cameraBtnText, { marginLeft: 8 }]}>Analizando...</Text></>
          : <Text style={styles.cameraBtnText}>📷 Tomar foto del ticket</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} disabled={busy}>
        <Text style={styles.cancelBtnText}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Componente Field ──────────────────────────────────────────────────────────

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

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: BRAND.gray, padding: 16 },
  header:          { marginBottom: 20 },
  title:           { fontSize: 24, fontWeight: '800', color: BRAND.navy },
  subtitle:        { fontSize: 14, color: '#90A4AE', marginTop: 4 },
  confidence:      { fontWeight: '700' },
  warningBox:      { backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10, marginTop: 8 },
  warningText:     { fontSize: 12, color: '#E65100', marginBottom: 2 },
  placeholder:     {
    backgroundColor: '#fff', borderRadius: 16, paddingVertical: 48,
    alignItems: 'center', marginBottom: 24, borderWidth: 2,
    borderColor: '#E0E0E0', borderStyle: 'dashed',
  },
  placeholderText:  { fontSize: 48 },
  placeholderLabel: { fontSize: 14, color: '#90A4AE', marginTop: 8 },
  placeholderHint:  { fontSize: 12, color: '#B0BEC5', marginTop: 4 },
  photoContainer:  { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  photo:           { width: '100%', height: 260 },
  form:            { marginBottom: 24 },
  fieldGroup:      { marginBottom: 12 },
  fieldLabel:      { fontSize: 13, color: '#90A4AE', fontWeight: '600', marginBottom: 4 },
  fieldInput:      {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 14, color: BRAND.navy,
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  cfdiBox:        { backgroundColor: '#E8F5E9', borderRadius: 12, padding: 12, marginBottom: 12 },
  cfdiLabel:      { fontSize: 12, fontWeight: '700', color: '#2E7D32' },
  cfdiUuid:       { fontSize: 11, color: '#388E3C', marginTop: 2, fontFamily: 'monospace' },
  section:        { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  sectionTitle:   { fontSize: 13, fontWeight: '700', color: BRAND.navy, marginBottom: 8 },
  concepto:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  conceptoDesc:   { fontSize: 13, color: '#333', flex: 1, fontWeight: '500' },
  conceptoQty:    { fontSize: 11, color: '#90A4AE' },
  conceptoImporte:{ fontSize: 13, fontWeight: '600', color: BRAND.navy },
  moreItems:      { fontSize: 12, color: '#90A4AE', marginTop: 4 },
  cameraBtn:      {
    backgroundColor: BRAND.blue, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 10, flexDirection: 'row', justifyContent: 'center',
  },
  cameraBtnText:  { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn:      {
    borderWidth: 1, borderColor: BRAND.blue, borderRadius: 14,
    paddingVertical: 12, alignItems: 'center',
  },
  cancelBtnText:  { color: BRAND.blue, fontSize: 16, fontWeight: '600' },
  confirmBtn:     {
    backgroundColor: BRAND.green, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginBottom: 10, flexDirection: 'row', justifyContent: 'center',
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn:   {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 14,
    paddingVertical: 12, alignItems: 'center',
  },
  secondaryBtnText: { color: '#666', fontSize: 16 },
  // Modal de duplicado
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox:      { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalIcon:     { fontSize: 32, textAlign: 'center', marginBottom: 8 },
  modalTitle:    { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  modalBody:     { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  matchRow:      { backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10, marginBottom: 6 },
  matchText:     { fontSize: 13, color: '#E65100' },
  forceLabel:    { fontSize: 13, fontWeight: '600', color: BRAND.navy, marginTop: 12, marginBottom: 6 },
  forceInput:    {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 12,
    padding: 10, fontSize: 13, color: BRAND.navy, minHeight: 64,
  },
  modalButtons:  { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBtn:      {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
  },
  modalBtnText:  { fontSize: 14, fontWeight: '700' },
});
