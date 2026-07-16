// BancoCheck — Movimientos: explicar/clasificar/marcar personal/ignorar
// cada movimiento bancario. Las 4 acciones llaman a RPCs atómicos
// (update + audit log en una sola transacción de Postgres).
import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';
import { useBancoAccounts, useBancoTransactions, useBancoActions } from './hooks';
import { AccountSelector, TransactionList, ClassifyModal } from './components';
import type { BankTransaction, BankTransactionStatus } from './types';

const BANCO_COLOR = BRAND.blue;

type FilterKey = 'unexplained' | 'explained' | 'personal' | 'all';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'unexplained', label: 'Sin explicar' },
  { key: 'explained',   label: 'Explicados' },
  { key: 'personal',    label: 'Personales' },
  { key: 'all',         label: 'Todos' },
];

const UNEXPLAINED_STATUSES: BankTransactionStatus[] = ['new', 'matched', 'unidentified', 'pending_document', 'pending_invoice'];

export default function BancoCheckMovimientos() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>((params.filter as FilterKey) ?? 'unexplained');
  const [selected, setSelected] = useState<BankTransaction | null>(null);

  useFocusEffect(useCallback(() => {
    (async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }
      const member = await getActiveMembership(user.id);
      setCompanyId(member?.company_id ?? null);
      setLoading(false);
    })();
  }, []));

  const { accounts } = useBancoAccounts(companyId ?? '');
  const { transactions, loading: loadingTx, refetch } = useBancoTransactions(companyId ?? '', accountId ?? undefined);
  const { classify, markPersonal, ignore, saving } = useBancoActions();

  const filtered = transactions.filter(t => {
    if (filter === 'unexplained') return UNEXPLAINED_STATUSES.includes(t.status) && !t.is_personal;
    if (filter === 'explained')   return t.status === 'explained';
    if (filter === 'personal')    return t.is_personal;
    return true;
  });

  async function handleClassify(category: string) {
    if (!selected) return;
    const res = await classify(selected.id, 'explained', category);
    if (!res.success) { Alert.alert('Error', res.error ?? 'No se pudo explicar el movimiento'); return; }
    setSelected(null);
    refetch();
  }

  async function handlePersonal(t: BankTransaction) {
    const res = await markPersonal(t.id, true);
    if (!res.success) Alert.alert('Error', res.error ?? 'No se pudo marcar como personal');
    else refetch();
  }

  async function handleIgnore(t: BankTransaction) {
    const res = await ignore(t.id);
    if (!res.success) Alert.alert('Error', res.error ?? 'No se pudo ignorar el movimiento');
    else refetch();
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BANCO_COLOR} />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <AccountSelector accounts={accounts} selectedId={accountId} onSelect={setAccountId} />

      <View style={s.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[s.filterChip, filter === f.key && s.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.pad}>
        {loadingTx ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={BANCO_COLOR} />
        ) : (
          <TransactionList
            transactions={filtered}
            onExplain={setSelected}
            onPersonal={handlePersonal}
            onIgnore={handleIgnore}
          />
        )}
      </ScrollView>

      <ClassifyModal transaction={selected} onClose={() => setSelected(null)} onClassify={handleClassify} saving={saving} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND.gray, paddingTop: 12 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  filterChip: { flex: 1, paddingVertical: 9, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', borderWidth: 1, borderColor: '#F0F0F0' },
  filterChipActive: { backgroundColor: BRAND.blue, borderColor: BRAND.blue },
  filterText: { fontSize: 11, fontWeight: '700', color: BRAND.navy },
  filterTextActive: { color: '#fff' },
  pad: { padding: 16, paddingTop: 8, paddingBottom: 44 },
});
