// Admin/supervisor registra un depósito a un comprador
import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Alert, Modal, FlatList, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const METHODS = [
  { key: 'transfer', label: 'Transferencia', icon: '🏦' },
  { key: 'cash',     label: 'Efectivo',       icon: '💵' },
  { key: 'card',     label: 'Tarjeta',        icon: '💳' },
  { key: 'other',    label: 'Otro',           icon: '📦' },
] as const;

const COMPRADOR_ROLES = ['spender', 'operator'];

interface Comprador {
  user_id: string;
  full_name: string | null;
  phone: string | null;
}

export default function DepositosScreen() {
  const router = useRouter();
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [compradors, setCompradors] = useState<Comprador[]>([]);
  const [selected,   setSelected]   = useState<Comprador | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [companyId,  setCompanyId]  = useState<string | null>(null);

  const [amount,   setAmount]   = useState('');
  const [method,   setMethod]   = useState<string>('transfer');
  const [concept,  setConcept]  = useState('');
  const [date,     setDate]     = useState(new Date().toISOString().slice(0, 10));
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: me } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!me?.company_id) { setLoading(false); return; }
    setCompanyId(me.company_id);

    const { data: members } = await supabase
      .from('company_members')
      .select('user_id, profiles:user_id(full_name, phone)')
      .eq('company_id', me.company_id)
      .eq('status', 'active')
      .in('role', COMPRADOR_ROLES);

    setCompradors(
      (members ?? []).map((m: any) => ({
        user_id:   m.user_id,
        full_name: m.profiles?.full_name ?? null,
        phone:     m.profiles?.phone ?? null,
      })),
    );
    setLoading(false);
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la galería para adjuntar el comprobante.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  }

  async function handleSave() {
    if (!selected) {
      Alert.alert('Falta dato', 'Selecciona el comprador que recibirá el depósito.');
      return;
    }
    const amt = parseFloat(amount.replace(',', '.'));
    if (!amount || isNaN(amt) || amt <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a cero.');
      return;
    }
    if (!companyId) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      // Subir foto si hay
      let attachmentUrl: string | null = null;
      if (photoUri) {
        const ext = photoUri.split('.').pop()?.toLowerCase() ?? 'jpg';
        const path = `deposits/${companyId}/${Date.now()}.${ext}`;
        const response = await fetch(photoUri);
        const blob = await response.blob();
        const { error: upErr } = await supabase.storage
          .from('expense-attachments')
          .upload(path, blob, { contentType: `image/${ext}` });
        if (!upErr) {
          const { data: urlData } = supabase.storage
            .from('expense-attachments')
            .getPublicUrl(path);
          attachmentUrl = urlData.publicUrl;
        }
      }

      // Buscar póliza anticipo abierta del comprador
      let { data: policy } = await supabase
        .from('policies')
        .select('id')
        .eq('company_id', companyId)
        .eq('holder_id', selected.user_id)
        .eq('policy_type', 'anticipo')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!policy) {
        // Crear póliza nueva para el comprador
        const { data: newPol, error: polErr } = await supabase
          .from('policies')
          .insert({
            company_id:      companyId,
            holder_id:       selected.user_id,
            created_by:      user.id,
            name:            `Anticipo ${new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}`,
            opening_balance: 0,
            policy_type:     'anticipo',
            status:          'open',
          })
          .select('id')
          .single();
        if (polErr) throw polErr;
        policy = newPol;
      }

      // Registrar anticipo/depósito
      const { error: advErr } = await supabase
        .from('advances')
        .insert({
          company_id:     companyId,
          policy_id:      policy!.id,
          amount:         amt,
          method,
          concept:        concept.trim() || null,
          attachment_url: attachmentUrl,
          date,
          created_by:     user.id,
        });
      if (advErr) throw advErr;

      Alert.alert(
        'Depósito registrado ✓',
        `${money(amt)} registrado a ${selected.full_name ?? 'el comprador'}.\nYa puede verlo en sus depósitos.`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo registrar el depósito.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={BRAND.green} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BRAND.gray }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.label}>Comprador *</Text>
      <TouchableOpacity style={styles.selector} onPress={() => setShowPicker(true)}>
        <Text style={[styles.selectorText, !selected && { color: '#90A4AE' }]}>
          {selected
            ? (selected.full_name ?? selected.phone ?? selected.user_id.slice(0, 8))
            : 'Selecciona un comprador'}
        </Text>
        <Text style={{ fontSize: 18, color: '#B0BEC5' }}>⌄</Text>
      </TouchableOpacity>

      <Text style={[styles.label, { marginTop: 18 }]}>Monto *</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        placeholder="0.00"
        placeholderTextColor="#90A4AE"
      />

      <Text style={[styles.label, { marginTop: 18 }]}>Método de depósito</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {METHODS.map((m) => (
          <TouchableOpacity
            key={m.key}
            style={[styles.chip, method === m.key && styles.chipActive]}
            onPress={() => setMethod(m.key)}
          >
            <Text style={[styles.chipText, method === m.key && { color: '#fff' }]}>
              {m.icon} {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { marginTop: 18 }]}>Concepto</Text>
      <TextInput
        style={styles.input}
        value={concept}
        onChangeText={setConcept}
        placeholder="Ej: Anticipo semana 3, Viáticos Monterrey…"
        placeholderTextColor="#90A4AE"
      />

      <Text style={[styles.label, { marginTop: 18 }]}>Fecha del depósito</Text>
      <TextInput
        style={styles.input}
        value={date}
        onChangeText={setDate}
        placeholder="AAAA-MM-DD"
        placeholderTextColor="#90A4AE"
        keyboardType="numeric"
        maxLength={10}
      />

      <Text style={[styles.label, { marginTop: 18 }]}>Comprobante (opcional)</Text>
      <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photoPreview} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={{ fontSize: 28 }}>📎</Text>
            <Text style={{ color: '#90A4AE', fontSize: 13, marginTop: 4 }}>
              Adjuntar foto del comprobante
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.saveBtnText}>Registrar depósito</Text>}
      </TouchableOpacity>

      {/* Modal selector de comprador */}
      <Modal
        visible={showPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Seleccionar comprador</Text>
            {compradors.length === 0 ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ color: '#90A4AE', textAlign: 'center', lineHeight: 22 }}>
                  No hay compradores activos.{'\n'}Invítalos desde Alta Empresa.
                </Text>
              </View>
            ) : (
              <FlatList
                data={compradors}
                keyExtractor={(c) => c.user_id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.compradorRow}
                    onPress={() => { setSelected(item); setShowPicker(false); }}
                  >
                    <View style={styles.avatar}>
                      <Text style={{ fontSize: 20 }}>👤</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.compradorName}>
                        {item.full_name ?? 'Sin nombre'}
                      </Text>
                      {item.phone
                        ? <Text style={styles.compradorPhone}>{item.phone}</Text>
                        : null}
                    </View>
                    {selected?.user_id === item.user_id
                      ? <Text style={{ fontSize: 18, color: BRAND.green }}>✓</Text>
                      : null}
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity style={styles.sheetClose} onPress={() => setShowPicker(false)}>
              <Text style={styles.sheetCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label:    { fontSize: 13, fontWeight: '700', color: '#607D8B', marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: BRAND.navy,
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  selector: {
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: '#E0E0E0',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  selectorText: { fontSize: 15, color: BRAND.navy, flex: 1 },

  chip:       { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E0E0' },
  chipActive: { backgroundColor: BRAND.green, borderColor: BRAND.green },
  chipText:   { fontSize: 13, color: BRAND.navy, fontWeight: '600' },

  photoBtn:         { borderRadius: 10, overflow: 'hidden', minHeight: 80, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E0E0' },
  photoPreview:     { width: '100%', height: 150, resizeMode: 'cover' },
  photoPlaceholder: { alignItems: 'center', padding: 24 },

  saveBtn:     { backgroundColor: BRAND.green, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 28 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '72%' },
  handle:  { width: 36, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetTitle:    { fontSize: 17, fontWeight: '800', color: BRAND.navy, padding: 16, paddingBottom: 8 },
  sheetClose:    { padding: 16, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  sheetCloseText:{ fontSize: 15, color: BRAND.blue, fontWeight: '600' },

  compradorRow:  { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', gap: 12 },
  avatar:        { width: 40, height: 40, borderRadius: 20, backgroundColor: BRAND.green + '20', alignItems: 'center', justifyContent: 'center' },
  compradorName: { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  compradorPhone:{ fontSize: 12, color: '#90A4AE' },
});
