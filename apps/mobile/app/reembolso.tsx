// Pantalla de reembolso DRAFT — comprador agrega recibos progresivamente y luego envía
import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Alert, FlatList, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { BRAND } from '@gastocheck/shared';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

interface ReceiptItem {
  id: string;
  provider_name: string | null;
  total_amount: number | null;
  receipt_date: string | null;
  fiscal_uuid: string | null;
  sat_validation_status: string | null;
  status: string;
}

interface Reembolso {
  id:             string;
  status:         string;
  company_id:     string;
  employee_id:    string;
  control_number: number | null;
  name:           string;
}

export default function ReembolsoScreen() {
  const router = useRouter();
  const { reembolso_id } = useLocalSearchParams<{ reembolso_id: string }>();

  const [loading, setLoading] = useState(true);
  const [reembolso, setReembolso] = useState<Reembolso | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [assignedReceipts, setAssignedReceipts] = useState<ReceiptItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [validatingSat, setValidatingSat] = useState(false);
  const [showAddReceipts, setShowAddReceipts] = useState(false);
  const [availableReceipts, setAvailableReceipts] = useState<ReceiptItem[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadReembolso();
  }, []);

  async function loadReembolso() {
    setLoading(true);
    try {
      if (!reembolso_id) {
        Alert.alert('Error', 'Reembolso no especificado.');
        router.back();
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) setUserId(session.user.id);

      // Cargar reembolso
      const { data: reb } = await supabase
        .from('reembolsos')
        .select('id, status, company_id, employee_id, control_number, name')
        .eq('id', reembolso_id)
        .single();

      if (!reb) {
        Alert.alert('Error', 'Reembolso no encontrado.');
        router.back();
        return;
      }

      setReembolso(reb as Reembolso);

      // Cargar recibos asignados al reembolso
      const { data: assigned } = await supabase
        .from('receipt_reembolsos')
        .select(
          'receipts(id, provider_name, total_amount, receipt_date, fiscal_uuid, sat_validation_status, status)',
          { count: 'exact' }
        )
        .eq('reembolso_id', reembolso_id);

      const assignedList = (assigned ?? []).map((item: any) => item.receipts);
      setAssignedReceipts(assignedList.filter(Boolean));

      // Recibos ya en CUALQUIER reembolso (excluir de disponibles)
      const { data: linked } = await supabase
        .from('receipt_reembolsos')
        .select('receipt_id');
      const linkedIds = (linked ?? []).map((l: any) => l.receipt_id).filter(Boolean);

      // Recibos capturados del empleado aún no procesados
      // Filtramos por uploaded_by (siempre se guarda) O employee_id para cubrir ambos flujos
      const currentUserId = session?.user?.id ?? reb.employee_id;
      let availQ = supabase
        .from('receipts')
        .select('id, provider_name, total_amount, receipt_date, fiscal_uuid, status, is_credit')
        .eq('company_id', reb.company_id)
        .or(`uploaded_by.eq.${currentUserId},employee_id.eq.${currentUserId}`)
        .in('status', ['captured', 'approved'])
        .order('receipt_date', { ascending: false })
        .limit(100);

      if (linkedIds.length > 0) {
        availQ = availQ.not('id', 'in', `(${linkedIds.map((id: string) => `'${id}'`).join(',')})`);
      }

      const { data: available } = await availQ;
      setAvailableReceipts(available ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddReceipts() {
    if (selectedToAdd.size === 0) {
      Alert.alert('Selecciona recibos', 'Elige al menos un comprobante para agregar.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !reembolso) throw new Error('No autenticado');

      // Insertar en receipt_reembolsos
      const toInsert = Array.from(selectedToAdd).map(receiptId => ({
        reembolso_id: reembolso.id,
        receipt_id: receiptId,
      }));

      const { error } = await supabase
        .from('receipt_reembolsos')
        .insert(toInsert);

      if (error) throw error;

      Alert.alert('✓ Recibos agregados', `${selectedToAdd.size} comprobante(s) agregado(s) al reembolso.`);
      setSelectedToAdd(new Set());
      setShowAddReceipts(false);
      loadReembolso();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo agregar los recibos.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleValidateSat() {
    const pendientes = assignedReceipts.filter(r =>
      r.fiscal_uuid && r.sat_validation_status !== 'validated' && r.sat_validation_status !== 'invalid'
    );
    if (pendientes.length === 0) {
      Alert.alert('Sin CFDI pendientes', 'Todos los CFDI ya están validados.');
      return;
    }
    setValidatingSat(true);
    let ok = 0; let fail = 0;
    for (const rec of pendientes) {
      try {
        const { data } = await supabase.functions.invoke('validate-cfdi', {
          body: { uuid: rec.fiscal_uuid },
        });
        const ns: string = data?.status === 'validated' ? 'validated' : 'invalid';
        await supabase.from('receipts').update({ sat_validation_status: ns }).eq('id', rec.id);
        setAssignedReceipts(prev => prev.map(r =>
          r.id === rec.id ? { ...r, sat_validation_status: ns } : r
        ));
        if (ns === 'validated') ok++; else fail++;
      } catch { fail++; }
    }
    setValidatingSat(false);
    Alert.alert('Validación SAT', `✅ ${ok} vigente(s)   ❌ ${fail} cancelado(s) / no encontrado(s)`);
  }

  // ── Quitar comprobante del reembolso (lo regresa a disponibles) ───────────
  async function removeReceipt(receiptId: string) {
    if (!reembolso) return;
    const { error } = await supabase
      .from('receipt_reembolsos')
      .delete()
      .eq('reembolso_id', reembolso.id)
      .eq('receipt_id', receiptId);
    if (error) { Alert.alert('Error', error.message); return; }
    setAssignedReceipts(prev => prev.filter(r => r.id !== receiptId));
  }

  // ── Eliminar reembolso completo (solo borrador) ───────────────────────────
  async function deleteReembolso() {
    if (!reembolso) return;
    Alert.alert(
      'Eliminar Reembolso',
      assignedReceipts.length > 0
        ? `Se eliminarán los vínculos con ${assignedReceipts.length} comprobante(s). Los comprobantes quedan disponibles para otros reembolsos.`
        : '¿Eliminar este reembolso vacío?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            // 1. Desvincular todos los comprobantes
            await supabase.from('receipt_reembolsos').delete().eq('reembolso_id', reembolso.id);
            // 2. Eliminar el reembolso
            const { error } = await supabase.from('reembolsos').delete().eq('id', reembolso.id);
            if (error) { Alert.alert('Error', error.message); return; }
            router.replace('/mis-reembolsos' as any);
          },
        },
      ]
    );
  }


  async function handleSubmitReembolso() {
    if (!reembolso) return;

    if (assignedReceipts.length === 0) {
      Alert.alert('Sin recibos', 'Agrega al menos un comprobante antes de enviar el reembolso.');
      return;
    }

    Alert.alert(
      'Cerrar Reembolso',
      `¿Cerrar y enviar ${assignedReceipts.length} comprobante(s) por ${money(assignedReceipts.reduce((s, r) => s + (r.total_amount ?? 0), 0))} al contador para clasificar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Reembolso',
          onPress: async () => {
            setSubmitting(true);
            try {
              const total = assignedReceipts.reduce((s, r) => s + (r.total_amount ?? 0), 0);
              const { error: submitErr } = await supabase
                .from('reembolsos')
                .update({ status: 'pending_auth', total })
                .eq('id', reembolso.id)
                .eq('employee_id', reembolso.employee_id);

              if (submitErr) throw new Error(submitErr.message);

              Alert.alert(
                '✅ Reembolso cerrado',
                `Tu reembolso fue enviado al contador. Aparecerá en Pólizas como documento pendiente de clasificar.`,
                [{ text: 'Listo', onPress: () => router.replace('/mis-reembolsos' as any) }]
              );
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'No se pudo enviar el reembolso.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BRAND.green} />
      </View>
    );
  }

  if (!reembolso) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <Text style={{ color: '#90A4AE' }}>Reembolso no encontrado</Text>
      </View>
    );
  }

  const totalAmount = assignedReceipts.reduce((s, r) => s + (r.total_amount ?? 0), 0);
  const hasCfdi     = assignedReceipts.some(r => !!r.fiscal_uuid);
  const allSatDone  = !hasCfdi || assignedReceipts.every(r =>
    !r.fiscal_uuid ||
    r.sat_validation_status === 'validated' ||
    r.sat_validation_status === 'invalid'
  );
  const pendingSatCount = assignedReceipts.filter(r =>
    r.fiscal_uuid && !r.sat_validation_status
  ).length;

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.controlNum}>
          {reembolso.control_number ? `R-${String(reembolso.control_number).padStart(4, '0')}` : 'Nuevo Reembolso'}
        </Text>
        {reembolso.name ? <Text style={styles.title}>{reembolso.name}</Text> : null}
        <Text style={styles.subtitle}>
          {assignedReceipts.length} comprobante{assignedReceipts.length !== 1 ? 's' : ''} · Total: {money(totalAmount)}
        </Text>

        {/* Recibos asignados */}
        {assignedReceipts.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Comprobantes incluidos</Text>
            {assignedReceipts.map(r => {
              const satOk  = r.sat_validation_status === 'validated';
              const satBad = r.sat_validation_status === 'invalid';
              const satPend = !!r.fiscal_uuid && !r.sat_validation_status;
              return (
                <View key={r.id} style={styles.receiptRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.receiptProvider} numberOfLines={1}>
                      {r.provider_name ?? '(sin proveedor)'}
                    </Text>
                    <Text style={styles.receiptDate}>
                      {r.receipt_date ?? '—'}
                    </Text>
                    {r.fiscal_uuid && (
                      <Text style={{ fontSize: 11, fontWeight: '700', marginTop: 2,
                        color: satOk ? '#2E7D32' : satBad ? '#C62828' : '#E65100' }}>
                        {satOk ? '✅ CFDI Vigente' : satBad ? '❌ CFDI Cancelado' : '⏳ CFDI sin validar'}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.receiptAmount}>{money(r.total_amount ?? 0)}</Text>
                  {reembolso.status === 'draft' && (
                    <TouchableOpacity
                      onPress={() => removeReceipt(r.id)}
                      style={{ padding: 6, marginLeft: 4 }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={{ fontSize: 18, color: '#B0BEC5' }}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyText}>Sin comprobantes aún</Text>
            <Text style={styles.emptyHint}>Agrega comprobantes para comenzar</Text>
          </View>
        )}

        {/* Botones agregar */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <TouchableOpacity
            style={[styles.addBtn, { flex: 1 }]}
            onPress={() => router.push('/capture')}
          >
            <Text style={styles.addBtnText}>📷 Capturar nuevo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addBtn, { flex: 1, backgroundColor: BRAND.orange }]}
            onPress={() => setShowAddReceipts(true)}
          >
            <Text style={styles.addBtnText}>📋 Mis recibos</Text>
          </TouchableOpacity>
        </View>

        {/* Paso 2: Validar SAT (aparece si hay CFDI sin validar) */}
        {assignedReceipts.length > 0 && hasCfdi && !allSatDone && (
          <>
            <View style={styles.stepHint}>
              <Text style={styles.stepHintText}>
                ⏳ Hay {pendingSatCount} CFDI sin validar. Valida en SAT antes de enviar.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.satBtn, validatingSat && { opacity: 0.5 }]}
              onPress={handleValidateSat}
              disabled={validatingSat}
            >
              {validatingSat
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.satBtnText}>🔍 Validar CFDI en SAT</Text>
              }
            </TouchableOpacity>
          </>
        )}

        {/* Paso 3: Cerrar reembolso (solo cuando SAT OK o sin CFDI) */}
        {assignedReceipts.length > 0 && allSatDone && (
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmitReembolso}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>
                🔒 Cerrar Reembolso · {money(totalAmount)}
              </Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelBtnText}>← Volver</Text>
        </TouchableOpacity>

        {reembolso.status === 'draft' && (
          <TouchableOpacity
            style={[styles.cancelBtn, { marginTop: 4 }]}
            onPress={deleteReembolso}
          >
            <Text style={[styles.cancelBtnText, { color: BRAND.red }]}>
              🗑 Eliminar este reembolso
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Modal: agregar recibos */}
      <Modal visible={showAddReceipts} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowAddReceipts(false)}>
        <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddReceipts(false)}>
              <Text style={{ color: '#90A4AE', fontSize: 15 }}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.navy }}>Agregar Comprobantes</Text>
            <View style={{ width: 60 }} />
          </View>

          {availableReceipts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={styles.emptyText}>Sin comprobantes disponibles</Text>
              <Text style={styles.emptyHint}>Todos tus comprobantes están incluidos</Text>
            </View>
          ) : (
            <FlatList
              data={availableReceipts}
              keyExtractor={r => r.id}
              contentContainerStyle={{ padding: 12 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.receiptSelectRow,
                    selectedToAdd.has(item.id) && styles.receiptSelectRowActive,
                  ]}
                  onPress={() => {
                    const next = new Set(selectedToAdd);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    setSelectedToAdd(next);
                  }}
                >
                  <View style={[styles.checkbox, selectedToAdd.has(item.id) && styles.checkboxActive]}>
                    {selectedToAdd.has(item.id) && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.receiptProvider} numberOfLines={1}>
                      {item.provider_name ?? '(sin proveedor)'}
                    </Text>
                    <Text style={styles.receiptDate}>
                      {item.receipt_date ?? '—'}
                      {(item as any).is_credit ? '  ·  💳 Corporativo' : '  ·  💵 Propio'}
                    </Text>
                  </View>
                  <Text style={styles.receiptAmount}>{money(item.total_amount ?? 0)}</Text>
                </TouchableOpacity>
              )}
            />
          )}

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowAddReceipts(false)}
            >
              <Text style={styles.modalCancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalConfirmBtn, selectedToAdd.size === 0 && { opacity: 0.5 }]}
              disabled={selectedToAdd.size === 0 || submitting}
              onPress={handleAddReceipts}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalConfirmBtnText}>
                  Agregar ({selectedToAdd.size})
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  controlNum: { fontSize: 13, fontWeight: '900', color: BRAND.blue, letterSpacing: 1, marginBottom: 4 },
  title:    { fontSize: 20, fontWeight: '800', color: BRAND.navy, marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#90A4AE', marginBottom: 16 },

  section: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: BRAND.navy, marginBottom: 10 },
  receiptRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
  },
  receiptProvider: { fontSize: 13, fontWeight: '700', color: BRAND.navy },
  receiptDate: { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  receiptAmount: { fontSize: 14, fontWeight: '700', color: BRAND.navy, minWidth: 70, textAlign: 'right' },

  emptyState: {
    alignItems: 'center', paddingVertical: 60,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', color: BRAND.navy, marginBottom: 4 },
  emptyHint: { fontSize: 13, color: '#90A4AE' },

  addBtn: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    alignItems: 'center', marginBottom: 12,
    borderWidth: 2, borderColor: BRAND.blue, borderStyle: 'dashed',
  },
  addBtnText: { fontSize: 15, fontWeight: '700', color: BRAND.blue },

  stepHint: {
    backgroundColor: '#FFF8E1', borderRadius: 10, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#FFE082',
  },
  stepHintText: { fontSize: 12, color: '#E65100', fontWeight: '600' },
  satBtn: {
    backgroundColor: BRAND.blue, borderRadius: 14, padding: 14,
    alignItems: 'center', marginBottom: 10,
  },
  satBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  submitBtn: {
    backgroundColor: BRAND.green, borderRadius: 14, padding: 16,
    alignItems: 'center', marginBottom: 8,
  },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  cancelBtn: { alignItems: 'center', padding: 16 },
  cancelBtnText: { fontSize: 14, color: '#90A4AE', fontWeight: '700' },

  // Modal
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
  },
  receiptSelectRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  receiptSelectRowActive: {
    backgroundColor: BRAND.blue + '10', borderColor: BRAND.blue,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2,
    borderColor: '#B0BEC5', alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: BRAND.blue, borderColor: BRAND.blue },

  modalFooter: {
    flexDirection: 'row', gap: 12, padding: 16,
    borderTopWidth: 1, borderTopColor: '#E0E0E0',
  },
  modalCancelBtn: {
    flex: 1, backgroundColor: '#F5F5F5', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelBtnText: { fontSize: 14, fontWeight: '700', color: '#90A4AE' },
  modalConfirmBtn: {
    flex: 1.5, backgroundColor: BRAND.blue, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center',
  },
  modalConfirmBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
