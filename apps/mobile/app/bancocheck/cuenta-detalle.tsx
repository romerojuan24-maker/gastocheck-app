// BancoCheck — Detalle de cuenta: saldo, movimientos del mes seleccionado
// (con navegación a meses anteriores) y estado de aprobación por
// movimiento. "✓ Aprobado" = el contador ya lo clasificó (status
// explained/personal/ignored); "⏳ Pendiente" = todavía sin revisar.
import { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { BRAND, formatCurrency } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { useBancoActions } from './hooks';
import { ClassifyModal } from './components';
import type { BankAccount, BankTransaction, BankTransactionStatus } from './types';

const BANCO_COLOR = BRAND.blue;
const PENDING_STATUSES: BankTransactionStatus[] = ['new', 'matched', 'unidentified', 'pending_document', 'pending_invoice'];

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function monthRange(year: number, month: number) {
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endDate = new Date(year, month + 1, 1);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`;
  return { start, end };
}

export default function BancoCheckCuentaDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [selected, setSelected] = useState<BankTransaction | null>(null);
  const { classify, saving } = useBancoActions();

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { start, end } = monthRange(year, month);
    const [{ data: acc }, { data: txns }] = await Promise.all([
      supabase.from('bank_accounts').select('*').eq('id', id).maybeSingle(),
      supabase.from('bank_transactions').select('*')
        .eq('bank_account_id', id).gte('transaction_date', start).lt('transaction_date', end)
        .order('transaction_date', { ascending: false }),
    ]);
    setAccount(acc as BankAccount);
    setTransactions((txns ?? []) as BankTransaction[]);
    setLoading(false);
  }, [id, year, month]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { totalIn, totalOut, approvedCount, pendingCount } = useMemo(() => {
    let ti = 0, to = 0, ap = 0, pe = 0;
    for (const t of transactions) {
      if (t.amount >= 0) ti += t.amount; else to += Math.abs(t.amount);
      if (PENDING_STATUSES.includes(t.status) && !t.is_personal) pe++; else ap++;
    }
    return { totalIn: ti, totalOut: to, approvedCount: ap, pendingCount: pe };
  }, [transactions]);

  function changeMonth(delta: number) {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  }

  async function handleClassify(category: string) {
    if (!selected) return;
    const res = await classify(selected.id, 'explained', category);
    if (!res.success) { Alert.alert('Error', res.error ?? 'No se pudo aprobar el movimiento'); return; }
    setSelected(null);
    load();
  }

  if (loading && !account) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BANCO_COLOR} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      <View style={s.header}>
        <Text style={s.accountName}>{account?.name}</Text>
        <Text style={s.balance}>{account ? formatCurrency(account.current_balance) : '—'}</Text>
        <Text style={s.balanceLabel}>Saldo actual de la cuenta</Text>
      </View>

      <View style={s.monthNav}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={s.monthArrow}><Text style={s.monthArrowText}>‹</Text></TouchableOpacity>
        <Text style={s.monthLabel}>{MESES[month]} {year}</Text>
        <TouchableOpacity onPress={() => changeMonth(1)} style={s.monthArrow}><Text style={s.monthArrowText}>›</Text></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 44 }}>
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Entradas</Text>
            <Text style={[s.statValue, { color: BRAND.green }]}>{formatCurrency(totalIn)}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Salidas</Text>
            <Text style={[s.statValue, { color: BRAND.red }]}>{formatCurrency(totalOut)}</Text>
          </View>
        </View>
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Aprobados</Text>
            <Text style={s.statValue}>{approvedCount}</Text>
          </View>
          <View style={[s.statCard, pendingCount > 0 && { backgroundColor: '#FFEBEE', borderColor: '#FFCDD2' }]}>
            <Text style={s.statLabel}>Pendientes</Text>
            <Text style={[s.statValue, pendingCount > 0 && { color: BRAND.red }]}>{pendingCount}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={BANCO_COLOR} />
        ) : transactions.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ color: '#90A4AE' }}>Sin movimientos en {MESES[month]} {year}.</Text>
          </View>
        ) : transactions.map(t => {
          const isPending = PENDING_STATUSES.includes(t.status) && !t.is_personal;
          const isDeposit = t.amount >= 0;
          return (
            <TouchableOpacity
              key={t.id}
              style={s.txnCard}
              activeOpacity={isPending ? 0.7 : 1}
              onPress={() => { if (isPending) setSelected(t); }}
            >
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={s.txnDesc} numberOfLines={1}>{t.description || 'Sin descripción'}</Text>
                <Text style={s.txnDate}>{new Date(t.transaction_date).toLocaleDateString('es-MX')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.txnAmount, { color: isDeposit ? BRAND.green : BRAND.red }]}>
                  {isDeposit ? '+' : '-'}{formatCurrency(Math.abs(t.amount))}
                </Text>
                <Text style={[s.badge, isPending ? s.badgePending : s.badgeApproved]}>
                  {isPending ? '⏳ Pendiente' : '✓ Aprobado'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ClassifyModal transaction={selected} onClose={() => setSelected(null)} onClassify={handleClassify} saving={saving} />
    </View>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: BRAND.navy, padding: 22, alignItems: 'center' },
  accountName: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },
  balance: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 4 },
  balanceLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  monthArrow: { paddingHorizontal: 20 },
  monthArrowText: { fontSize: 20, fontWeight: '800', color: BANCO_COLOR },
  monthLabel: { fontSize: 15, fontWeight: '800', color: BRAND.navy, minWidth: 140, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statCard: { flex: 1, padding: 12, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F0F0F0' },
  statLabel: { fontSize: 11, color: '#90A4AE', marginBottom: 4, fontWeight: '600' },
  statValue: { fontSize: 17, fontWeight: '800', color: BRAND.navy },
  txnCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 13, marginTop: 8,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F0F0F0',
  },
  txnDesc: { fontSize: 14, fontWeight: '700', color: BRAND.navy },
  txnDate: { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  txnAmount: { fontSize: 14, fontWeight: '800' },
  badge: { fontSize: 10, fontWeight: '700', marginTop: 4 },
  badgeApproved: { color: BRAND.green },
  badgePending: { color: BRAND.red },
});
