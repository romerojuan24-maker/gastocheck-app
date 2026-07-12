// BancoCheck — Cuentas Bancarias: lista de cuentas, saldo actual de cada
// una. Tap → detalle con movimientos del mes (y meses anteriores).
import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { BRAND, formatCurrency } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';
import type { BankAccount } from './types';

const BANCO_COLOR = BRAND.blue;

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  checking: 'Cuenta de cheques', savings: 'Cuenta de ahorro', credit_card: 'Tarjeta de crédito', other: 'Otra',
};

export default function BancoCheckCuentas() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);

  useFocusEffect(useCallback(() => {
    (async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }
      const member = await getActiveMembership(user.id);
      if (!member) { setLoading(false); return; }

      const { data } = await supabase.from('bank_accounts')
        .select('*').eq('company_id', member.company_id).eq('is_active', true).order('name');
      setAccounts((data ?? []) as BankAccount[]);
      setLoading(false);
    })();
  }, []));

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BANCO_COLOR} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 44 }}>
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
  );
}

const s = StyleSheet.create({
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
});
