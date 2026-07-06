// Detalle de Evento — presupuesto vs gastado + lista de anticipos/gastos
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Modal, TextInput, Alert,
  KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import { getActiveMembership } from '../lib/membership';
import DatePickerField from '../components/DatePickerField';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const METHOD_OPTIONS = [
  { key: 'transfer', label: 'Transferencia' },
  { key: 'cash',     label: 'Efectivo' },
  { key: 'card',     label: 'Tarjeta' },
  { key: 'other',    label: 'Otro' },
];

const TYPE_OPTIONS = [
  { key: 'advance', label: '💰 Anticipo (dinero dado al comprador)' },
  { key: 'expense', label: '🧾 Gasto (comprobante de egreso)' },
];

interface EventDetail {
  id:          string;
  name:        string;
  description: string | null;
  start_date:  string | null;
  end_date:    string | null;
  budget:      number;
  gastador_id: string | null;
  status:      string;
}

interface ExpenseRow {
  id:              string;
  folio:           string | null;
  type:            string;
  description:     string;
  amount:          number;
  method:          string;
  comprobante_url: string | null;
  expense_date:    string;
  spender_name:    string | null;
  created_at:      string;
}

export default function EventDetailScreen() {
  const { id: eventId }  = useLocalSearchParams<{ id: string }>();
  const navigation       = useNavigation();

  const [event,       setEvent]       = useState<EventDetail | null>(null);
  const [expenses,    setExpenses]    = useState<ExpenseRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [companyId,   setCompanyId]   = useState<string | null>(null);
  const [userRole,    setUserRole]    = useState<string>('spender');
  const [userId,      setUserId]      = useState<string | null>(null);
  const [gastadores,  setGastadores]  = useState<{ user_id: string; full_name: string | null }[]>([]);

  // Modal nuevo gasto/anticipo
  const [showModal,   setShowModal]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [fType,       setFType]       = useState<'advance' | 'expense'>('expense');
  const [fDesc,       setFDesc]       = useState('');
  const [fAmount,     setFAmount]     = useState('');
  const [fMethod,     setFMethod]     = useState('transfer');
  const [fDate,       setFDate]       = useState('');
  const [fSpenderId,  setFSpenderId]  = useState<string | null>(null);
  const [photoUri,    setPhotoUri]    = useState<string | null>(null);
  const [photoB64,    setPhotoB64]    = useState<string | null>(null);
  const [uploading,   setUploading]   = useState(false);

  function resetForm() {
    setFType('expense'); setFDesc(''); setFAmount(''); setFMethod('transfer');
    setFDate(''); setFSpenderId(null); setPhotoUri(null); setPhotoB64(null);
  }

  const totalSpent = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const available  = (event?.budget ?? 0) - totalSpent;
  const pct        = event?.budget ? Math.min(totalSpent / event.budget, 1) : 0;

  const isOwner = ['owner', 'admin', 'supervisor', 'accountant', 'contador_general'].includes(userRole);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const member = await getActiveMembership(user.id);
      if (!member) return;

      setCompanyId(member.company_id);
      setUserRole(member.role);

      // Cargar evento
      const { data: ev } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      if (!ev) return;
      setEvent(ev as EventDetail);
      navigation.setOptions({ title: ev.name });

      // Cargar gastadores para el selector
      if (['owner', 'admin', 'supervisor'].includes(member.role)) {
        const { data: mems } = await supabase
          .from('company_members')
          .select('user_id')
          .eq('company_id', member.company_id)
          .in('role', ['spender', 'employee', 'owner', 'admin', 'supervisor'])
          .eq('status', 'active');

        const uids = mems?.length ? mems.map((m: any) => m.user_id) : [user.id];
        const { data: pf } = await supabase.from('profiles').select('id, full_name').in('id', uids);
        const list = (pf ?? []).map((p: any) => ({ user_id: p.id, full_name: p.full_name }));
        // Garantizar que el usuario actual esté en la lista
        if (!list.find((g) => g.user_id === user.id)) {
          list.unshift({ user_id: user.id, full_name: 'Yo' });
        }
        setGastadores(list);
        // Pre-seleccionar: primero el del evento, luego yo mismo
        setFSpenderId(ev.gastador_id ?? user.id);
      } else {
        setFSpenderId(user.id);
      }

      // Cargar gastos del evento
      const { data: exps } = await supabase
        .from('event_expenses')
        .select('id, folio, type, description, amount, method, comprobante_url, expense_date, spender_id, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (!exps?.length) { setExpenses([]); return; }

      // Enriquecer con nombres
      const spenderIds = [...new Set(exps.map((e: any) => e.spender_id))];
      const { data: profiles } = await supabase
        .from('profiles').select('id, full_name').in('id', spenderIds);
      const nameMap: Record<string, string> = {};
      profiles?.forEach((p: any) => { nameMap[p.id] = p.full_name ?? ''; });

      setExpenses(exps.map((e: any) => ({
        ...e,
        spender_name: nameMap[e.spender_id] ?? null,
      })));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para adjuntar comprobantes.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (!res.canceled && res.assets[0]) {
      setPhotoUri(res.assets[0].uri);
      setPhotoB64(res.assets[0].base64 ?? null);
    }
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true });
    if (!res.canceled && res.assets[0]) {
      setPhotoUri(res.assets[0].uri);
      setPhotoB64(res.assets[0].base64 ?? null);
    }
  }

  async function uploadComprobante(): Promise<string | null> {
    if (!photoB64 || !companyId) return null;
    setUploading(true);
    try {
      const path = `${companyId}/${eventId}/${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from('event-comprobantes')
        .upload(path, decode(photoB64), { contentType: 'image/jpeg', upsert: false });
      if (error) { console.warn('Upload warning:', error.message); return null; }

      // Bucket privado: se guarda la ruta, no una URL pública. Para mostrar
      // la imagen más adelante hay que generar un signed URL bajo demanda
      // (supabase.storage.from('event-comprobantes').createSignedUrl(path, ttl)).
      return path;
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!fDesc.trim()) { Alert.alert('Requerido', 'La descripción es obligatoria.'); return; }
    const amt = parseFloat(fAmount.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) { Alert.alert('Monto inválido', 'Ingresa un monto positivo.'); return; }
    if (!fSpenderId) { Alert.alert('Requerido', 'Selecciona un comprador.'); return; }
    if (!companyId || !userId || !eventId) return;

    setSaving(true);
    try {
      let comprobanteUrl: string | null = null;
      if (photoB64) comprobanteUrl = await uploadComprobante();

      const { error } = await supabase.from('event_expenses').insert({
        company_id:      companyId,
        event_id:        eventId,
        spender_id:      fSpenderId,
        type:            fType,
        description:     fDesc.trim(),
        amount:          amt,
        method:          fMethod,
        comprobante_url: comprobanteUrl,
        expense_date:    fDate || new Date().toISOString().slice(0, 10),
        created_by:      userId,
      });

      if (error) { Alert.alert('Error', error.message); return; }

      Alert.alert('✓ Registrado', 'El registro fue guardado exitosamente.');
      setShowModal(false);
      resetForm();
      loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleCloseEvent() {
    Alert.alert(
      'Cerrar evento',
      '¿Deseas marcar este evento como cerrado? No se podrán agregar más registros.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar evento',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('events')
              .update({ status: 'closed' })
              .eq('id', eventId);
            if (error) Alert.alert('Error', error.message);
            else loadData();
          },
        },
      ],
    );
  }

  function renderExpense({ item }: { item: ExpenseRow }) {
    const isAdvance = item.type === 'advance';
    return (
      <View style={styles.expCard}>
        <View style={styles.expHeader}>
          <View style={{ flex: 1 }}>
            {item.folio ? (
              <Text style={styles.folio}>{item.folio}</Text>
            ) : null}
            <Text style={styles.expDesc} numberOfLines={2}>{item.description}</Text>
            <Text style={styles.expMeta}>
              {isAdvance ? '💰 Anticipo' : '🧾 Gasto'} · {item.method}
              {item.spender_name ? ` · ${item.spender_name}` : ''}
            </Text>
            <Text style={styles.expDate}>{item.expense_date}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.expAmount, isAdvance && { color: BRAND.green }]}>
              {isAdvance ? '+' : '-'}{money(Number(item.amount))}
            </Text>
            {item.comprobante_url ? (
              <Text style={styles.hasComp}>📎 Comprobante</Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  if (loading || !event) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      <FlatList
        data={expenses}
        keyExtractor={(e) => e.id}
        renderItem={renderExpense}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshing={loading}
        onRefresh={loadData}
        ListHeaderComponent={
          <View>
            {/* Tarjeta de resumen */}
            <View style={styles.summaryCard}>
              <Text style={styles.eventName}>{event.name}</Text>
              {event.description ? (
                <Text style={styles.eventDesc}>{event.description}</Text>
              ) : null}
              {(event.start_date || event.end_date) && (
                <Text style={styles.dates}>
                  📅 {event.start_date ?? '?'} → {event.end_date ?? '?'}
                </Text>
              )}

              {/* Barra de progreso */}
              <View style={styles.progressBg}>
                <View style={[
                  styles.progressFill,
                  { width: `${pct * 100}%`, backgroundColor: pct >= 1 ? BRAND.red : BRAND.blue },
                ]} />
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Presupuesto</Text>
                  <Text style={[styles.statValue, { color: BRAND.navy }]}>{money(event.budget)}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Gastado</Text>
                  <Text style={[styles.statValue, { color: pct >= 1 ? BRAND.red : BRAND.orange }]}>
                    {money(totalSpent)}
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Disponible</Text>
                  <Text style={[styles.statValue, { color: available < 0 ? BRAND.red : BRAND.green }]}>
                    {money(available)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Botones de acción */}
            {event.status === 'active' && (
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
                <Text style={styles.addBtnText}>+ Registrar Anticipo / Gasto</Text>
              </TouchableOpacity>
            )}

            {isOwner && event.status === 'active' && (
              <TouchableOpacity style={styles.closeBtn} onPress={handleCloseEvent}>
                <Text style={styles.closeBtnText}>Cerrar evento</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.sectionTitle}>
              {expenses.length > 0 ? `${expenses.length} registros` : 'Sin registros aún'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No hay registros en este evento todavía.</Text>
          </View>
        }
      />

      {/* Modal: registrar gasto/anticipo */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => { setShowModal(false); resetForm(); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo Registro</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              {/* Tipo */}
              <Text style={styles.fieldLabel}>Tipo de registro</Text>
              <View style={styles.typeRow}>
                {TYPE_OPTIONS.map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.typeChip, fType === t.key && { backgroundColor: BRAND.blue, borderColor: BRAND.blue }]}
                    onPress={() => setFType(t.key as 'advance' | 'expense')}
                  >
                    <Text style={[styles.typeChipText, fType === t.key && { color: '#fff' }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Gastador (visible para admins/supervisores) */}
              {isOwner && gastadores.length >= 1 && (
                <>
                  <Text style={styles.fieldLabel}>Gastador</Text>
                  <View style={styles.chipWrap}>
                    {gastadores.map((g) => (
                      <TouchableOpacity
                        key={g.user_id}
                        style={[styles.chip, fSpenderId === g.user_id && { backgroundColor: BRAND.blue }]}
                        onPress={() => setFSpenderId(g.user_id)}
                      >
                        <Text style={[styles.chipText, fSpenderId === g.user_id && { color: '#fff' }]}>
                          {g.full_name ?? g.user_id.slice(0, 8)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.fieldLabel}>Descripción *</Text>
              <TextInput
                style={[styles.input, { height: 72, textAlignVertical: 'top' }]}
                placeholder="Ej: Anticipo viáticos, Gasolina, Hotel..."
                placeholderTextColor="#B0BEC5"
                value={fDesc}
                onChangeText={setFDesc}
                multiline
              />

              <Text style={styles.fieldLabel}>Monto (MXN) *</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#B0BEC5"
                value={fAmount}
                onChangeText={setFAmount}
                keyboardType="decimal-pad"
              />

              <Text style={styles.fieldLabel}>Método de pago</Text>
              <View style={styles.chipWrap}>
                {METHOD_OPTIONS.map((m) => (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.chip, fMethod === m.key && { backgroundColor: BRAND.blue }]}
                    onPress={() => setFMethod(m.key)}
                  >
                    <Text style={[styles.chipText, fMethod === m.key && { color: '#fff' }]}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <DatePickerField label="Fecha del gasto" value={fDate} onChange={setFDate} />

              {/* Comprobante */}
              <Text style={styles.fieldLabel}>Comprobante (opcional)</Text>
              {photoUri ? (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: photoUri }} style={styles.photoImg} />
                  <TouchableOpacity style={styles.removePhotoBtn} onPress={() => { setPhotoUri(null); setPhotoB64(null); }}>
                    <Text style={styles.removePhotoText}>✕ Quitar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.photoButtons}>
                  <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                    <Text style={styles.photoBtnText}>📷 Tomar foto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
                    <Text style={styles.photoBtnText}>🖼️ Galería</Text>
                  </TouchableOpacity>
                </View>
              )}
              {uploading && <Text style={styles.uploadingText}>Subiendo imagen...</Text>}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowModal(false); resetForm(); }}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, (saving || uploading) && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving || uploading}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnText}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  summaryCard:    { backgroundColor: '#fff', margin: 12, borderRadius: 16, padding: 16, marginBottom: 0 },
  eventName:      { fontSize: 20, fontWeight: '800', color: BRAND.navy, marginBottom: 4 },
  eventDesc:      { fontSize: 14, color: '#90A4AE', marginBottom: 8 },
  dates:          { fontSize: 13, color: '#90A4AE', marginBottom: 12 },
  progressBg:     { height: 10, backgroundColor: '#F0F0F0', borderRadius: 5, overflow: 'hidden', marginBottom: 12 },
  progressFill:   { height: 10, borderRadius: 5 },
  statsRow:       { flexDirection: 'row', gap: 8 },
  statBox:        { flex: 1, backgroundColor: BRAND.gray, borderRadius: 10, padding: 10, alignItems: 'center' },
  statLabel:      { fontSize: 11, color: '#90A4AE', fontWeight: '600', marginBottom: 4 },
  statValue:      { fontSize: 15, fontWeight: '800' },
  addBtn:         { margin: 12, backgroundColor: BRAND.blue, borderRadius: 12, padding: 14, alignItems: 'center' },
  addBtnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },
  closeBtn:       { marginHorizontal: 12, marginBottom: 8, backgroundColor: '#FFF3E0', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: BRAND.orange },
  closeBtnText:   { color: BRAND.orange, fontSize: 14, fontWeight: '700' },
  sectionTitle:   { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, fontSize: 13, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase' },
  emptyText:      { color: '#90A4AE', fontSize: 14 },
  expCard:        { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 8, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#F0F0F0' },
  expHeader:      { flexDirection: 'row' },
  folio:          { fontSize: 11, fontWeight: '700', color: BRAND.blue, marginBottom: 2, fontFamily: 'monospace' },
  expDesc:        { fontSize: 14, fontWeight: '600', color: BRAND.navy },
  expMeta:        { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  expDate:        { fontSize: 11, color: '#B0BEC5', marginTop: 2 },
  expAmount:      { fontSize: 16, fontWeight: '800', color: BRAND.navy },
  hasComp:        { fontSize: 10, color: BRAND.blue, marginTop: 4 },
  // Modal
  modal:          { flex: 1, backgroundColor: BRAND.gray },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  modalTitle:     { fontSize: 17, fontWeight: '800', color: BRAND.navy },
  modalClose:     { fontSize: 18, color: '#90A4AE', fontWeight: '700' },
  modalBody:      { padding: 16 },
  fieldLabel:     { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 6, marginTop: 14 },
  input:          { backgroundColor: '#fff', borderRadius: 10, padding: 13, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 15, color: BRAND.navy },
  typeRow:        { gap: 8 },
  typeChip:       { borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#fff' },
  typeChipText:   { fontSize: 13, fontWeight: '600', color: BRAND.navy },
  chipWrap:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:           { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0' },
  chipText:       { fontSize: 13, color: BRAND.navy, fontWeight: '600' },
  photoButtons:   { flexDirection: 'row', gap: 10 },
  photoBtn:       { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 10, padding: 13, alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0' },
  photoBtnText:   { fontSize: 14, fontWeight: '600', color: BRAND.navy },
  photoPreview:   { borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#E0E0E0' },
  photoImg:       { width: '100%', height: 160 },
  removePhotoBtn: { padding: 10, alignItems: 'center', backgroundColor: '#FFF3F3' },
  removePhotoText: { color: BRAND.red, fontSize: 13, fontWeight: '700' },
  uploadingText:  { fontSize: 12, color: BRAND.orange, marginTop: 8, textAlign: 'center' },
  modalActions:   { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 32, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  cancelBtn:      { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  cancelBtnText:  { fontSize: 15, fontWeight: '700', color: '#90A4AE' },
  saveBtn:        { flex: 2, backgroundColor: BRAND.blue, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText:    { fontSize: 15, fontWeight: '700', color: '#fff' },
});
