// Solicitudes de anticipo — empleado pide, supervisor aprueba
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, Modal, TextInput, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

interface AdvanceRequest {
  id:               string;
  amount:           number;
  reason:           string;
  status:           RequestStatus;
  rejection_reason: string | null;
  created_at:       string;
  reviewed_at:      string | null;
}

const STATUS_META: Record<RequestStatus, { label: string; color: string; icon: string }> = {
  pending:   { label: 'Pendiente',  color: BRAND.orange,  icon: '⏳' },
  approved:  { label: 'Aprobada',   color: BRAND.green,   icon: '✅' },
  rejected:  { label: 'Rechazada',  color: BRAND.red,     icon: '❌' },
  cancelled: { label: 'Cancelada',  color: '#90A4AE',     icon: '⭕' },
};

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export default function AdvanceRequestScreen() {
  const [requests,     setRequests]     = useState<AdvanceRequest[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [companyId,    setCompanyId]    = useState<string | null>(null);
  const [userId,       setUserId]       = useState<string | null>(null);

  // Modal nueva solicitud
  const [showModal,    setShowModal]    = useState(false);
  const [amount,       setAmount]       = useState('');
  const [reason,       setReason]       = useState('');
  const [saving,       setSaving]       = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      setUserId(user.id);

      const { data: member } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!member) return;
      setCompanyId(member.company_id);

      const { data } = await supabase
        .from('advance_requests')
        .select('*')
        .eq('requester_id', user.id)
        .order('created_at', { ascending: false });

      setRequests((data ?? []) as AdvanceRequest[]);
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleSubmit() {
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a 0');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Motivo requerido', 'Describe para qué necesitas el anticipo');
      return;
    }
    if (!companyId || !userId) {
      Alert.alert('Sin empresa', 'Debes pertenecer a una empresa para enviar solicitudes de anticipo. Ve a Ajustes para crear o unirte a una empresa.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('advance_requests').insert({
        company_id:   companyId,
        requester_id: userId,
        amount:       parsedAmount,
        reason:       reason.trim(),
        status:       'pending',
      });

      if (error) throw new Error(error.message);

      setShowModal(false);
      setAmount('');
      setReason('');
      Alert.alert(
        '✓ Solicitud enviada',
        'Tu supervisor recibirá la solicitud y te notificará cuando la revise.',
        [{ text: 'OK', onPress: loadData }],
      );
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(id: string) {
    Alert.alert(
      'Cancelar solicitud',
      '¿Deseas cancelar esta solicitud?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('advance_requests')
              .update({ status: 'cancelled' })
              .eq('id', id)
              .eq('requester_id', userId);
            if (error) Alert.alert('Error', error.message);
            else loadData();
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  const pending = requests.filter((r) => r.status === 'pending');
  const past    = requests.filter((r) => r.status !== 'pending');

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoIcon}>💡</Text>
          <Text style={styles.infoText}>
            Tu supervisor revisará la solicitud y, si la aprueba, recibirás el anticipo
            registrado en tu póliza activa.
          </Text>
        </View>

        {/* Solicitudes pendientes */}
        {pending.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>En revisión</Text>
            {pending.map((r) => (
              <RequestCard key={r.id} request={r} onCancel={() => handleCancel(r.id)} />
            ))}
          </View>
        )}

        {/* Historial */}
        {past.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Historial</Text>
            {past.map((r) => (
              <RequestCard key={r.id} request={r} />
            ))}
          </View>
        )}

        {requests.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>Aún no tienes solicitudes</Text>
            <Text style={styles.emptyHint}>Presiona el botón para pedir tu primer anticipo</Text>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Text style={styles.fabText}>+ Nueva solicitud</Text>
      </TouchableOpacity>

      {/* Modal nueva solicitud */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => { setShowModal(false); setAmount(''); setReason(''); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Solicitar anticipo</Text>

              <Text style={styles.fieldLabel}>Monto solicitado ($)</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="Ej: 2500.00"
                placeholderTextColor="#B0BEC5"
              />

              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>¿Para qué necesitas el anticipo?</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={3}
                placeholder="Ej: Compra de refacciones para vehículo #003, viáticos para visita cliente Monterrey..."
                placeholderTextColor="#B0BEC5"
                textAlignVertical="top"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => { setShowModal(false); setAmount(''); setReason(''); }}
                  disabled={saving}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.submitBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSubmit}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.submitBtnText}>Enviar solicitud</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function RequestCard({
  request,
  onCancel,
}: {
  request: AdvanceRequest;
  onCancel?: () => void;
}) {
  const meta = STATUS_META[request.status];
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardAmount}>{money(request.amount)}</Text>
        <View style={[styles.badge, { backgroundColor: meta.color + '20' }]}>
          <Text style={[styles.badgeText, { color: meta.color }]}>
            {meta.icon} {meta.label}
          </Text>
        </View>
      </View>
      <Text style={styles.cardReason}>{request.reason}</Text>
      <Text style={styles.cardDate}>
        {new Date(request.created_at).toLocaleDateString('es-MX', {
          day: '2-digit', month: 'short', year: 'numeric',
        })}
      </Text>
      {request.status === 'rejected' && request.rejection_reason && (
        <View style={styles.rejectBox}>
          <Text style={styles.rejectText}>Motivo: {request.rejection_reason}</Text>
        </View>
      )}
      {request.status === 'pending' && onCancel && (
        <TouchableOpacity style={styles.cancelLink} onPress={onCancel}>
          <Text style={styles.cancelLinkText}>Cancelar solicitud</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll:         { padding: 16, paddingBottom: 100 },
  infoBanner:     { flexDirection: 'row', backgroundColor: '#E3F2FD', borderRadius: 14, padding: 14, marginBottom: 16, gap: 10 },
  infoIcon:       { fontSize: 18 },
  infoText:       { flex: 1, fontSize: 13, color: '#1565C0', lineHeight: 19 },
  section:        { marginBottom: 20 },
  sectionTitle:   { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 10, paddingHorizontal: 2 },
  card:           { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10 },
  cardHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardAmount:     { fontSize: 20, fontWeight: '800', color: BRAND.navy },
  badge:          { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText:      { fontSize: 12, fontWeight: '700' },
  cardReason:     { fontSize: 14, color: '#555', marginBottom: 6, lineHeight: 20 },
  cardDate:       { fontSize: 12, color: '#B0BEC5' },
  rejectBox:      { backgroundColor: '#FFEBEE', borderRadius: 8, padding: 8, marginTop: 8 },
  rejectText:     { fontSize: 13, color: BRAND.red },
  cancelLink:     { marginTop: 10, alignSelf: 'flex-start' },
  cancelLinkText: { fontSize: 13, color: '#90A4AE', textDecorationLine: 'underline' },
  empty:          { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:      { fontSize: 48, marginBottom: 12 },
  emptyText:      { fontSize: 16, fontWeight: '700', color: BRAND.navy },
  emptyHint:      { fontSize: 13, color: '#B0BEC5', marginTop: 6, textAlign: 'center' },
  fab:            {
    position: 'absolute', bottom: 24, left: 16, right: 16,
    backgroundColor: BRAND.blue, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', elevation: 4,
  },
  fabText:        { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:       { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  modalTitle:     { fontSize: 20, fontWeight: '800', color: BRAND.navy, marginBottom: 18 },
  fieldLabel:     { fontSize: 12, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 6 },
  input:          { backgroundColor: BRAND.gray, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: BRAND.navy, borderWidth: 1, borderColor: '#E0E0E0' },
  textArea:       { minHeight: 90, paddingTop: 12 },
  modalButtons:   { flexDirection: 'column', gap: 10, marginTop: 20 },
  modalBtn:       { borderRadius: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', width: '100%' },
  cancelBtn:      { backgroundColor: '#F5F5F5' },
  cancelBtnText:  { fontSize: 15, fontWeight: '600', color: '#666' },
  submitBtn:      { backgroundColor: BRAND.blue },
  submitBtnText:  { fontSize: 15, fontWeight: '700', color: '#fff' },
});
