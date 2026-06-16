// Pantalla de aprobación de viáticos para supervisores
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, Modal, TextInput, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';

interface ViaticoPending {
  id: string;
  user_id: string;
  user_name: string;
  concept: string;
  type: string;
  amount: number;
  description: string;
  trip_date: string;
  city: string;
  created_at: string;
}

const CONCEPTS: Record<string, { label: string; icon: string }> = {
  car_rental: { label: 'Renta de auto', icon: '🚗' },
  presentation: { label: 'Presentación', icon: '🎯' },
  meals: { label: 'Comidas', icon: '🍽️' },
  accommodation: { label: 'Hospedaje', icon: '🏨' },
  transport: { label: 'Transporte', icon: '🚕' },
  other: { label: 'Otro', icon: '📦' },
};

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export default function ViaticosAprobacionScreen() {
  const router = useRouter();

  const [viaticos, setViaticos] = useState<ViaticoPending[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedViatico, setSelectedViatico] = useState<ViaticoPending | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approving, setApproving] = useState(false);

  // Cargar viáticos pendientes
  const loadViaticos = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from('company_members')
        .select('company_id, role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!member || !['admin', 'supervisor'].includes(member.role)) {
        Alert.alert('Acceso denegado', 'Solo supervisores pueden aprobar viáticos');
        return;
      }

      setCompanyId(member.company_id);

      // Obtener viáticos pendientes con nombre del usuario
      const { data } = await supabase
        .from('viaticos')
        .select(`
          id, user_id, concept, type, amount, description, trip_date, city, created_at,
          user:user_id(email)
        `)
        .eq('company_id', member.company_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (data) {
        setViaticos(
          data.map((v: any) => ({
            id: v.id,
            user_id: v.user_id,
            user_name: v.user?.email ?? 'Usuario',
            concept: v.concept,
            type: v.type,
            amount: v.amount,
            description: v.description,
            trip_date: v.trip_date,
            city: v.city,
            created_at: v.created_at,
          })),
        );
      }
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

  // Aprobar viático
  async function handleApprove(viatico: ViaticoPending) {
    setApproving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No autenticado');

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/approve-viatico`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            viatico_id: viatico.id,
            action: 'approve',
          }),
        },
      );

      if (!res.ok) throw new Error('Error al aprobar');

      Alert.alert('✓ Aprobado', `${money(viatico.amount)} aprobado para ${viatico.user_name}`);
      loadViaticos();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setApproving(false);
    }
  }

  // Rechazar viático
  async function handleReject() {
    if (!selectedViatico || !rejectionReason.trim()) {
      Alert.alert('Motivo requerido', 'Especifica por qué rechazas el viático');
      return;
    }

    setApproving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No autenticado');

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/approve-viatico`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            viatico_id: selectedViatico.id,
            action: 'reject',
            rejection_reason: rejectionReason.trim(),
          }),
        },
      );

      if (!res.ok) throw new Error('Error al rechazar');

      Alert.alert('✓ Rechazado', `Viático rechazado con motivo enviado al usuario`);
      setShowRejectModal(false);
      setSelectedViatico(null);
      setRejectionReason('');
      loadViaticos();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setApproving(false);
    }
  }

  // Renderizar viático
  function renderViatico({ item }: { item: ViaticoPending }) {
    const conceptMeta = CONCEPTS[item.concept] ?? { label: 'Otro', icon: '📦' };

    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.user}>{item.user_name}</Text>
            <Text style={styles.concept}>
              {conceptMeta.icon} {conceptMeta.label}
            </Text>
            <Text style={styles.description} numberOfLines={1}>{item.description}</Text>
            <Text style={styles.date}>{item.trip_date} {item.city ? `• ${item.city}` : ''}</Text>
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

        {/* Botones de acción */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: BRAND.green + '20' }]}
            onPress={() => handleApprove(item)}
            disabled={approving}
          >
            <Text style={[styles.actionBtnText, { color: BRAND.green }]}>
              ✅ Aprobar
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: BRAND.red + '20' }]}
            onPress={() => {
              setSelectedViatico(item);
              setShowRejectModal(true);
            }}
            disabled={approving}
          >
            <Text style={[styles.actionBtnText, { color: BRAND.red }]}>
              ❌ Rechazar
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading && viaticos.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {viaticos.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyText}>Sin viáticos pendientes</Text>
          <Text style={styles.emptyHint}>Todos los viáticos han sido procesados</Text>
        </View>
      ) : (
        <>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              ⏳ {viaticos.length} viático{viaticos.length !== 1 ? 's' : ''} pendiente{viaticos.length !== 1 ? 's' : ''} de aprobación
            </Text>
          </View>
          <FlatList
            data={viaticos}
            keyExtractor={(v) => v.id}
            renderItem={renderViatico}
            contentContainerStyle={styles.list}
            refreshing={loading}
            onRefresh={loadViaticos}
          />
        </>
      )}

      {/* Modal rechazar */}
      <Modal visible={showRejectModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Motivo del rechazo</Text>
            {selectedViatico && (
              <Text style={styles.modalSubtitle}>
                {money(selectedViatico.amount)} - {selectedViatico.description}
              </Text>
            )}
            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: 'top', marginVertical: 12 }]}
              placeholder="Explica por qué rechazas este viático..."
              multiline
              value={rejectionReason}
              onChangeText={setRejectionReason}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rejectBtn, (!rejectionReason.trim() || approving) && { opacity: 0.5 }]}
                onPress={handleReject}
                disabled={!rejectionReason.trim() || approving}
              >
                {approving ? <ActivityIndicator color="#fff" /> : <Text style={styles.rejectBtnText}>Rechazar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.gray },
  badge: {
    marginHorizontal: 12, marginTop: 12, marginBottom: 8,
    backgroundColor: BRAND.orange + '20', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  badgeText: { color: BRAND.orange, fontWeight: '700', fontSize: 13 },
  list: { paddingHorizontal: 12, paddingBottom: 24 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: BRAND.orange + '30',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  user: { fontSize: 13, color: '#90A4AE', fontWeight: '600' },
  concept: { fontSize: 15, fontWeight: '700', color: BRAND.navy, marginTop: 2 },
  description: { fontSize: 13, color: '#90A4AE', marginTop: 2 },
  date: { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  amount: { fontSize: 18, fontWeight: '800', color: BRAND.navy },
  typeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  typeBadgeText: { fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  actionBtnText: { fontWeight: '700', fontSize: 13 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyText: { fontSize: 16, color: BRAND.navy, fontWeight: '700' },
  emptyHint: { fontSize: 13, color: '#90A4AE', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 32,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: BRAND.navy },
  modalSubtitle: { fontSize: 13, color: '#90A4AE', marginTop: 6 },
  input: { backgroundColor: BRAND.gray, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 14, color: BRAND.navy },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: '#90A4AE' },
  rejectBtn: { flex: 1, backgroundColor: BRAND.red, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  rejectBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
