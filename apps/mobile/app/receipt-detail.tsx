// Pantalla de detalle de comprobante
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Image, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  BRAND, RECEIPT_STATUS_META, DUPLICATE_STATUS_META,
  canEditReceipt, canAddToBatch,
} from '@gastocheck/shared';
import type { Receipt, ReceiptStatus, DuplicateStatus } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

const money = (n: number | null) =>
  n == null ? '—' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const SOURCE_ICONS: Record<string, string> = {
  photo: '📷', pdf: '📄', xml: '📋', manual: '✏️',
};

export default function ReceiptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();

  const [receipt,   setReceipt]   = useState<Receipt | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [myRole,    setMyRole]    = useState<string>('employee');
  const [actioning, setActioning] = useState(false);
  const [photoUrl,  setPhotoUrl]  = useState<string | null>(null);
  const [vehicleName, setVehicleName] = useState<string | null>(null);
  const [operatorName, setOperatorName] = useState<string | null>(null);
  const [uploadingCfdi, setUploadingCfdi] = useState(false);
  const [capturedByName, setCapturedByName] = useState<string | null>(null);

  // ── Cargar comprobante ─────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const [{ data: rec }, { data: member }] = await Promise.all([
        supabase.from('receipts').select('*').eq('id', id).single(),
        user
          ? supabase.from('company_members').select('role').eq('user_id', user.id).single()
          : Promise.resolve({ data: null }),
      ]);

      const r = rec as Receipt;
      setReceipt(r);
      setMyRole(member?.role ?? 'employee');

      // Cargar nombre de vehículo y operador si existen
      if ((r as any).vehicle_id) {
        const { data: v } = await supabase
          .from('vehicles')
          .select('economic_number, brand, model')
          .eq('id', (r as any).vehicle_id)
          .single();
        if (v) setVehicleName(`${v.brand} ${v.model} (${v.economic_number})`);
      }
      if ((r as any).operator_id) {
        const { data: o } = await supabase
          .from('operators')
          .select('name')
          .eq('id', (r as any).operator_id)
          .single();
        if (o) setOperatorName(o.name);
      }

      // Quién capturó el comprobante
      const capturerId = (r as any).uploaded_by ?? (r as any).employee_id;
      if (capturerId) {
        const { data: capturer } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', capturerId)
          .maybeSingle();
        if (capturer?.full_name) setCapturedByName(capturer.full_name);
      }

      // Generar URL firmada para la foto (bucket privado, 2h de validez)
      if (r?.file_storage_path && r.source_type !== 'xml') {
        const { data: signed } = await supabase.storage
          .from('expense-attachments')
          .createSignedUrl(r.file_storage_path, 7200);
        if (signed?.signedUrl) setPhotoUrl(signed.signedUrl);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Adjuntar CFDI/ZIP ──────────────────────────────────────────────────────

  async function handleAttachCfdi() {
    if (!receipt) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/xml', 'application/xml', 'application/zip', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];

      setUploadingCfdi(true);

      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const ext  = file.name.split('.').pop() ?? 'xml';
      const path = `${(receipt as any).company_id}/${receipt.id}/cfdi.${ext}`;
      const mimeType = file.mimeType ?? (ext === 'zip' ? 'application/zip' : 'application/xml');

      const { error: upErr } = await supabase.storage
        .from('expense-attachments')
        .upload(path, decode(base64), { contentType: mimeType, upsert: true });

      if (upErr) throw upErr;

      const { error: updateErr } = await supabase
        .from('receipts')
        .update({ cfdi_url: path })
        .eq('id', receipt.id);

      if (updateErr) throw updateErr;

      Alert.alert('✓ Archivo adjuntado', `"${file.name}" adjuntado exitosamente.`);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo adjuntar el archivo');
    } finally {
      setUploadingCfdi(false);
    }
  }

  async function handleViewCfdi() {
    if (!receipt) return;
    const path = (receipt as any).cfdi_url;
    if (!path) return;
    const { data } = await supabase.storage.from('expense-attachments').createSignedUrl(path, 3600);
    if (data?.signedUrl) await Linking.openURL(data.signedUrl);
  }

  // ── Acciones ───────────────────────────────────────────────────────────────

  async function doAction(action: 'submit' | 'cancel') {
    if (!receipt) return;
    const nextStatus: ReceiptStatus = action === 'submit' ? 'submitted' : 'cancelled';
    const confirm = action === 'submit'
      ? { title: 'Enviar a revisión', msg: 'El comprobante pasará al supervisor para aprobación.' }
      : { title: 'Cancelar comprobante', msg: 'Esta acción no se puede deshacer.' };

    Alert.alert(confirm.title, confirm.msg, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: action === 'submit' ? 'Enviar' : 'Sí, cancelar',
        style: action === 'cancel' ? 'destructive' : 'default',
        onPress: async () => {
          setActioning(true);
          const { error } = await supabase
            .from('receipts')
            .update({ status: nextStatus })
            .eq('id', receipt.id);
          setActioning(false);
          if (error) { Alert.alert('Error', error.message); return; }
          load();
        },
      },
    ]);
  }

  async function doApproveReject(action: 'approve' | 'reject') {
    if (!receipt) return;
    const isReject = action === 'reject';

    const promptReason = () =>
      new Promise<string | null>((resolve) => {
        if (!isReject) return resolve('');
        Alert.prompt('Motivo de rechazo', 'Escribe el motivo (opcional)', [
          { text: 'Cancelar', onPress: () => resolve(null), style: 'cancel' },
          { text: 'Rechazar', onPress: (v) => resolve(v ?? '') },
        ]);
      });

    const reason = await promptReason();
    if (reason === null) return;

    setActioning(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('receipts')
      .update({
        status:           isReject ? 'rejected' : 'approved',
        approved_by:      isReject ? null : user?.id,
        approved_at:      isReject ? null : new Date().toISOString(),
        rejected_by:      isReject ? user?.id : null,
        rejected_at:      isReject ? new Date().toISOString() : null,
        rejection_reason: isReject ? reason || null : null,
      })
      .eq('id', receipt.id);
    setActioning(false);
    if (error) { Alert.alert('Error', error.message); return; }
    load();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  if (!receipt) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 48 }}>🔍</Text>
        <Text style={styles.emptyText}>Comprobante no encontrado</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.linkText}>← Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusMeta = RECEIPT_STATUS_META[receipt.status];
  const dupMeta    = DUPLICATE_STATUS_META[receipt.duplicate_status];
  const isDup      = receipt.duplicate_status !== 'no_duplicate';
  const canEdit    = canEditReceipt(receipt.status);
  const canBatch   = canAddToBatch(receipt.status, receipt.duplicate_status);
  const isSupervisor = myRole === 'admin' || myRole === 'supervisor';

  return (
    <ScrollView style={{ backgroundColor: BRAND.gray }} contentContainerStyle={styles.scroll}>

      {/* ── Encabezado de estado ── */}
      <View style={[styles.statusBanner, { backgroundColor: statusMeta.color + '18' }]}>
        <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
        <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
        {isDup && (
          <View style={[styles.dupChip, { backgroundColor: dupMeta.color + '20' }]}>
            <Text style={[styles.dupChipText, { color: dupMeta.color }]}>
              {dupMeta.icon} {dupMeta.label}
            </Text>
          </View>
        )}
      </View>

      {/* ── Foto del comprobante ── */}
      {photoUrl ? (
        <View style={styles.photoCard}>
          <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="contain" />
        </View>
      ) : receipt?.source_type === 'xml' ? (
        <View style={[styles.photoCard, styles.xmlPlaceholder]}>
          <Text style={{ fontSize: 36 }}>📄</Text>
          <Text style={{ fontSize: 13, color: '#607D8B', marginTop: 6, fontWeight: '600' }}>CFDI XML</Text>
          {receipt.fiscal_uuid && (
            <Text style={{ fontSize: 10, color: '#90A4AE', marginTop: 4, fontFamily: 'monospace' }} numberOfLines={1}>
              {receipt.fiscal_uuid}
            </Text>
          )}
        </View>
      ) : null}

      {/* ── Proveedor y monto ── */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>
          {SOURCE_ICONS[receipt.source_type] ?? '📎'} {receipt.provider_name ?? '(sin proveedor)'}
        </Text>
        <Text style={styles.bigAmount}>{money(receipt.total_amount)}</Text>
        <Text style={styles.cardSub}>
          {receipt.receipt_date ?? receipt.created_at?.slice(0, 10) ?? '—'}
          {receipt.receipt_time ? ` · ${receipt.receipt_time}` : ''}
        </Text>

        {/* Rejección */}
        {receipt.status === 'rejected' && receipt.rejection_reason && (
          <View style={styles.rejBanner}>
            <Text style={styles.rejText}>🚫 {receipt.rejection_reason}</Text>
          </View>
        )}
      </View>

      {/* ── Control: quién y cuándo capturó, folio interno (solo no-fiscales) ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Control</Text>
        {capturedByName && <InfoRow label="Capturado por" value={capturedByName} />}
        <InfoRow
          label="Fecha de captura"
          value={receipt.created_at?.slice(0, 16)?.replace('T', ' ') ?? '—'}
        />
        {(receipt as any).gc_folio && (
          <InfoRow label="Folio GastoCheck" value={(receipt as any).gc_folio} />
        )}
      </View>

      {/* ── Vehículo y Operador (Flota) ── */}
      {(vehicleName || operatorName) && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Información de Flota</Text>
          {vehicleName && <InfoRow label="Vehículo" value={vehicleName} />}
          {operatorName && <InfoRow label="Operador" value={operatorName} />}
        </View>
      )}

      {/* ── Datos fiscales ── */}
      {(receipt.fiscal_uuid || receipt.provider_rfc || receipt.subtotal_amount != null) && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Datos fiscales</Text>
          {receipt.provider_rfc     && <InfoRow label="RFC Emisor"    value={receipt.provider_rfc} />}
          {receipt.fiscal_uuid      && <InfoRow label="UUID CFDI"     value={receipt.fiscal_uuid} mono />}
          {receipt.internal_folio   && <InfoRow label="Folio interno" value={receipt.internal_folio} />}
          {receipt.payment_method   && <InfoRow label="Forma de pago" value={receipt.payment_method} />}
          {receipt.subtotal_amount != null && <InfoRow label="Subtotal" value={money(receipt.subtotal_amount)} />}
          {receipt.tax_amount != null      && <InfoRow label="IVA"      value={money(receipt.tax_amount)} />}
          {receipt.total_amount != null    && <InfoRow label="Total"    value={money(receipt.total_amount)} bold />}
        </View>
      )}

      {/* ── Validación SAT ── */}
      {receipt.fiscal_uuid && (() => {
        const sat = (receipt as any).sat_validation_status as string | null;
        const reason = (receipt as any).sat_validation_reason as string | null;
        const at = (receipt as any).sat_validation_at as string | null;
        const isOk   = sat === 'validated';
        const isFail = sat === 'cancelled' || sat === 'not_found';
        const isErr  = sat === 'error';
        const pending = !sat;

        const icon  = isOk ? '✅' : isFail ? '❌' : isErr ? '⚠️' : '⏳';
        const label = isOk   ? 'CFDI Vigente en el SAT'
          : sat === 'cancelled'  ? 'CFDI Cancelado en el SAT'
          : sat === 'not_found'  ? 'CFDI No Encontrado en el SAT'
          : isErr  ? 'SAT no respondió al verificar'
          : 'Pendiente de verificación en el SAT';
        const color = isOk ? '#2E7D32' : isFail ? '#C62828' : isErr ? '#E65100' : '#90A4AE';
        const bg    = isOk ? '#E8F5E9' : isFail ? '#FFEBEE' : isErr ? '#FFF3E0' : '#F5F5F5';

        return (
          <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: color }]}>
            <Text style={styles.sectionTitle}>Verificación SAT</Text>
            <View style={[styles.satBanner, { backgroundColor: bg }]}>
              <Text style={styles.satIcon}>{icon}</Text>
              <Text style={[styles.satLabel, { color }]}>{label}</Text>
            </View>
            {reason && <InfoRow label="Código SAT" value={reason} />}
            {at && <InfoRow label="Verificado el" value={at.slice(0, 16).replace('T', ' ')} />}
            {pending && (
              <Text style={styles.satHint}>
                La verificación ocurre automáticamente al asignar este comprobante a una póliza.
              </Text>
            )}
          </View>
        );
      })()}

      {/* ── Confianza OCR ── */}
      {receipt.ocr_confidence != null && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Lectura OCR</Text>
          <View style={styles.ocrBar}>
            <View
              style={[
                styles.ocrFill,
                {
                  width: `${receipt.ocr_confidence}%`,
                  backgroundColor:
                    receipt.ocr_confidence >= 75 ? BRAND.green
                    : receipt.ocr_confidence >= 50 ? BRAND.orange
                    : BRAND.red,
                },
              ]}
            />
          </View>
          <Text style={styles.ocrPct}>
            {receipt.ocr_confidence}% de confianza
            {receipt.ocr_confidence >= 75 ? ' · Alta' : receipt.ocr_confidence >= 50 ? ' · Media' : ' · Baja'}
          </Text>
        </View>
      )}

      {/* ── Notas ── */}
      {receipt.notes && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Notas</Text>
          <Text style={styles.noteText}>{receipt.notes}</Text>
        </View>
      )}

      {/* ── Relación ── */}
      {receipt.batch_id && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Relación contable</Text>
          <TouchableOpacity
            style={styles.batchLink}
            onPress={() => router.push(`/batch-detail?id=${receipt.batch_id}`)}
          >
            <Text style={styles.batchLinkText}>📁 Ver relación →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Proveedor ── */}
      {receipt.supplier_id && (
        <TouchableOpacity
          style={styles.providerBtn}
          onPress={() => router.push(`/supplier-detail?id=${receipt.supplier_id}`)}
        >
          <Text style={styles.providerBtnText}>🏪 Ver historial del proveedor</Text>
        </TouchableOpacity>
      )}

      {/* ── CFDI / ZIP adjunto ── */}
      {(receipt as any).cfdi_url ? (
        <TouchableOpacity
          style={[styles.providerBtn, { backgroundColor: '#E8F5E9' }]}
          onPress={handleViewCfdi}
        >
          <Text style={[styles.providerBtnText, { color: BRAND.green }]}>📎 Ver CFDI adjunto</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.providerBtn, uploadingCfdi && { opacity: 0.5 }]}
          onPress={handleAttachCfdi}
          disabled={uploadingCfdi}
        >
          {uploadingCfdi ? (
            <ActivityIndicator color={BRAND.blue} size="small" />
          ) : (
            <Text style={styles.providerBtnText}>📎 Adjuntar XML / CFDI / ZIP</Text>
          )}
        </TouchableOpacity>
      )}

      {/* ── Acciones del empleado ── */}
      {canEdit && (
        <View style={styles.actions}>
          {/* Los comprobantes se agrupan en un Reembolso — no se envían individualmente */}
          {receipt.status === 'captured' && (
            <View style={{ backgroundColor: '#E8F5E9', borderRadius: 12, padding: 12, marginBottom: 8 }}>
              <Text style={{ color: '#2E7D32', fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
                ✅ Comprobante guardado
              </Text>
              <Text style={{ color: '#388E3C', fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                Ve a Mis Reembolsos para incluirlo en un reembolso
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#FFEBEE' }]}
            onPress={() => doAction('cancel')}
            disabled={actioning}
          >
            <Text style={[styles.actionBtnText, { color: BRAND.red }]}>
              {actioning ? '…' : '🗑 Cancelar comprobante'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Acciones del supervisor ── */}
      {isSupervisor && receipt.status === 'submitted' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: BRAND.green }]}
            onPress={() => doApproveReject('approve')}
            disabled={actioning}
          >
            <Text style={styles.actionBtnText}>✅ Aprobar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#FFEBEE' }]}
            onPress={() => doApproveReject('reject')}
            disabled={actioning}
          >
            <Text style={[styles.actionBtnText, { color: BRAND.red }]}>❌ Rechazar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Acción según rol ── */}
      {canBatch && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#E8F5E9', borderRadius: 12, marginHorizontal: 0 }]}
          onPress={() => {
            if (isSupervisor) {
              // Supervisor/Admin: agregar a relación contable (póliza)
              router.push('/batches');
            } else {
              // Comprador: solicitar reembolso con este recibo
              router.push({ pathname: '/reembolso', params: { ids: receipt.id } } as any);
            }
          }}
        >
          <Text style={[styles.actionBtnText, { color: BRAND.green }]}>
            {isSupervisor ? '📁 Agregar a relación contable' : '💸 Solicitar Reembolso'}
          </Text>
        </TouchableOpacity>
      )}

      <Text style={styles.meta}>
        ID: {receipt.id.slice(0, 8)}…
        {'\n'}Creado: {receipt.created_at?.slice(0, 16)?.replace('T', ' ') ?? '—'}
      </Text>

    </ScrollView>
  );
}

function InfoRow({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={[infoStyles.value, mono && infoStyles.mono, bold && infoStyles.bold]} numberOfLines={1} ellipsizeMode="middle">
        {value}
      </Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  label: { fontSize: 13, color: '#90A4AE', flex: 1 },
  value: { fontSize: 13, color: BRAND.navy, flex: 2, textAlign: 'right' },
  mono:  { fontFamily: 'monospace', fontSize: 11 },
  bold:  { fontWeight: '700' },
});

const styles = StyleSheet.create({
  scroll:       { padding: 16, paddingBottom: 40 },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: BRAND.gray },
  emptyText:    { fontSize: 16, color: '#90A4AE', marginTop: 8 },
  linkText:     { color: BRAND.blue, fontSize: 15, marginTop: 12 },

  statusBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 12, marginBottom: 12, gap: 8 },
  statusDot:    { width: 10, height: 10, borderRadius: 5 },
  statusText:   { fontSize: 14, fontWeight: '700', flex: 1 },
  dupChip:      { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  dupChipText:  { fontSize: 11, fontWeight: '700' },

  card:         { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardLabel:    { fontSize: 16, fontWeight: '700', color: BRAND.navy, marginBottom: 4 },
  bigAmount:    { fontSize: 34, fontWeight: '800', color: BRAND.navy, marginVertical: 4 },
  cardSub:      { fontSize: 13, color: '#90A4AE' },
  rejBanner:    { backgroundColor: '#FFEBEE', borderRadius: 10, padding: 10, marginTop: 10 },
  rejText:      { fontSize: 13, color: BRAND.red, fontWeight: '600' },

  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 8 },
  noteText:     { fontSize: 14, color: BRAND.navy, lineHeight: 20 },

  satBanner:    { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 10, gap: 8, marginBottom: 8 },
  satIcon:      { fontSize: 20 },
  satLabel:     { fontSize: 14, fontWeight: '700', flex: 1 },
  satHint:      { fontSize: 12, color: '#90A4AE', lineHeight: 18, marginTop: 4 },

  ocrBar:       { height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  ocrFill:      { height: 8, borderRadius: 4 },
  ocrPct:       { fontSize: 13, color: BRAND.navy },

  batchLink:    { backgroundColor: BRAND.gray, borderRadius: 10, padding: 12 },
  batchLinkText:{ color: BRAND.blue, fontWeight: '700', fontSize: 14 },

  providerBtn:  { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0' },
  providerBtnText: { color: BRAND.navy, fontSize: 15, fontWeight: '600' },

  actions:      { gap: 10, marginBottom: 12 },
  actionBtn:    { padding: 15, borderRadius: 12, alignItems: 'center' },
  actionBtnText:{ fontSize: 15, fontWeight: '700', color: '#fff' },

  meta:         { fontSize: 11, color: '#B0BEC5', textAlign: 'center', lineHeight: 18, marginTop: 8 },

  photoCard:    {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    marginBottom: 12, borderWidth: 1, borderColor: '#F0F0F0',
  },
  photo:        { width: '100%', height: 260 },
  xmlPlaceholder: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28 },
});
