// BancoCheck — Cuentas Bancarias: lista de cuentas, saldo actual de cada
// una, alta de cuenta nueva. Tap → detalle con movimientos del mes.
import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { BRAND, formatCurrency } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';
import type { BankAccount } from './types';

const BANCO_COLOR = BRAND.blue;

const ACCOUNT_TYPES: { key: BankAccount['account_type']; label: string }[] = [
  { key: 'checking', label: 'Cuenta de cheques' },
  { key: 'savings', label: 'Cuenta de ahorro' },
  { key: 'credit_card', label: 'Tarjeta de crédito' },
  { key: 'other', label: 'Otra' },
];
const ACCOUNT_TYPE_LABEL: Record<string, string> = Object.fromEntries(ACCOUNT_TYPES.map(t => [t.key, t.label]));

export default function BancoCheckCuentas() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) { setLoading(false); return; }
    const member = await getActiveMembership(user.id);
    if (!member) { setLoading(false); return; }
    setCompanyId(member.company_id);

    const { data } = await supabase.from('bank_accounts')
      .select('*').eq('company_id', member.company_id).eq('is_active', true).order('name');
    setAccounts((data ?? []) as BankAccount[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BANCO_COLOR} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 44 }}>
        <TouchableOpacity style={s.newBtn} onPress={() => setShowNew(true)} activeOpacity={0.85}>
          <Text style={s.newBtnText}>+ Nueva Cuenta Bancaria</Text>
        </TouchableOpacity>

        {accounts.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🏦</Text>
            <Text style={s.emptyText}>Sin cuentas bancarias registradas.</Text>
          </View>
        ) : accounts.map(acc => (
          <TouchableOpacity
            key={acc.id}
            style={s.card}
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/bancocheck/cuenta-detalle', params: { id: acc.id } } as any)}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{acc.name}</Text>
              <Text style={s.sub}>
                {[acc.bank_name, acc.last4 ? `•••• ${acc.last4}` : null, ACCOUNT_TYPE_LABEL[acc.account_type]].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.balance}>{formatCurrency(acc.current_balance)}</Text>
              <Text style={{ fontSize: 18, color: '#90A4AE' }}>›</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {showNew && companyId && (
        <NewAccountModal companyId={companyId} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />
      )}
    </View>
  );
}

function NewAccountModal({ companyId, onClose, onCreated }: { companyId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [bankName, setBankName] = useState('');
  const [last4, setLast4] = useState('');
  const [accountType, setAccountType] = useState<BankAccount['account_type']>('checking');
  const [initialBalance, setInitialBalance] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Falta nombre', 'Ponle un nombre a la cuenta (ej. "Cuenta Principal BBVA").'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('bank_accounts').insert({
        company_id: companyId,
        name: name.trim(),
        bank_name: bankName.trim() || null,
        last4: last4.trim() || null,
        account_type: accountType,
        currency: 'MXN',
        current_balance: parseFloat(initialBalance) || 0,
        is_active: true,
      });
      if (error) throw error;
      onCreated();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo crear la cuenta.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.modal}>
          <Text style={s.modalTitle}>Nueva Cuenta Bancaria</Text>

          <Text style={s.fieldLabel}>Nombre</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Ej. Cuenta Principal BBVA" placeholderTextColor="#B0BEC5" />

          <Text style={s.fieldLabel}>Banco</Text>
          <TextInput style={s.input} value={bankName} onChangeText={setBankName} placeholder="Ej. BBVA, Santander, Banorte" placeholderTextColor="#B0BEC5" />

          <Text style={s.fieldLabel}>Últimos 4 dígitos (opcional)</Text>
          <TextInput style={s.input} value={last4} onChangeText={setLast4} placeholder="0000" placeholderTextColor="#B0BEC5" keyboardType="number-pad" maxLength={4} />

          <Text style={s.fieldLabel}>Tipo de cuenta</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
            {ACCOUNT_TYPES.map(t => (
              <TouchableOpacity key={t.key} onPress={() => setAccountType(t.key)}
                style={[s.typeChip, accountType === t.key && s.typeChipActive]}>
                <Text style={[s.typeChipText, accountType === t.key && s.typeChipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.fieldLabel}>Saldo inicial</Text>
          <TextInput style={s.input} value={initialBalance} onChangeText={setInitialBalance} placeholder="0.00" placeholderTextColor="#B0BEC5" keyboardType="decimal-pad" />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={s.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Crear Cuenta</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  newBtn: { backgroundColor: BANCO_COLOR, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 14 },
  newBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#90A4AE', fontSize: 14 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  name: { fontSize: 15, fontWeight: '800', color: BRAND.navy },
  sub: { fontSize: 12, color: '#90A4AE', marginTop: 3 },
  balance: { fontSize: 16, fontWeight: '800', color: BRAND.navy },

  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: '#fff', borderRadius: 20, padding: 22, width: '90%', maxHeight: '86%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: BRAND.navy, marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: BRAND.gray, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 14, color: BRAND.navy },
  typeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: BRAND.gray, borderWidth: 1, borderColor: '#E0E0E0' },
  typeChipActive: { backgroundColor: BANCO_COLOR, borderColor: BANCO_COLOR },
  typeChipText: { fontSize: 12, fontWeight: '600', color: BRAND.navy },
  typeChipTextActive: { color: '#fff' },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', backgroundColor: BRAND.gray },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: BRAND.navy },
  saveBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', backgroundColor: BANCO_COLOR },
  saveBtnText: { fontSize: 13, fontWeight: '800', color: '#fff' },
});
