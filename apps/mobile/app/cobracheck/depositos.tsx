// Cobrador — Depósitos Bancarios/Efectivo o Documentos, con relación a lo
// cobrado (para que quede claro cuánto se cobró vs. cuánto se ha depositado).
import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { BRAND, formatCurrency } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';

type DepositType = 'bank' | 'cash' | 'document';

interface Deposit {
  id: string;
  deposit_type: DepositType;
  amount: number;
  deposit_date: string;
  bank_reference: string | null;
  created_at: string;
}

const TYPE_META: Record<DepositType, { label: string; icon: string }> = {
  bank:     { label: 'Bancario',  icon: '🏦' },
  cash:     { label: 'Efectivo',  icon: '💵' },
  document: { label: 'Documento', icon: '📄' },
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DepositosScreen() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId,    setUserId]    = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  const [deposits,      setDeposits]      = useState<Deposit[]>([]);
  const [totalCollected, setTotalCollected] = useState(0);

  const [depositType, setDepositType] = useState<DepositType>('cash');
  const [amount,      setAmount]      = useState('');
  const [reference,   setReference]   = useState('');
  const [photoUri,    setPhotoUri]    = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const m = await getActiveMembership(user.id);
      if (!m) { setLoading(false); return; }
      setCompanyId(m.company_id);

      const today = todayStr();
      const [{ data: deps }, { data: movs }] = await Promise.all([
        supabase.from('cobra_deposits').select('id, deposit_type, amount, deposit_date, bank_reference, created_at')
          .eq('company_id', m.company_id).eq('user_id', user.id).eq('deposit_date', today)
          .order('created_at', { ascending: false }),
        supabase.from('cobra_movements').select('collected_amount')
          .eq('company_id', m.company_id).eq('user_id', user.id).eq('movement_type', 'collected')
          .gte('route_point_ts', `${today}T00:00:00`).lte('route_point_ts', `${today}T23:59:59`),
      ]);
      setDeposits(deps ?? []);
      setTotalCollected((movs ?? []).reduce((s: number, mv: any) => s + (mv.collected_amount ?? 0), 0));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const totalDeposited = useMemo(() => deposits.reduce((s, d) => s + d.amount, 0), [deposits]);
  const pending = totalCollected - totalDeposited;

  async function pickPhoto() {
    Alert.alert('Foto del comprobante', '¿Cómo quieres agregarla?', [
      { text: 'Cámara', onPress: async () => {
          const r = await ImagePicker.launchCameraAsync({ quality: 0.6 });
          if (!r.canceled && r.assets[0]) setPhotoUri(r.assets[0].uri);
        } },
      { text: 'Galería', onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6 });
          if (!r.canceled && r.assets[0]) setPhotoUri(r.assets[0].uri);
        } },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function handleSave() {
    if (!companyId || !userId) return;
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a cero.');
      return;
    }
    setSaving(true);
    try {
      let photoPath: string | null = null;
      if (photoUri) {
        try {
          const fileName = `cobra_deposits/${userId}/${Date.now()}.jpg`;
          const response = await fetch(photoUri);
          const blob = await response.blob();
          const { data, error } = await supabase.storage.from('documents').upload(fileName, blob, { upsert: true });
          if (!error) photoPath = data?.path ?? null;
        } catch { /* offline o fallo de subida — se guarda el depósito igual */ }
      }

      const { error } = await supabase.from('cobra_deposits').insert({
        company_id:     companyId,
        user_id:        userId,
        deposit_type:   depositType,
        amount:         amountNum,
        deposit_date:   todayStr(),
        bank_reference: reference.trim() || null,
        photo_uri:      photoPath,
        related_collected: totalCollected,
      });
      if (error) throw error;

      setAmount('');
      setReference('');
      setPhotoUri(null);
      Alert.alert('✓ Depósito registrado', formatCurrency(amountNum));
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo registrar el depósito.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
      <ActivityIndicator size="large" color={BRAND.cobra} />
    </View>;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <View style={styles.relationCard}>
        <View style={styles.relationRow}>
          <Text style={styles.relationLabel}>Cobrado hoy</Text>
          <Text style={styles.relationValue}>{formatCurrency(totalCollected)}</Text>
        </View>
        <View style={styles.relationRow}>
          <Text style={styles.relationLabel}>Depositado hoy</Text>
          <Text style={styles.relationValue}>{formatCurrency(totalDeposited)}</Text>
        </View>
        <View style={[styles.relationRow, { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 8, marginTop: 4 }]}>
          <Text style={[styles.relationLabel, { fontWeight: '800' }]}>Por depositar</Text>
          <Text style={[styles.relationValue, { color: pending > 0 ? '#FF9800' : BRAND.green }]}>{formatCurrency(pending)}</Text>
        </View>
      </View>

      <Text style={styles.fieldLabel}>Tipo de depósito</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        {(Object.keys(TYPE_META) as DepositType[]).map(t => (
          <TouchableOpacity key={t} style={[styles.typeChip, depositType === t && styles.typeChipActive]} onPress={() => setDepositType(t)}>
            <Text style={{ fontSize: 16 }}>{TYPE_META[t].icon}</Text>
            <Text style={[styles.typeChipText, depositType === t && { color: '#fff' }]}>{TYPE_META[t].label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Monto</Text>
      <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor="#B0BEC5" keyboardType="decimal-pad" />

      <Text style={styles.fieldLabel}>Referencia (opcional)</Text>
      <TextInput style={styles.input} value={reference} onChangeText={setReference} placeholder="Ficha de depósito, folio, etc." placeholderTextColor="#B0BEC5" />

      <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
        <Text style={styles.photoBtnText}>{photoUri ? '✅ Foto agregada — toca para cambiar' : '📷 Agregar foto del comprobante'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>✓ Registrar Depósito</Text>}
      </TouchableOpacity>

      {deposits.length > 0 && (
        <>
          <Text style={[styles.fieldLabel, { marginTop: 24 }]}>Depósitos de hoy</Text>
          {deposits.map(d => (
            <View key={d.id} style={styles.depositRow}>
              <Text style={{ fontSize: 16 }}>{TYPE_META[d.deposit_type].icon}</Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.depositLabel}>{TYPE_META[d.deposit_type].label}{d.bank_reference ? ` — ${d.bank_reference}` : ''}</Text>
                <Text style={styles.depositTime}>{new Date(d.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <Text style={styles.depositAmount}>{formatCurrency(d.amount)}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  relationCard: { backgroundColor: '#182535', borderRadius: 16, padding: 16, marginBottom: 16 },
  relationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  relationLabel: { fontSize: 13, color: '#94A3B8' },
  relationValue: { fontSize: 15, fontWeight: '800', color: '#fff' },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 13, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 15, color: BRAND.navy },

  typeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E0E0E0' },
  typeChipActive: { backgroundColor: BRAND.cobra, borderColor: BRAND.cobra },
  typeChipText: { fontSize: 12, fontWeight: '700', color: BRAND.navy },

  photoBtn: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: '#E0E0E0', alignItems: 'center', marginTop: 12 },
  photoBtnText: { fontSize: 13, fontWeight: '600', color: BRAND.navy },

  saveBtn: { backgroundColor: BRAND.cobra, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  depositRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E8EAF6' },
  depositLabel: { fontSize: 13, fontWeight: '700', color: BRAND.navy },
  depositTime: { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  depositAmount: { fontSize: 14, fontWeight: '800', color: BRAND.green },
});
