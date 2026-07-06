// Pantalla de aprobación de viáticos para supervisor/contador/admin
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, Modal, TextInput, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';

const SUPERVISOR_ROLES = ['owner', 'admin', 'accountant', 'supervisor', 'contador_general'];

interface ViajeSubmitted {
  id:             string;
  employee_id:    string;
  employee_name:  string;
  destination:    string;
  purpose:        string | null;
  departure_date: string;
  return_date:    string | null;
  advance_amount: number;
  total_spent:    number;
  created_at:     string;
}

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export default function ViaticosAprobacionScreen() {
  const [viajes,         setViajes]         = useState<ViajeSubmitted[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [companyId,      setCompanyId]      = useState<string | null>(null);
  const [showReject,     setShowReject]     = useState(false);
  const [selectedViaje,  setSelectedViaje]  = useState<ViajeSubmitted | null>(null);
  const [rejectReason,   setRejectReason]   = useState('');
  const [processing,     setProcessing]     = useState(false);

  const loadViajes = useCallback(async () => {
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

      if (!member || !SUPERVISOR_ROLES.includes(member.role)) {
        Alert.alert('Acceso denegado', 'Solo supervisores y contadores pueden aprobar viáticos.');
        return;
      }

      setCompanyId(member.company_id);

      const { data: rows } = await supabase
        .from('viaticos')
        .select('id, employee_id, destination, purpose, departure_date, return_date, advance_amount, total_spent, created_at')
        .eq('company_id', member.company_id)
        .eq('status', 'submitted')
        .order('created_at', { ascending: false });

      if (!rows?.length) { setViajes([]); return; }

      // Obtener nombres de los empleados
      const ids = [...new Set(rows.map((r: any) => r.employee_id))];
      const { data: members } = await supabase
        .from('company_members')
        .select('user_id, full_name')
        .eq('company_id', member.company_id)
        .in('user_id', ids);

      const nameMap: Record<string, string> = {};
      (members ?? []).forEach((m: any) => { nameMap[m.user_id] = m.full_name ?? m.user_id.slice(0, 8); });

      setViajes(
        rows.map((v: any) => ({
          ...v,
          employee_name: nameMap[v.employee_id] ?? 'Usuario',
          advance_amount: v.advance_amount ?? 0,
          total_spent:    v.total_spent    ?? 0,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadViajes(); }, [loadViajes]);
  useFocusEffect(useCallback(() => { loadViajes(); }, [loadViajes]));

  async function handleApprove(viaje: ViajeSubmitted) {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('viaticos')
        .update({ status: 'approved' })
        .eq('id', viaje.id);
      if (error) throw error;
      Alert.alert('✅ Aprobado', `Viaje a ${viaje.destination} aprobado para ${viaje.employee_name}.`);
      await loadViajes();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject() {
    if (!selectedViaje || !rejectReason.trim()) {
      Alert.alert('Motivo requerido', 'Escribe el motivo del rechazo.');
      return;
    }
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('viaticos')
        .update({ status: 'rejected', notes: `Rechazado: ${rejectReason.trim()}` })
        .eq('id', selectedViaje.id);
      if (error) throw error;
      Alert.alert('❌ Rechazado', 'El viaje fue rechazado. El comprador fue notificado.');
      setShowReject(false);
      setSelectedViaje(null);
      setRejectReason('');
      await loadViajes();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setProcessing(false);
    }
  }

  function renderViaje({ item }: { item: ViajeSubmitted }) {
    const balance = item.advance_amount - item.total_spent;
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.employeeName}>{item.employee_name}</Text>
            <Text style={styles.destination}>✈️ {item.destination}</Text>
            {item.purpose ? <Text style={styles.purpose}>{item.purpose}</Text> : null}
            <Text style={styles.dates}>
              📅 {item.departure_date}{item.return_date ? ` → ${item.return_date}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {item.advance_amount > 0 && (
              <>
                <Text style={styles.advLabel}>Anticipo</Text>
                <Text style={styles.advAmount}>{money(item.advance_amount)}</Text>
                <Text style={[styles.balanceText, { color: balance >= 0 ? BRAND.green : BRAND.red }]}>
                  {balance >= 0 ? '↑' : '↓'} {money(Math.abs(balance))}
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: BRAND.green + '20' }]}
            onPress={() => handleApprove(item)}
            disabled={processing}
          >
            <Text style={[styles.btnText, { color: BRAND.green }]}>✅ Aprobar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: BRAND.red + '20' }]}
            onPress={() => { setSelectedViaje(item); setShowReject(true); }}
            disabled={processing}
          >
            <Text style={[styles.btnText, { color: BRAND.red }]}>❌ Rechazar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading && !viajes.length) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {viajes.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>✈️</Text>
          <Text style={styles.emptyTitle}>Sin viajes pendientes</Text>
          <Text style={styles.emptyHint}>Los viajes reportados aparecerán aquí para aprobación</Text>
        </View>
      ) : (
        <>
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              ⏳ {viajes.length} viaje{viajes.length !== 1 ? 's' : ''} pendiente{viajes.length !== 1 ? 's' : ''} de aprobación
            </Text>
          </View>
          <FlatList
            data={viajes}
            keyExtractor={v => v.id}
            renderItem={renderViaje}
            contentContainerStyle={styles.list}
            refreshing={loading}
            onRefresh={loadViajes}
          />
        </>
      )}

      {/* Modal rechazo */}
      <Modal
        visible={showReject}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowReject(false); setRejectReason(''); }}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Motivo del rechazo</Text>
            {selectedViaje && (
              <Text style={styles.sheetSub}>
                Viaje a {selectedViaje.destination} de {selectedViaje.employee_name}
              </Text>
            )}
            <TextInput
              style={styles.reasonInput}
              placeholder="Escribe el motivo..."
              placeholderTextColor="#B0BEC5"
              multiline
              value={rejectReason}
              onChangeText={setRejectReason}
            />
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowReject(false); setRejectReason(''); }}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rejectBtn, (!rejectReason.trim() || processing) && { opacity: 0.5 }]}
                onPress={handleReject}
                disabled={!rejectReason.trim() || processing}
              >
                {processing
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.rejectBtnText}>Rechazar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: BRAND.gray },
  banner:       { margin: 12, backgroundColor: BRAND.orange + '20', borderRadius: 10, padding: 12 },
  bannerText:   { color: BRAND.orange, fontWeight: '700', fontSize: 13 },
  list:         { paddingHorizontal: 12, paddingBottom: 32 },
  card:         { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardTop:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  employeeName: { fontSize: 12, fontWeight: '600', color: '#90A4AE' },
  destination:  { fontSize: 16, fontWeight: '800', color: BRAND.navy, marginTop: 2 },
  purpose:      { fontSize: 13, color: '#607D8B', marginTop: 2 },
  dates:        { fontSize: 12, color: '#90A4AE', marginTop: 4 },
  advLabel:     { fontSize: 11, color: '#90A4AE', textAlign: 'right' },
  advAmount:    { fontSize: 16, fontWeight: '800', color: BRAND.navy, textAlign: 'right' },
  balanceText:  { fontSize: 12, fontWeight: '700', textAlign: 'right', marginTop: 2 },
  actions:      { flexDirection: 'row', gap: 8 },
  btn:          { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  btnText:      { fontWeight: '700', fontSize: 13 },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon:    { fontSize: 52, marginBottom: 12 },
  emptyTitle:   { fontSize: 16, fontWeight: '700', color: BRAND.navy },
  emptyHint:    { fontSize: 13, color: '#90A4AE', marginTop: 6, textAlign: 'center', lineHeight: 20 },
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  sheetTitle:   { fontSize: 18, fontWeight: '800', color: BRAND.navy },
  sheetSub:     { fontSize: 13, color: '#90A4AE', marginTop: 6, marginBottom: 12 },
  reasonInput:  { backgroundColor: BRAND.gray, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 14, color: BRAND.navy, height: 100, textAlignVertical: 'top' },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn:    { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText:{ fontSize: 15, fontWeight: '700', color: '#90A4AE' },
  rejectBtn:    { flex: 1, backgroundColor: BRAND.red, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  rejectBtnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },
});
