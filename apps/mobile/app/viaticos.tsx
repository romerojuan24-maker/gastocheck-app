// Viáticos — Gastos de viaje clasificados como viáticos
// Reutiliza capture.tsx para OCR, solo agrega clasificación
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, Modal, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

type ViaticoConcept = 'car_rental' | 'presentation' | 'meals' | 'accommodation' | 'transport' | 'other';
type ViaticType = 'controlled' | 'uncontrolled';

interface Viatico {
  id: string;
  provider_name: string | null;
  total_amount: number;
  viatico_concept: ViaticoConcept;
  viatico_type: ViaticType;
  trip_date: string | null;
  trip_city: string | null;
  status: string;
  created_at: string;
}

const CONCEPTS = [
  { key: 'car_rental' as ViaticoConcept, label: '🚗 Renta de auto', icon: '🚗' },
  { key: 'presentation' as ViaticoConcept, label: '🎯 Presentación', icon: '🎯' },
  { key: 'meals' as ViaticoConcept, label: '🍽️ Comidas', icon: '🍽️' },
  { key: 'accommodation' as ViaticoConcept, label: '🏨 Hospedaje', icon: '🏨' },
  { key: 'transport' as ViaticoConcept, label: '🚕 Transporte', icon: '🚕' },
  { key: 'other' as ViaticoConcept, label: '📦 Otro', icon: '📦' },
];

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export default function ViaticosScreen() {
  const router = useRouter();

  const [viaticos, setViaticos] = useState<Viatico[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [showClassifyModal, setShowClassifyModal] = useState(false);
  const [pendingExpenseId, setPendingExpenseId] = useState<string | null>(null);
  const [classifyForm, setClassifyForm] = useState({
    concept: 'car_rental' as ViaticoConcept,
    type: 'controlled' as ViaticType,
    city: '',
  });
  const [classifying, setClassifying] = useState(false);

  const loadViaticos = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!member) return;
      setCompanyId(member.company_id);

      // Obtener viáticos (expenses donde is_viatico=true)
      const { data } = await supabase
        .from('expenses')
        .select('id, provider_name, total_amount, viatico_concept, viatico_type, trip_date, trip_city, status, created_at')
        .eq('company_id', member.company_id)
        .eq('is_viatico', true)
        .order('trip_date', { ascending: false });

      setViaticos((data ?? []) as Viatico[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadViaticos(); }, [loadViaticos]);
  useFocusEffect(useCallback(() => { loadViaticos(); }, [loadViaticos]));

  // Capturar comprobante y luego clasificar como viático
  async function handleCaptureAndClassify() {
    // Abre capture.tsx, después retorna con expense_id
    // Simulación: el usuario captura en capture.tsx y retorna aquí
    // En produce, hay que pasar expense_id como parámetro

    // Por ahora, navega a capture y el usuario vuelve
    router.push('/capture');
  }

  // Clasificar expense como viático
  async function handleClassifyAsViatico() {
    if (!pendingExpenseId || !companyId) return;

    setClassifying(true);
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          is_viatico: true,
          viatico_concept: classifyForm.concept,
          viatico_type: classifyForm.type,
          trip_city: classifyForm.city || null,
        })
        .eq('id', pendingExpenseId)
        .eq('company_id', companyId);

      if (error) throw error;

      Alert.alert('✓ Clasificado', `Viático registrado como ${CONCEPTS.find(c => c.key === classifyForm.concept)?.label}`);
      setShowClassifyModal(false);
      setPendingExpenseId(null);
      await loadViaticos();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo clasificar el viático');
    } finally {
      setClassifying(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  const pendiente = viaticos.filter(v => v.status === 'pending' || v.status === 'captured').length;
  const aprobado = viaticos.filter(v => v.status === 'authorized').length;
  const rechazado = viaticos.filter(v => v.status === 'rejected').length;

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.header}>
          <Text style={styles.title}>✈️ Mis Viáticos</Text>
          <Text style={styles.hint}>Gastos de viaje controlados y sin controlar</Text>
        </View>

        <View style={styles.stats}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{pendiente}</Text>
            <Text style={styles.statLabel}>⏳ Pendientes</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{aprobado}</Text>
            <Text style={styles.statLabel}>✅ Aprobados</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{rechazado}</Text>
            <Text style={styles.statLabel}>❌ Rechazados</Text>
          </View>
        </View>

        {viaticos.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✈️</Text>
            <Text style={styles.emptyTitle}>Sin viáticos registrados</Text>
            <Text style={styles.emptyHint}>Captura comprobantes y clasifícalos como viáticos</Text>
          </View>
        ) : (
          <FlatList
            scrollEnabled={false}
            data={viaticos}
            keyExtractor={v => v.id}
            renderItem={({ item: v }) => (
              <View style={styles.viaticCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.viaticProvider}>{v.provider_name || 'Sin proveedor'}</Text>
                  <Text style={styles.viaticConcept}>
                    {CONCEPTS.find(c => c.key === v.viatico_concept)?.label || v.viatico_concept}
                  </Text>
                  <Text style={styles.viaticMeta}>
                    {v.trip_date} {v.trip_city ? `• ${v.trip_city}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.viaticAmount}>{money(v.total_amount)}</Text>
                  <Text style={[
                    styles.viaticStatus,
                    v.status === 'authorized' && { color: BRAND.green },
                    v.status === 'rejected' && { color: BRAND.red },
                  ]}>
                    {v.status === 'pending' || v.status === 'captured' ? '⏳ Pendiente' : v.status === 'authorized' ? '✅ Aprobado' : '❌ Rechazado'}
                  </Text>
                </View>
              </View>
            )}
          />
        )}

        <TouchableOpacity style={styles.captureBtn} onPress={handleCaptureAndClassify}>
          <Text style={styles.captureBtnIcon}>📷</Text>
          <Text style={styles.captureBtnText}>Capturar Comprobante</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal: Clasificar como viático */}
      <Modal visible={showClassifyModal} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowClassifyModal(false)}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowClassifyModal(false)}>
            <Text style={{ color: '#90A4AE', fontSize: 15 }}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.navy }}>Clasificar como Viático</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.fieldLabel}>Concepto *</Text>
          <View style={styles.conceptGrid}>
            {CONCEPTS.map(c => (
              <TouchableOpacity
                key={c.key}
                style={[
                  styles.conceptBtn,
                  classifyForm.concept === c.key && styles.conceptBtnActive,
                ]}
                onPress={() => setClassifyForm({ ...classifyForm, concept: c.key })}
              >
                <Text style={styles.conceptIcon}>{c.icon}</Text>
                <Text style={styles.conceptLabel}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Tipo *</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeBtn, classifyForm.type === 'controlled' && styles.typeBtnActive]}
              onPress={() => setClassifyForm({ ...classifyForm, type: 'controlled' })}
            >
              <Text style={styles.typeLabel}>💰 Controlado</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, classifyForm.type === 'uncontrolled' && styles.typeBtnActive]}
              onPress={() => setClassifyForm({ ...classifyForm, type: 'uncontrolled' })}
            >
              <Text style={styles.typeLabel}>🆓 Sin Controlar</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Ciudad (opcional)</Text>
          <View style={styles.input}>
            <Text>🏙️</Text>
            <Text style={{ color: '#90A4AE', flex: 1, marginLeft: 8 }}>
              {classifyForm.city || 'Ciudad del viaje'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, classifying && { opacity: 0.5 }]}
            onPress={handleClassifyAsViatico}
            disabled={classifying}
          >
            <Text style={styles.submitBtnText}>✓ Clasificar como Viático</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: BRAND.navy },
  hint: { fontSize: 13, color: '#90A4AE', marginTop: 4 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: BRAND.blue },
  statLabel: { fontSize: 12, color: '#90A4AE', marginTop: 4 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: BRAND.navy },
  emptyHint: { fontSize: 13, color: '#90A4AE', marginTop: 4 },
  viaticCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  viaticProvider: { fontSize: 14, fontWeight: '700', color: BRAND.navy },
  viaticConcept: { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  viaticMeta: { fontSize: 11, color: '#90A4AE', marginTop: 4 },
  viaticAmount: { fontSize: 15, fontWeight: '800', color: BRAND.navy },
  viaticStatus: { fontSize: 12, color: BRAND.orange, marginTop: 4 },
  captureBtn: { backgroundColor: BRAND.blue, borderRadius: 10, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 20 },
  captureBtnIcon: { fontSize: 18 },
  captureBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0', paddingTop: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: BRAND.navy, marginBottom: 10, marginTop: 16 },
  conceptGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  conceptBtn: { flex: 1, minWidth: '48%', backgroundColor: '#fff', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0' },
  conceptBtnActive: { backgroundColor: BRAND.blue + '10', borderColor: BRAND.blue },
  conceptIcon: { fontSize: 24, marginBottom: 4 },
  conceptLabel: { fontSize: 11, fontWeight: '600', color: BRAND.navy, textAlign: 'center' },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0' },
  typeBtnActive: { backgroundColor: BRAND.green + '10', borderColor: BRAND.green },
  typeLabel: { fontSize: 13, fontWeight: '600', color: BRAND.navy },
  input: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 20 },
  submitBtn: { backgroundColor: BRAND.green, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
