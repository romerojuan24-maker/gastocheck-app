// Módulo de Viáticos — gastos de viaje controlados y sin controlar
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, Modal, TextInput, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import DatePickerField from '../components/DatePickerField';
import * as DocumentPicker from 'expo-document-picker';

type ViaticoConcept = 'car_rental' | 'presentation' | 'meals' | 'accommodation' | 'transport' | 'other';
type ViaticType = 'controlled' | 'uncontrolled';
type ViaticStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

interface Viatico {
  id: string;
  concept: ViaticoConcept;
  type: ViaticType;
  amount: number;
  status: ViaticStatus;
  description: string;
  trip_date: string;
  receipt_type: string;
  created_at: string;
  approved_at: string | null;
}

const CONCEPTS = [
  { key: 'car_rental' as ViaticoConcept, label: '🚗 Renta de auto', icon: '🚗' },
  { key: 'presentation' as ViaticoConcept, label: '🎯 Presentación', icon: '🎯' },
  { key: 'meals' as ViaticoConcept, label: '🍽️ Comidas', icon: '🍽️' },
  { key: 'accommodation' as ViaticoConcept, label: '🏨 Hospedaje', icon: '🏨' },
  { key: 'transport' as ViaticoConcept, label: '🚕 Transporte', icon: '🚕' },
  { key: 'other' as ViaticoConcept, label: '📦 Otro', icon: '📦' },
];

const STATUS_META: Record<ViaticStatus, { label: string; color: string; icon: string }> = {
  pending: { label: 'Pendiente', color: BRAND.orange, icon: '⏳' },
  approved: { label: 'Aprobado', color: BRAND.green, icon: '✅' },
  rejected: { label: 'Rechazado', color: BRAND.red, icon: '❌' },
  cancelled: { label: 'Cancelado', color: '#90A4AE', icon: '⭕' },
};

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export default function ViaticosScreen() {
  const router = useRouter();

  const [viaticos, setViaticos] = useState<Viatico[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [formConcept, setFormConcept] = useState<ViaticoConcept>('car_rental');
  const [formType, setFormType] = useState<ViaticType>('controlled');
  const [formAmount, setFormAmount] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formTripDate, setFormTripDate] = useState(new Date().toISOString().slice(0, 10));
  const [formReceiptType, setFormReceiptType] = useState<'cfdi' | 'non_fiscal' | 'none'>('non_fiscal');
  const [saving, setSaving] = useState(false);

  // Cargar viáticos
  const loadViaticos = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: member } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!member) return;
      setCompanyId(member.company_id);

      const { data } = await supabase
        .from('viaticos')
        .select('*')
        .eq('company_id', member.company_id)
        .eq('user_id', user.id)
        .order('trip_date', { ascending: false });

      setViaticos((data ?? []) as Viatico[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadViaticos();
  }, [loadViaticos]);

  useFocusEffect(
    useCallback(() => {
      loadViaticos();
    }, [loadViaticos]),
  );

  // Crear viático
  async function handleSubmit() {
    if (!formAmount || parseFloat(formAmount) <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a 0');
      return;
    }
    if (!formDescription.trim()) {
      Alert.alert('Descripción requerida', 'Describe el gasto de viático');
      return;
    }
    if (!companyId || !userId) {
      Alert.alert('Error', 'No tienes empresa asignada');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('viaticos').insert({
        company_id: companyId,
        user_id: userId,
        concept: formConcept,
        type: formType,
        amount: parseFloat(formAmount),
        description: formDescription.trim(),
        city: formCity.trim() || null,
        trip_date: formTripDate,
        receipt_type: formReceiptType,
        status: 'pending',
      });

      if (error) throw error;

      Alert.alert(
        '✓ Viático registrado',
        `${money(parseFloat(formAmount))} - ${formDescription}\nAguardando aprobación del supervisor`,
        [{ text: 'OK', onPress: () => {
          setShowModal(false);
          setFormAmount('');
          setFormDescription('');
          setFormCity('');
          loadViaticos();
        }}],
      );
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }

  // Renderizar viático
  function renderViatico({ item }: { item: Viatico }) {
    const conceptMeta = CONCEPTS.find((c) => c.key === item.concept);
    const statusMeta = STATUS_META[item.status];

    return (
      <TouchableOpacity
        style={[
          styles.card,
          item.status === 'rejected' && { borderColor: BRAND.red, borderWidth: 1.5 },
          item.status === 'pending' && { borderColor: BRAND.orange, borderWidth: 1.5 },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.concept}>
              {conceptMeta?.icon} {conceptMeta?.label}
            </Text>
            <Text style={styles.description} numberOfLines={1}>{item.description}</Text>
            <Text style={styles.date}>
              {item.trip_date} • {item.city ? `${item.city}` : '📍 Sin ubicación'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amount}>{money(item.amount)}</Text>
            <View style={[styles.typeBadge, {
              backgroundColor: item.type === 'controlled' ? BRAND.blue + '20' : '#FFC10720',
            }]}>
              <Text style={[styles.typeBadgeText, {
                color: item.type === 'controlled' ? BRAND.blue : '#FF9800',
              }]}>
                {item.type === 'controlled' ? 'Controlado' : 'Sin control'}
              </Text>
            </View>
          </View>
        </View>

        {/* Estado */}
        <View style={styles.footer}>
          <View style={[styles.statusBadge, { backgroundColor: statusMeta.color + '20' }]}>
            <Text style={[styles.statusText, { color: statusMeta.color }]}>
              {statusMeta.icon} {statusMeta.label}
            </Text>
          </View>
          {item.receipt_type && (
            <Text style={styles.receiptHint}>
              {item.receipt_type === 'cfdi' ? '📄 CFDI' : item.receipt_type === 'non_fiscal' ? '📋 No fiscal' : '❌ Sin comprobante'}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  if (loading && viaticos.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  const pending = viaticos.filter((v) => v.status === 'pending');
  const approved = viaticos.filter((v) => v.status === 'approved');
  const rejected = viaticos.filter((v) => v.status === 'rejected');
  const totalPending = pending.reduce((sum, v) => sum + v.amount, 0);
  const totalApproved = approved.reduce((sum, v) => sum + v.amount, 0);

  return (
    <View style={styles.container}>
      {/* Resumen */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Pendientes</Text>
            <Text style={[styles.summaryAmount, { color: BRAND.orange }]}>
              {pending.length} • {money(totalPending)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.summaryLabel}>Aprobados</Text>
            <Text style={[styles.summaryAmount, { color: BRAND.green }]}>
              {approved.length} • {money(totalApproved)}
            </Text>
          </View>
        </View>
      </View>

      {/* Botón crear */}
      <TouchableOpacity
        style={styles.createBtn}
        onPress={() => setShowModal(true)}
      >
        <Text style={styles.createBtnText}>+ Registrar viático</Text>
      </TouchableOpacity>

      {/* Lista */}
      {viaticos.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>✈️</Text>
          <Text style={styles.emptyText}>Sin viáticos registrados</Text>
          <Text style={styles.emptyHint}>Registra tus gastos de viaje</Text>
        </View>
      ) : (
        <FlatList
          data={viaticos}
          keyExtractor={(v) => v.id}
          renderItem={renderViatico}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={loadViaticos}
        />
      )}

      {/* Modal crear viático */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo viático</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              {/* Concepto */}
              <Text style={styles.label}>Concepto *</Text>
              {CONCEPTS.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[
                    styles.optionBtn,
                    formConcept === c.key && { backgroundColor: BRAND.blue + '20', borderColor: BRAND.blue, borderWidth: 2 },
                  ]}
                  onPress={() => setFormConcept(c.key)}
                >
                  <Text style={[
                    styles.optionText,
                    formConcept === c.key && { color: BRAND.blue, fontWeight: '700' }
                  ]}>
                    {formConcept === c.key ? '✓' : ' '} {c.label}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Tipo */}
              <Text style={styles.label}>Tipo *</Text>
              {['controlled', 'uncontrolled'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.optionBtn,
                    formType === t && { backgroundColor: BRAND.blue + '20', borderColor: BRAND.blue, borderWidth: 2 },
                  ]}
                  onPress={() => setFormType(t as ViaticType)}
                >
                  <Text style={[
                    styles.optionText,
                    formType === t && { color: BRAND.blue, fontWeight: '700' }
                  ]}>
                    {formType === t ? '✓' : ' '} {t === 'controlled' ? 'Controlado (con límite)' : 'Sin controlar'}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Monto */}
              <Text style={styles.label}>Monto ($) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 1500"
                keyboardType="decimal-pad"
                value={formAmount}
                onChangeText={setFormAmount}
              />

              {/* Descripción */}
              <Text style={styles.label}>Descripción *</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Describe el gasto..."
                multiline
                value={formDescription}
                onChangeText={setFormDescription}
              />

              {/* Fecha */}
              <Text style={styles.label}>Fecha del viaje *</Text>
              <DatePickerField
                label="Fecha"
                value={formTripDate}
                onChange={setFormTripDate}
              />

              {/* Ciudad */}
              <Text style={styles.label}>Ciudad (opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Ciudad de México"
                value={formCity}
                onChangeText={setFormCity}
              />

              {/* Tipo de comprobante */}
              <Text style={styles.label}>Comprobante *</Text>
              {['cfdi', 'non_fiscal', 'none'].map((rt) => (
                <TouchableOpacity
                  key={rt}
                  style={[
                    styles.optionBtn,
                    formReceiptType === rt && { backgroundColor: BRAND.blue + '20', borderColor: BRAND.blue, borderWidth: 2 },
                  ]}
                  onPress={() => setFormReceiptType(rt as any)}
                >
                  <Text style={[
                    styles.optionText,
                    formReceiptType === rt && { color: BRAND.blue, fontWeight: '700' }
                  ]}>
                    {formReceiptType === rt ? '✓' : ' '} {rt === 'cfdi' ? '📄 CFDI' : rt === 'non_fiscal' ? '📋 Comprobante no fiscal' : '❌ Sin comprobante'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, (!formAmount || !formDescription || saving) && { opacity: 0.5 }]}
                onPress={handleSubmit}
                disabled={!formAmount || !formDescription || saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Registrar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.gray },
  summaryCard: {
    margin: 12, padding: 16, backgroundColor: '#fff',
    borderRadius: 14, borderWidth: 1, borderColor: '#E0E0E0',
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 12, color: '#90A4AE', fontWeight: '600' },
  summaryAmount: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  createBtn: {
    marginHorizontal: 12, marginBottom: 8,
    backgroundColor: BRAND.blue, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  list: { paddingHorizontal: 12, paddingBottom: 24 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#F0F0F0',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  concept: { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  description: { fontSize: 13, color: '#90A4AE', marginTop: 2 },
  date: { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  amount: { fontSize: 18, fontWeight: '800', color: BRAND.navy },
  typeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  typeBadgeText: { fontSize: 11, fontWeight: '600' },
  footer: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  receiptHint: { fontSize: 11, color: '#90A4AE', fontStyle: 'italic' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyText: { fontSize: 16, color: BRAND.navy, fontWeight: '700' },
  emptyHint: { fontSize: 13, color: '#90A4AE', marginTop: 4 },
  modal: { flex: 1, backgroundColor: BRAND.gray },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: BRAND.navy },
  modalClose: { fontSize: 20, color: '#90A4AE' },
  modalBody: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 14, color: BRAND.navy, marginBottom: 8 },
  optionBtn: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E0E0E0' },
  optionText: { fontSize: 14, color: BRAND.navy },
  modalActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 32, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  cancelBtn: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: '#90A4AE' },
  saveBtn: { flex: 1, backgroundColor: BRAND.blue, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
