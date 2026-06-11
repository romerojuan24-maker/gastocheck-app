// Detalle de relación contable — ver comprobantes, agregar/quitar, cerrar, exportar, validar SAT
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, ScrollView, Modal, TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  BRAND, BATCH_STATUS_META, RECEIPT_STATUS_META, DUPLICATE_STATUS_META,
  EXPORT_FORMAT_META, type ExportFormat,
  canAddReceiptToBatch, canCloseBatch, canReopenBatch, canExportBatch,
  canRemoveReceiptFromBatch, summarizeBatch,
} from '@gastocheck/shared';
import type { BatchStatus, ReceiptStatus, DuplicateStatus } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

interface BatchDetail {
  id:           string;
  name:         string;
  status:       BatchStatus;
  period_start: string | null;
  period_end:   string | null;
  notes:        string | null;
}

interface ReceiptInBatch {
  id:               string;
  provider_name:    string | null;
  total_amount:     number | null;
  receipt_date:     string | null;
  status:           ReceiptStatus;
  duplicate_status: DuplicateStatus;
  subtotal_amount:  number | null;
  tax_amount:       number | null;
  category_name?:   string | null;
}

interface AvailableReceipt {
  id:            string;
  provider_name: string | null;
  total_amount:  number | null;
  receipt_date:  string | null;
  status:        string;
}

export default function BatchDetailScreen() {
  const { id: batch_id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [batch,     setBatch]     = useState<BatchDetail | null>(null);
  const [receipts,  setReceipts]  = useState<ReceiptInBatch[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [busy,      setBusy]      = useState(false);
  const [showAdd,   setShowAdd]   = useState(false);
  const [available, setAvailable] = useState<AvailableReceipt[]>([]);
  const [loadingAv, setLoadingAv] = useState(false);
  const [reopenReason,    setReopenReason]    = useState('');
  const [showReopen,      setShowReopen]      = useState(false);
  const [validatingSat,   setValidatingSat]   = useState(false);
  const [showExport,      setShowExport]      = useState(false);
  const [exportFormat,    setExportFormat]    = useState<ExportFormat>('universal_excel');
  const [exporting,       setExporting]       = useState(false);

  // ── Cargar datos ──────────────────────────────────────────────────────────

  const loadBatch = useCallback(async () => {
    if (!batch_id) return;
    setLoading(true);
    try {
      const { data: b } = await supabase
        .from('receipt_batches')
        .select('id, name, status, period_start, period_end, notes')
        .eq('id', batch_id)
        .single();
      if (b) setBatch(b as BatchDetail);

      const { data: items } = await supabase
        .from('receipt_batch_items')
        .select(`
          receipt:receipts!receipt_batch_items_receipt_id_fkey(
            id, provider_name, total_amount, receipt_date, status,
            duplicate_status, subtotal_amount, tax_amount,
            category:expense_categories!receipts_category_id_fkey(name)
          )
        `)
        .eq('batch_id', batch_id);

      const recs = (items ?? [])
        .map((i: any) => i.receipt)
        .filter(Boolean)
        .map((r: any) => ({ ...r, category_name: r.category?.name ?? null }));
      setReceipts(recs);
    } finally {
      setLoading(false);
    }
  }, [batch_id]);

  useEffect(() => { loadBatch(); }, [loadBatch]);

  // ── Cargar disponibles para agregar ──────────────────────────────────────

  async function loadAvailable() {
    if (!batch?.id) return;
    setLoadingAv(true);

    // Obtener IDs ya en la relación
    const { data: existing } = await supabase
      .from('receipt_batch_items')
      .select('receipt_id')
      .eq('batch_id', batch_id);
    const existingIds = (existing ?? []).map((e: any) => e.receipt_id);

    // Comprobantes aprobados sin relación
    let q = supabase
      .from('receipts')
      .select('id, provider_name, total_amount, receipt_date, status')
      .in('status', ['approved', 'submitted'])
      .is('batch_id', null)
      .order('receipt_date', { ascending: false })
      .limit(60);

    if (existingIds.length > 0) {
      q = q.not('id', 'in', `(${existingIds.join(',')})`);
    }

    const { data } = await q;
    setAvailable((data ?? []) as AvailableReceipt[]);
    setLoadingAv(false);
  }

  // ── Agregar comprobante ───────────────────────────────────────────────────

  async function addReceipt(receipt_id: string) {
    if (!batch_id) return;
    const { error } = await supabase
      .from('receipt_batch_items')
      .insert({ batch_id, receipt_id, company_id: receipts[0]?.id ?? undefined });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      // Actualizar estado del comprobante
      await supabase.from('receipts').update({ status: 'included_in_batch', batch_id }).eq('id', receipt_id);
      await loadBatch();
      setAvailable((prev) => prev.filter((r) => r.id !== receipt_id));
    }
  }

  // ── Quitar comprobante ───────────────────────────────────────────────────

  async function removeReceipt(receipt_id: string) {
    Alert.alert('Quitar comprobante', '¿Seguro? El comprobante volverá a estado "aprobado".', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar', style: 'destructive',
        onPress: async () => {
          await supabase.from('receipt_batch_items')
            .delete().eq('batch_id', batch_id).eq('receipt_id', receipt_id);
          await supabase.from('receipts')
            .update({ status: 'approved', batch_id: null }).eq('id', receipt_id);
          await loadBatch();
        },
      },
    ]);
  }

  // ── Validar contra SAT ────────────────────────────────────────────────────

  async function validateBatchSat() {
    if (!batch_id) return;
    setValidatingSat(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        Alert.alert('Sin sesión', 'Inicia sesión nuevamente');
        return;
      }

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/validate-batch-sat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            batch_id,
            company_id: batch?.id,
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Error validación', data.error ?? 'No se pudo validar contra SAT');
        return;
      }

      const msg = `✅ ${data.validated_count} comprobantes validados` +
        (data.blocked?.length > 0 ? `\n⚠️ ${data.blocked.length} bloqueados` : '');
      Alert.alert('Validación SAT', msg);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setValidatingSat(false);
    }
  }

  // ── Cerrar relación ───────────────────────────────────────────────────────

  async function closeBatch() {
    Alert.alert(
      'Cerrar relación',
      'Se validarán todos los comprobantes contra SAT antes de cerrar. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar',
          onPress: async () => {
            setBusy(true);
            try {
              // Validar primero
              await validateBatchSat();
              // Luego cerrar
              await supabase.from('receipt_batches')
                .update({ status: 'closed', closed_at: new Date().toISOString() })
                .eq('id', batch_id);
              loadBatch();
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  // ── Exportar ─────────────────────────────────────────────────────────────

  async function triggerExport() {
    if (!batch) return;
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        Alert.alert('Sin sesión', 'Inicia sesión nuevamente');
        return;
      }

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-export`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            company_id: batch.id,
            batch_id: batch_id,
            format: exportFormat,
          }),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Error exportando');

      // Descargar (en móvil: compartir o guardar)
      const base64 = json.content;
      const bin = atob(base64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);

      Alert.alert(
        '✓ Exportación lista',
        `${json.row_count} comprobantes en ${json.filename}.\n\nEn web puedes descargar directamente.`,
      );
      setShowExport(false);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setExporting(false);
    }
  }

  // ── Reabrir relación ─────────────────────────────────────────────────────

  async function reopenBatch() {
    if (!reopenReason.trim()) return;
    setBusy(true);
    await supabase.from('receipt_batches')
      .update({ status: 'open', reopen_reason: reopenReason })
      .eq('id', batch_id);
    setShowReopen(false);
    setReopenReason('');
    setBusy(false);
    loadBatch();
  }

  // ── Renderizado ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  if (!batch) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#90A4AE' }}>Relación no encontrada</Text>
      </View>
    );
  }

  const meta    = BATCH_STATUS_META[batch.status];
  const summary = summarizeBatch(receipts);
  const canAdd  = canAddReceiptToBatch(batch.status);
  const canClose = canCloseBatch(batch.status, receipts.length);
  const canReopen = canReopenBatch(batch.status);
  const canExport = canExportBatch(batch.status);

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      <ScrollView>
        {/* Encabezado */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <Text style={styles.batchName}>{batch.name}</Text>
            <View style={[styles.badge, { backgroundColor: meta.color + '20' }]}>
              <Text style={[styles.badgeText, { color: meta.color }]}>
                {meta.icon} {meta.label}
              </Text>
            </View>
          </View>
          {batch.period_start && (
            <Text style={styles.period}>
              {batch.period_start} — {batch.period_end ?? '…'}
            </Text>
          )}
          {batch.notes && <Text style={styles.notes}>{batch.notes}</Text>}
        </View>

        {/* Totales */}
        <View style={styles.totalsCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Comprobantes</Text>
            <Text style={styles.totalValue}>{summary.receiptCount}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{money(summary.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>IVA</Text>
            <Text style={styles.totalValue}>{money(summary.tax)}</Text>
          </View>
          <View style={[styles.totalRow, styles.totalRowLast]}>
            <Text style={[styles.totalLabel, { fontWeight: '700' }]}>Total</Text>
            <Text style={[styles.totalValue, { fontSize: 18, color: BRAND.blue }]}>
              {money(summary.total)}
            </Text>
          </View>
        </View>

        {/* Acciones */}
        <View style={styles.actionsRow}>
          {canAdd && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: BRAND.blue }]}
              onPress={() => { setShowAdd(true); loadAvailable(); }}
            >
              <Text style={styles.actionBtnText}>+ Agregar</Text>
            </TouchableOpacity>
          )}
          {canClose && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: BRAND.green }]}
              onPress={closeBatch}
              disabled={busy || validatingSat}
            >
              <Text style={styles.actionBtnText}>✓ Cerrar</Text>
            </TouchableOpacity>
          )}
          {batch.status === 'open' && receipts.length > 0 && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#1565C0' }]}
              onPress={validateBatchSat}
              disabled={validatingSat}
            >
              <Text style={styles.actionBtnText}>
                {validatingSat ? '⏳ SAT...' : '🔐 Validar SAT'}
              </Text>
            </TouchableOpacity>
          )}
          {canReopen && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#FF9800' }]}
              onPress={() => setShowReopen(true)}
            >
              <Text style={styles.actionBtnText}>↩ Reabrir</Text>
            </TouchableOpacity>
          )}
          {canExport && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#7B1FA2' }]}
              onPress={() => setShowExport(true)}
            >
              <Text style={styles.actionBtnText}>📤 Exportar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Lista de comprobantes */}
        <Text style={styles.sectionTitle}>Comprobantes ({receipts.length})</Text>
        {receipts.map((r) => {
          const sMeta  = RECEIPT_STATUS_META[r.status];
          const dupMeta = DUPLICATE_STATUS_META[r.duplicate_status];
          const isDup  = r.duplicate_status !== 'no_duplicate';
          return (
            <View key={r.id} style={[styles.receiptCard, isDup && styles.receiptWarning]}>
              <View style={styles.receiptRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.providerText} numberOfLines={1}>
                    {r.provider_name ?? '(sin proveedor)'}
                  </Text>
                  <Text style={styles.dateText}>{r.receipt_date ?? '—'}</Text>
                  {isDup && (
                    <Text style={[styles.dupText, { color: dupMeta?.color ?? '#FF9800' }]}>
                      {dupMeta?.icon} {dupMeta?.label}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.amountText}>{money(r.total_amount ?? 0)}</Text>
                  {sMeta && (
                    <Text style={[styles.statusText, { color: sMeta.color }]}>{sMeta.label}</Text>
                  )}
                </View>
                {canRemoveReceiptFromBatch(batch.status) && (
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removeReceipt(r.id)}
                  >
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        {receipts.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Sin comprobantes. Toca "+ Agregar" para incluirlos.</Text>
          </View>
        )}
      </ScrollView>

      {/* Modal: Agregar comprobantes */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowAdd(false)}>
        <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Text style={styles.modalClose}>Cerrar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Agregar comprobantes</Text>
            <View style={{ width: 60 }} />
          </View>
          {loadingAv ? (
            <View style={styles.center}><ActivityIndicator color={BRAND.blue} /></View>
          ) : (
            <FlatList
              data={available}
              keyExtractor={(r) => r.id}
              contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
              renderItem={({ item: r }) => (
                <TouchableOpacity
                  style={styles.availableCard}
                  onPress={() => addReceipt(r.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.providerText} numberOfLines={1}>
                      {r.provider_name ?? '(sin proveedor)'}
                    </Text>
                    <Text style={styles.dateText}>{r.receipt_date ?? '—'} · {r.status}</Text>
                  </View>
                  <Text style={styles.amountText}>{money(r.total_amount ?? 0)}</Text>
                  <Text style={{ color: BRAND.blue, marginLeft: 8, fontWeight: '700' }}>+</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No hay comprobantes disponibles para agregar.</Text>
              }
            />
          )}
        </View>
      </Modal>

      {/* Modal: Reabrir */}
      <Modal visible={showReopen} animationType="slide" transparent onRequestClose={() => setShowReopen(false)}>
        <View style={styles.reopenOverlay}>
          <View style={styles.reopenCard}>
            <Text style={styles.reopenTitle}>Motivo para reabrir</Text>
            <TextInput
              style={styles.reopenInput}
              placeholder="Ej: Se omitió un comprobante..."
              value={reopenReason}
              onChangeText={setReopenReason}
              multiline
            />
            <View style={styles.reopenBtns}>
              <TouchableOpacity onPress={() => setShowReopen(false)}>
                <Text style={{ color: '#90A4AE', fontSize: 15 }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#FF9800' }, !reopenReason.trim() && { opacity: 0.4 }]}
                onPress={reopenBatch}
                disabled={!reopenReason.trim() || busy}
              >
                <Text style={styles.actionBtnText}>Reabrir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Exportar */}
      <Modal visible={showExport} animationType="slide" transparent onRequestClose={() => setShowExport(false)}>
        <View style={styles.reopenOverlay}>
          <View style={styles.reopenCard}>
            <Text style={styles.reopenTitle}>Exportar relación</Text>
            <Text style={{ fontSize: 13, color: '#90A4AE', marginBottom: 12 }}>
              Elige el formato contable
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {(Object.keys(EXPORT_FORMAT_META) as ExportFormat[]).map((fmt) => {
                const m = EXPORT_FORMAT_META[fmt];
                return (
                  <TouchableOpacity
                    key={fmt}
                    style={[
                      styles.exportOption,
                      exportFormat === fmt && { backgroundColor: BRAND.blue, borderColor: BRAND.blue },
                    ]}
                    onPress={() => setExportFormat(fmt)}
                  >
                    <Text style={[
                      styles.exportOptionText,
                      exportFormat === fmt && { color: '#fff' },
                    ]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.reopenBtns}>
              <TouchableOpacity onPress={() => setShowExport(false)} disabled={exporting}>
                <Text style={{ color: '#90A4AE', fontSize: 15 }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#7B1FA2' }, exporting && { opacity: 0.6 }]}
                onPress={triggerExport}
                disabled={exporting}
              >
                <Text style={styles.actionBtnText}>
                  {exporting ? '⏳ Exportando...' : '📤 Exportar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerCard:      { backgroundColor: '#fff', margin: 12, borderRadius: 14, padding: 16 },
  headerRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  batchName:       { flex: 1, fontSize: 18, fontWeight: '700', color: BRAND.navy, marginRight: 8 },
  badge:           { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:       { fontSize: 12, fontWeight: '700' },
  period:          { color: '#90A4AE', fontSize: 12, marginTop: 4 },
  notes:           { color: '#90A4AE', fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  totalsCard:      { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 8, borderRadius: 14, padding: 16 },
  totalRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalRowLast:    { borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 4, paddingTop: 10 },
  totalLabel:      { fontSize: 14, color: '#90A4AE' },
  totalValue:      { fontSize: 14, fontWeight: '600', color: BRAND.navy },
  actionsRow:      { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  actionBtn:       { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  actionBtnText:   { color: '#fff', fontSize: 13, fontWeight: '700' },
  sectionTitle:    { fontSize: 14, fontWeight: '700', color: '#90A4AE', paddingHorizontal: 16, paddingBottom: 6, textTransform: 'uppercase' },
  receiptCard:     {
    backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 12,
    marginBottom: 6, padding: 12, borderWidth: 1, borderColor: '#F0F0F0',
  },
  receiptWarning:  { borderColor: '#FFA000' },
  receiptRow:      { flexDirection: 'row', alignItems: 'center' },
  providerText:    { fontSize: 14, fontWeight: '600', color: BRAND.navy },
  dateText:        { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  dupText:         { fontSize: 11, fontWeight: '700', marginTop: 2 },
  amountText:      { fontSize: 14, fontWeight: '700', color: BRAND.navy },
  statusText:      { fontSize: 10, marginTop: 2 },
  removeBtn:       { marginLeft: 8, padding: 4 },
  removeBtnText:   { color: '#C62828', fontSize: 16, fontWeight: '700' },
  emptyState:      { padding: 24, alignItems: 'center' },
  emptyText:       { color: '#90A4AE', textAlign: 'center' },
  // Modal
  modalHeader:     {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
  },
  modalTitle:      { fontSize: 17, fontWeight: '700', color: BRAND.navy },
  modalClose:      { fontSize: 15, color: BRAND.blue },
  availableCard:   {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 6,
  },
  reopenOverlay:   { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  reopenCard:      { backgroundColor: '#fff', borderRadius: 20, padding: 20, margin: 12 },
  reopenTitle:     { fontSize: 16, fontWeight: '700', color: BRAND.navy, marginBottom: 8 },
  reopenInput:     {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10,
    padding: 12, fontSize: 14, color: BRAND.navy, minHeight: 70,
  },
  reopenBtns:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  exportOption:    { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 },
  exportOptionText:{ fontSize: 12, fontWeight: '600', color: BRAND.navy },
});
