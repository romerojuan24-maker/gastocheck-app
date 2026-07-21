// BancoCheck — Alta manual de movimiento (pago/egreso o ingreso).
// Complementa la importación CSV: permite registrar a mano un pago por
// cuenta bancaria o un ingreso (cobros, préstamos, aportaciones).
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';
import DatePickerField from '../../components/DatePickerField';
import { friendlyError } from '../../lib/friendly-errors';
import type { BankAccount } from './types';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Separadores de miles en vivo, hasta 2 decimales
function formatMonto(raw: string): string {
  const clean = raw.replace(/[^0-9.]/g, '');
  const dot = clean.indexOf('.');
  const intPart = (dot === -1 ? clean : clean.slice(0, dot)).replace(/^0+(?=\d)/, '');
  const decPart = dot === -1 ? null : clean.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  const intFmt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart === null ? intFmt : `${intFmt}.${decPart}`;
}

export default function BancoCheckNuevoMovimiento() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [accounts,  setAccounts]  = useState<BankAccount[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  const [tipo,     setTipo]     = useState<'ingreso' | 'egreso'>('egreso');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [amount,   setAmount]   = useState('');
  const [date,     setDate]     = useState(todayStr());
  const [concept,  setConcept]  = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const m = await getActiveMembership(user.id);
      if (!m) { setLoading(false); return; }
      setCompanyId(m.company_id);
      const { data } = await supabase.from('bank_accounts')
        .select('*').eq('company_id', m.company_id).eq('is_active', true).order('name');
      const list = (data ?? []) as BankAccount[];
      setAccounts(list);
      if (list.length > 0) setAccountId(list[0].id);
      setLoading(false);
    })();
  }, []);

  async function handleSave() {
    if (!companyId || !accountId) { Alert.alert('Falta cuenta', 'Selecciona la cuenta bancaria.'); return; }
    const monto = parseFloat(amount.replace(/,/g, ''));
    if (!monto || monto <= 0) { Alert.alert('Monto inválido', 'Ingresa un monto mayor a cero.'); return; }
    if (!concept.trim()) { Alert.alert('Falta concepto', 'Describe el movimiento.'); return; }

    setSaving(true);
    try {
      // Signo: ingreso = positivo, egreso = negativo
      const signed = tipo === 'ingreso' ? monto : -monto;

      const { error } = await supabase.from('bank_transactions').insert({
        company_id:       companyId,
        bank_account_id:  accountId,
        transaction_date: date,
        description:      concept.trim(),
        amount:          signed,
        status:          'new',
        imported_from:   'manual',
      });
      if (error) throw error;

      // Reflejar en el saldo de la cuenta
      const acc = accounts.find(a => a.id === accountId);
      if (acc) {
        await supabase.from('bank_accounts')
          .update({ current_balance: (acc.current_balance ?? 0) + signed })
          .eq('id', accountId);
      }

      Alert.alert(
        '✓ Movimiento registrado',
        `${tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} de $${monto.toLocaleString('es-MX')} — ${concept.trim()}`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (e: any) {
      Alert.alert('No se pudo registrar', friendlyError(e, 'registrar movimientos bancarios'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <View style={st.center}><ActivityIndicator size="large" color={BRAND.blue} /></View>;
  }

  if (accounts.length === 0) {
    return (
      <View style={st.center}>
        <Text style={{ fontSize: 34, marginBottom: 10 }}>🏦</Text>
        <Text style={{ color: '#607D8B', textAlign: 'center', paddingHorizontal: 30 }}>
          No tienes cuentas bancarias. Da de alta una cuenta primero.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      {/* Tipo */}
      <Text style={st.label}>Tipo de movimiento</Text>
      <View style={st.typeRow}>
        <TouchableOpacity
          style={[st.typeBtn, tipo === 'egreso' && { backgroundColor: BRAND.red, borderColor: BRAND.red }]}
          onPress={() => setTipo('egreso')}
        >
          <Text style={[st.typeText, tipo === 'egreso' && { color: '#fff' }]}>➖ Pago / Egreso</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[st.typeBtn, tipo === 'ingreso' && { backgroundColor: BRAND.green, borderColor: BRAND.green }]}
          onPress={() => setTipo('ingreso')}
        >
          <Text style={[st.typeText, tipo === 'ingreso' && { color: '#fff' }]}>➕ Ingreso</Text>
        </TouchableOpacity>
      </View>

      {/* Cuenta */}
      <Text style={st.label}>Cuenta bancaria</Text>
      <View style={{ gap: 8 }}>
        {accounts.map(a => (
          <TouchableOpacity
            key={a.id}
            style={[st.acctRow, accountId === a.id && st.acctRowActive]}
            onPress={() => setAccountId(a.id)}
          >
            <Text style={[st.acctName, accountId === a.id && { color: BRAND.navy, fontWeight: '700' }]}>
              🏦 {a.name}{a.last4 ? ` ···${a.last4}` : ''}
            </Text>
            {accountId === a.id && <Text style={{ color: BRAND.green, fontWeight: '800' }}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {/* Monto */}
      <Text style={st.label}>Monto</Text>
      <View style={st.amountRow}>
        <Text style={st.currency}>$</Text>
        <TextInput
          style={[st.input, { flex: 1 }]}
          value={amount}
          onChangeText={(v) => setAmount(formatMonto(v))}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor="#B0BEC5"
        />
      </View>

      {/* Fecha */}
      <Text style={st.label}>Fecha</Text>
      <DatePickerField label="Fecha" value={date} onChange={setDate} />

      {/* Concepto */}
      <Text style={st.label}>Concepto</Text>
      <TextInput
        style={st.input}
        value={concept}
        onChangeText={setConcept}
        placeholder="Ej: Pago a proveedor, cobro cliente, préstamo…"
        placeholderTextColor="#B0BEC5"
      />

      <TouchableOpacity style={[st.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={st.saveText}>✓ Registrar movimiento</Text>}
      </TouchableOpacity>
      <Text style={st.hint}>
        Se registra como movimiento "Sin explicar" para que luego lo clasifiques con su cuenta contable.
      </Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray },
  label: { fontSize: 12, fontWeight: '800', color: '#90A4AE', textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', borderWidth: 1.5, borderColor: '#E0E0E0' },
  typeText: { fontSize: 13, fontWeight: '800', color: BRAND.navy },
  acctRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12, padding: 13, borderWidth: 1.5, borderColor: '#E0E0E0' },
  acctRowActive: { borderColor: BRAND.blue, backgroundColor: '#F0F4FF' },
  acctName: { fontSize: 14, fontWeight: '600', color: '#546E7A' },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  currency: { fontSize: 20, fontWeight: '800', color: BRAND.navy, marginRight: 8 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 13, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 15, color: BRAND.navy },
  saveBtn: { backgroundColor: BRAND.blue, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  hint: { fontSize: 11, color: '#90A4AE', textAlign: 'center', marginTop: 12, lineHeight: 15 },
});
